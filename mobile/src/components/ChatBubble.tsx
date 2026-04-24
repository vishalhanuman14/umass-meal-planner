import { StyleSheet, Text, View } from "react-native";

import { colors, shadows } from "../theme";
import type { ChatMessage } from "../types";

type ChatBubbleProps = {
  message: Pick<ChatMessage, "role" | "content">;
};

export default function ChatBubble({ message }: ChatBubbleProps) {
  const isUser = message.role === "user";

  return (
    <View style={[styles.wrap, isUser ? styles.userWrap : styles.assistantWrap]}>
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
        <Text style={[styles.text, isUser ? styles.userText : styles.assistantText]}>{message.content}</Text>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 22
  },
  userBubble: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 8
  },
  assistantBubble: {
    ...shadows.soft,
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 8
  },
  text: {
    fontSize: 15,
    lineHeight: 21
  },
  userText: {
    color: colors.onPrimary,
    fontWeight: "600"
  },
  assistantText: {
    color: colors.text
  }
});
