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
import type { ChatMessage, ChatProps } from "../types";

const ROLE_ORDER: Record<ChatMessage["role"], number> = {
  user: 0,
  assistant: 1
};

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

  async function sendMessage() {
    const text = input.trim();
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
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#8bd3ff" />
        </View>
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ChatBubble message={item} />}
          contentContainerStyle={messages.length ? styles.list : styles.emptyList}
          ListEmptyComponent={<Text style={styles.empty}>Ask about today's dining hall menu.</Text>}
        />
      )}

      <View style={styles.inputBar}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Ask about meals..."
          placeholderTextColor="#748092"
          style={styles.input}
          multiline
        />
        <Pressable style={styles.sendButton} onPress={sendMessage} disabled={sending}>
          {sending ? <ActivityIndicator color="#071018" /> : <Text style={styles.sendText}>Send</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0b0f14" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { padding: 16, gap: 12 },
  emptyList: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  empty: { color: "#aeb8c6", textAlign: "center" },
  headerAction: { color: "#8bd3ff", fontWeight: "700" },
  inputBar: { flexDirection: "row", gap: 10, padding: 12, borderTopWidth: 1, borderTopColor: "#243041", backgroundColor: "#0b0f14" },
  input: {
    flex: 1,
    maxHeight: 110,
    minHeight: 44,
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#243041",
    color: "#f4f7fb",
    backgroundColor: "#111821",
    fontSize: 15
  },
  sendButton: { width: 72, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 8, backgroundColor: "#8bd3ff" },
  sendText: { color: "#071018", fontWeight: "800" }
});
