import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

import {
  authenticateRequest,
  errorResponse,
  handleCors,
  HttpError,
  jsonResponse,
  readJsonBody,
  requirePost,
} from "../_shared/supabase.ts";
import { GEMINI_FLASH_MODEL, generateGeminiText, parseGeminiJson } from "../_shared/gemini.ts";
import { fetchMenuItems, formatMenuForPrompt, todayInEasternTime } from "../_shared/menu.ts";
import { fetchProfile, formatProfileForPrompt, type Profile } from "../_shared/profile.ts";

type ChatRequestBody = {
  message?: unknown;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

type ChatResponse = {
  response?: unknown;
};

const ROLE_ORDER: Record<ChatMessage["role"], number> = {
  user: 0,
  assistant: 1,
};

const CHAT_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    response: { type: "string" },
  },
  required: ["response"],
  additionalProperties: false,
};

function sortChatMessages(messages: ChatMessage[]): ChatMessage[] {
  return [...messages].sort((a, b) => {
    const timeDiff = Date.parse(a.created_at) - Date.parse(b.created_at);
    if (timeDiff !== 0) return timeDiff;
    return ROLE_ORDER[a.role] - ROLE_ORDER[b.role];
  });
}

function buildChatPrompt(
  profile: Profile,
  date: string,
  menuText: string,
  history: ChatMessage[],
  message: string,
): string {
  const transcript = history.length > 0
    ? history.map((entry) => `${entry.role}: ${entry.content}`).join("\n")
    : "none";

  return `You are a concise nutrition advisor for a UMass Amherst student.
Use the student's profile and today's dining hall menus. This chat is not aware of any generated meal plan.
Answer questions about menu items, nutrition, meal suggestions, and general nutrition advice.
When recommending menu items, include the dining commons name. If an item is not on today's menu, say so.

STUDENT PROFILE
${formatProfileForPrompt(profile)}

TODAY'S MENU - ${date}
${menuText}

RECENT CHAT
${transcript}

NEW USER MESSAGE
${message}

Respond only with JSON:
{"response": "concise answer"}`;
}

async function fetchRecentMessages(
  supabase: SupabaseClient,
  userId: string,
): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("role, content, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    throw new HttpError(500, `Could not load chat history: ${error.message}`, false);
  }

  return sortChatMessages((data ?? []) as ChatMessage[]);
}

function readMessage(body: ChatRequestBody): string {
  if (typeof body.message !== "string") {
    throw new HttpError(400, "message is required");
  }

  const message = body.message.trim();
  if (!message) {
    throw new HttpError(400, "message cannot be empty");
  }

  if (message.length > 2000) {
    throw new HttpError(400, "message is too long");
  }

  return message;
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) {
    return cors;
  }

  try {
    requirePost(req);
    const body = await readJsonBody<ChatRequestBody>(req);
    const message = readMessage(body);
    const { supabase, user } = await authenticateRequest(req);
    const date = todayInEasternTime();

    const [profile, menuItems, history] = await Promise.all([
      fetchProfile(supabase, user.id),
      fetchMenuItems(supabase, date),
      fetchRecentMessages(supabase, user.id),
    ]);

    const prompt = buildChatPrompt(
      profile,
      date,
      formatMenuForPrompt(menuItems, { includeIngredients: true }),
      history,
      message,
    );

    const raw = await generateGeminiText(prompt, {
      model: GEMINI_FLASH_MODEL,
      response_mime_type: "application/json",
      responseJsonSchema: CHAT_RESPONSE_SCHEMA,
      temperature: 0.3,
      maxOutputTokens: 2048,
    });
    const parsed = parseGeminiJson<ChatResponse>(raw);

    if (typeof parsed.response !== "string" || !parsed.response.trim()) {
      throw new HttpError(502, "Gemini response missing response text");
    }

    const assistantResponse = parsed.response.trim();
    const userCreatedAt = new Date();
    const assistantCreatedAt = new Date(userCreatedAt.getTime() + 1);
    const { data: savedMessages, error: insertError } = await supabase
      .from("chat_messages")
      .insert([
        {
          user_id: user.id,
          role: "user",
          content: message,
          created_at: userCreatedAt.toISOString(),
        },
        {
          user_id: user.id,
          role: "assistant",
          content: assistantResponse,
          created_at: assistantCreatedAt.toISOString(),
        },
      ])
      .select("id, role, content, created_at");

    if (insertError) {
      throw new HttpError(500, `Could not save chat messages: ${insertError.message}`, false);
    }

    return jsonResponse({
      response: assistantResponse,
      messages: savedMessages ?? [],
    });
  } catch (error) {
    return errorResponse(error);
  }
});
