import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";

import ChatBubble from "../components/ChatBubble";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { colors } from "../theme";
import type { ChatMessage, ChatProps } from "../types";

const ROLE_ORDER: Record<ChatMessage["role"], number> = {
  user: 0,
  assistant: 1
};

const suggestions = [
  "Best high-protein dinner?",
  "Vegetarian at Worcester?",
  "Avoid dairy today",
  "Quick lunch near Franklin"
];

function sortMessages(messages: ChatMessage[]) {
  return [...messages].sort((a, b) => {
    const timeDiff = Date.parse(a.created_at) - Date.parse(b.created_at);
    if (timeDiff !== 0) return timeDiff;
    return ROLE_ORDER[a.role] - ROLE_ORDER[b.role];
  });
}

export default function ChatScreen({ navigation }: ChatProps) {
  const { session } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const loadMessages = useCallback(async () => {
    if (!session?.user) return;
    const { data, error } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;
    setMessages(sortMessages((data ?? []) as ChatMessage[]));
  }, [session]);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={clearChat}>
          <Text style={styles.headerAction}>Clear</Text>
        </Pressable>
      )
    });
  });

  useEffect(() => {
    setLoading(true);
    loadMessages()
      .catch((error) => Alert.alert("Could not load chat", error instanceof Error ? error.message : "Try again."))
      .finally(() => setLoading(false));
  }, [loadMessages]);

  async function clearChat() {
    if (!session?.user) return;
    const { error } = await supabase.from("chat_messages").delete().eq("user_id", session.user.id);
    if (error) {
      Alert.alert("Could not clear chat", error.message);
      return;
    }
    setMessages([]);
  }

  async function sendMessage(nextText?: string) {
    const text = (nextText ?? input).trim();
    if (!text || sending) return;

    const optimisticUser: ChatMessage = {
      id: `local-${Date.now()}`,
      role: "user",
      content: text,
      created_at: new Date().toISOString()
    };

    setMessages((current) => [...current, optimisticUser]);
    setInput("");
    setSending(true);

    try {
      const { data, error } = await supabase.functions.invoke("chat", {
        body: { message: text }
      });

      if (error) throw error;

      const response = data?.message ?? data?.response ?? data?.content;
      if (!response) {
        throw new Error("Chat function returned no response.");
      }

      const optimisticAssistant: ChatMessage = {
        id: `local-${Date.now()}-assistant`,
        role: "assistant",
        content: response,
        created_at: new Date().toISOString()
      };
      setMessages((current) => [...current, optimisticAssistant]);
      await loadMessages();
    } catch (error) {
      Alert.alert("Message failed", error instanceof Error ? error.message : "Try again.");
      await loadMessages().catch(() => undefined);
    } finally {
      setSending(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={88}>
      <View style={styles.topPanel}>
        <Text style={styles.eyebrow}>Today</Text>
        <Text style={styles.title}>Ask about today's menu</Text>
        <View style={styles.contextStrip}>
          <Text style={styles.contextText}>Today / All dining commons / Your preferences</Text>
        </View>
        <View style={styles.suggestions}>
          {suggestions.map((suggestion) => (
            <Pressable key={suggestion} style={styles.suggestion} onPress={() => sendMessage(suggestion)} disabled={sending}>
              <Text style={styles.suggestionText}>{suggestion}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.amber} />
        </View>
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ChatBubble message={item} />}
          contentContainerStyle={messages.length ? styles.list : styles.emptyList}
          ListEmptyComponent={<Text style={styles.empty}>Pick a prompt or ask one specific menu question.</Text>}
        />
      )}

      <View style={styles.inputBar}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Ask about meals..."
          placeholderTextColor={colors.quiet}
          style={styles.input}
          multiline
        />
        <Pressable style={styles.sendButton} onPress={() => sendMessage()} disabled={sending}>
          {sending ? <ActivityIndicator color={colors.text} /> : <Text style={styles.sendText}>Send</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  topPanel: { gap: 10, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.background },
  eyebrow: { color: colors.quiet, fontSize: 12, fontWeight: "800", textTransform: "uppercase" },
  title: { color: colors.text, fontSize: 22, fontWeight: "900" },
  contextStrip: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  contextText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  suggestions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  suggestion: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  suggestionText: { color: colors.text, fontSize: 12, fontWeight: "800" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { padding: 16, gap: 12 },
  emptyList: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  empty: { color: colors.muted, textAlign: "center" },
  headerAction: { color: colors.amber, fontWeight: "700" },
  inputBar: { flexDirection: "row", gap: 10, padding: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background },
  input: {
    flex: 1,
    maxHeight: 110,
    minHeight: 44,
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    backgroundColor: colors.surface,
    fontSize: 15
  },
  sendButton: { width: 72, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 8, backgroundColor: colors.maroon },
  sendText: { color: colors.text, fontWeight: "800" }
});
