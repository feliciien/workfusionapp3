import * as React from "react";
import { cn } from "@/lib/utils";
import { Avatar } from "./avatar";

interface ChatMessageProps {
  message: {
    role: "user" | "assistant";
    content: string;
  };
  isLoading?: boolean;
}

export function ChatMessage({ message, isLoading = false }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex w-full gap-3 p-4 animate-fade-in",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      {!isUser && (
        <Avatar className="h-8 w-8 bg-primary/10">
          <span className="text-xs font-medium">AI</span>
        </Avatar>
      )}
      <div
        className={cn(
          "flex max-w-[80%] flex-col gap-2 rounded-xl px-5 py-3 shadow-md transition-all",
          isUser
            ? "bg-primary text-primary-foreground border border-primary/40"
            : "glass bg-muted/70 text-foreground"
        )}
      >
        <div className="whitespace-pre-wrap text-sm">
          {isLoading ? (
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 animate-bounce rounded-full bg-current"></div>
              <div
                className="h-2 w-2 animate-bounce rounded-full bg-current"
                style={{ animationDelay: "0.2s" }}
              ></div>
              <div
                className="h-2 w-2 animate-bounce rounded-full bg-current"
                style={{ animationDelay: "0.4s" }}
              ></div>
            </div>
          ) : (
            message.content
          )}
        </div>
      </div>
      {isUser && (
        <Avatar className="h-8 w-8 bg-primary shadow">
          <span className="text-xs font-medium text-primary-foreground">
            You
          </span>
        </Avatar>
      )}
    </div>
  );
}
