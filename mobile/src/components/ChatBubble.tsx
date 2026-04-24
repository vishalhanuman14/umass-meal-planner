import { StyleSheet, Text, View } from "react-native";

import type { ChatMessage } from "../types";

type ChatBubbleProps = {
  message: Pick<ChatMessage, "role" | "content">;
};

export default function ChatBubble({ message }: ChatBubbleProps) {
  const isUser = message.role === "user";

  return (
    <View style={[styles.wrap, isUser ? styles.userWrap : styles.assistantWrap]}>
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
        <Text style={styles.text}>{message.content}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row"
  },
  userWrap: {
    justifyContent: "flex-end"
  },
  assistantWrap: {
    justifyContent: "flex-start"
  },
  bubble: {
    maxWidth: "84%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8
  },
  userBubble: {
    backgroundColor: "#1c5d7a"
  },
  assistantBubble: {
    backgroundColor: "#111821",
    borderWidth: 1,
    borderColor: "#243041"
  },
  text: {
    color: "#f4f7fb",
    fontSize: 15,
    lineHeight: 21
  }
});
