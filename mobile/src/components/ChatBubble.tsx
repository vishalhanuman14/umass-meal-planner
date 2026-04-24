import { StyleSheet, Text, View } from "react-native";

import { colors } from "../theme";
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
    backgroundColor: colors.maroon
  },
  assistantBubble: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border
  },
  text: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 21
  }
});
