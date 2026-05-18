import * as React from "react";
import { Button } from "./button";
import { PaperPlaneIcon } from "@radix-ui/react-icons";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  placeholder?: string;
  disabled?: boolean;
}

export function ChatInput({
  value,
  onChange,
  onSend,
  placeholder = "Type your message...",
  disabled = false,
}: ChatInputProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim()) {
        onSend();
      }
    }
  };

  return (
    <div className="relative flex items-center">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[80px] pr-12 resize-none"
        rows={3}
      />
      <Button
        type="submit"
        size="icon"
        disabled={disabled || !value.trim()}
        onClick={onSend}
        className="absolute right-2 bottom-2"
      >
        <PaperPlaneIcon className="h-4 w-4" />
      </Button>
    </div>
  );
}