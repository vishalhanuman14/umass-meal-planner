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
import { useSafeAreaInsets } from "react-native-safe-area-context";

import ChatBubble from "../components/ChatBubble";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { colors, shadows } from "../theme";
import type { ChatMessage, ChatProps } from "../types";

const ROLE_ORDER: Record<ChatMessage["role"], number> = {
  user: 0,
  assistant: 1
};

const suggestions = [
  "Best dinner at Worcester",
  "High protein lunch",
  "Vegetarian options"
];

function sortMessages(messages: ChatMessage[]) {
  return [...messages].sort((a, b) => {
    const timeDiff = Date.parse(a.created_at) - Date.parse(b.created_at);
    if (timeDiff !== 0) return timeDiff;
    return ROLE_ORDER[a.role] - ROLE_ORDER[b.role];
  });
}

export default function ChatScreen({ navigation }: ChatProps) {
  const insets = useSafeAreaInsets();
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
      headerRight: () => messages.length ? (
        <Pressable onPress={confirmClearChat}>
          <Text style={styles.headerAction}>Clear</Text>
        </Pressable>
      ) : null
    });
  }, [messages.length, navigation]);

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

  function confirmClearChat() {
    Alert.alert("Clear chat?", "This removes your saved chat history.", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear", style: "destructive", onPress: clearChat }
    ]);
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
      {!loading && messages.length === 0 ? (
        <View style={styles.topPanel}>
          <View style={styles.suggestions}>
            {suggestions.map((suggestion) => (
              <Pressable key={suggestion} style={styles.suggestion} onPress={() => sendMessage(suggestion)} disabled={sending}>
                <Text style={styles.suggestionText}>{suggestion}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ChatBubble message={item} />}
          contentContainerStyle={messages.length ? styles.list : styles.emptyList}
          ListEmptyComponent={<Text style={styles.empty}>Ask about today's menu.</Text>}
        />
      )}

      <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Ask about meals..."
          placeholderTextColor={colors.quiet}
          style={styles.input}
          multiline
        />
        <Pressable accessibilityLabel="Send" style={styles.sendButton} onPress={() => sendMessage()} disabled={sending}>
          {sending ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={styles.sendText}>↑</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  topPanel: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12, backgroundColor: colors.background },
  suggestions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  suggestion: { ...shadows.soft, paddingHorizontal: 13, paddingVertical: 10, borderRadius: 999, backgroundColor: colors.surface },
  suggestionText: { color: colors.text, fontSize: 12, fontWeight: "900" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { padding: 16, gap: 12 },
  emptyList: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  empty: { color: colors.muted, textAlign: "center" },
  headerAction: { color: colors.muted, fontWeight: "800" },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: colors.background
  },
  input: {
    flex: 1,
    maxHeight: 110,
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 26,
    color: colors.text,
    backgroundColor: colors.surface,
    fontSize: 15,
    ...shadows.soft
  },
  sendButton: {
    width: 58,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: colors.primary,
    ...shadows.soft
  },
  sendText: { color: colors.onPrimary, fontSize: 25, fontWeight: "900", lineHeight: 27 }
});
