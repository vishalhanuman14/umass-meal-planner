import { HttpError, requireEnv } from "./supabase.ts";

type GeminiOptions = {
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  response_mime_type?: "application/json" | "text/plain";
  responseJsonSchema?: Record<string, unknown>;
  thinkingBudget?: number;
};

type GeminiPart = {
  text?: string;
};

type GeminiResponse = {
  candidates?: Array<{
    finishReason?: string;
    content?: {
      parts?: GeminiPart[];
    };
  }>;
  error?: {
    message?: string;
  };
};

export const GEMINI_FLASH_MODEL = "gemini-flash-latest";

export async function generateGeminiText(
  prompt: string,
  options: GeminiOptions = {},
): Promise<string> {
  const apiKey = requireEnv("GEMINI_API_KEY");
  const model = options.model ?? GEMINI_FLASH_MODEL;
  const responseMimeType = options.response_mime_type ?? "application/json";

  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: options.temperature ?? 0.25,
      responseMimeType,
      responseJsonSchema: options.responseJsonSchema,
      maxOutputTokens: options.maxOutputTokens,
      thinkingConfig: {
        thinkingBudget: options.thinkingBudget ?? 0,
      },
    },
  };

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );

  const payload = await response.json().catch(() => null) as GeminiResponse | null;

  if (!response.ok) {
    const message = payload?.error?.message ?? `Gemini request failed with status ${response.status}`;
    throw new HttpError(502, message);
  }

  const text = payload?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();

  if (payload?.candidates?.[0]?.finishReason === "MAX_TOKENS") {
    throw new HttpError(502, "Gemini response was truncated");
  }

  if (!text) {
    throw new HttpError(502, "Gemini returned an empty response");
  }

  return text;
}

export function parseGeminiJson<T>(raw: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
    if (fenced) {
      try {
        return JSON.parse(fenced) as T;
      } catch {
        // Continue to object extraction below.
      }
    }

    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(raw.slice(start, end + 1)) as T;
      } catch {
        // Fall through to the normalized error.
      }
    }
  }

  throw new HttpError(502, "Gemini returned invalid JSON");
}
