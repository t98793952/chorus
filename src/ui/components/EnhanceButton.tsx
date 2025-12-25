import { useState } from "react";
import { simpleLLM } from "@core/chorus/simpleLLM";
import { Loader2, SparklesIcon } from "lucide-react";
import { llmConversation } from "@core/chorus/ChatState";
import { llmMessageToString, LLMMessage } from "@core/chorus/Models";
import * as MessageAPI from "@core/chorus/api/MessageAPI";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

interface EnhanceButtonProps {
    chatId: string;
    userInput: string;
    onEnhanced: (enhanced: string) => void;
}

const ENHANCE_PROMPT = `Rewrite and enhance the user's instruction to be clearer, more specific, and concise, while preserving the original intent. Consider the conversation context. Do not invent new requirements. Preserve code blocks, placeholders, and domain terminology. Match the language of the original instruction. Output ONLY the enhanced prompt, nothing else.`;

const FOLLOW_UP_PROMPT = `Suggest 1 follow-up question the user might ask next. Be specific to the conversation context, not generic. Write from the user's perspective. Match the language of the conversation. Output ONLY the question, nothing else.`;

function formatConversationForPrompt(messages: LLMMessage[]): string {
    return messages
        .slice(-6)
        .map((m) => `${m.role}: ${llmMessageToString(m).slice(0, 1000)}`)
        .join("\n");
}

function buildEnhancePrompt(
    conversationText: string | undefined,
    userInput: string,
): string {
    if (conversationText) {
        return `${ENHANCE_PROMPT}

Conversation:
${conversationText}

Original instruction: ${userInput}`;
    }
    return `${ENHANCE_PROMPT}

Original instruction: ${userInput}`;
}

function buildFollowUpPrompt(conversationText: string): string {
    return `${FOLLOW_UP_PROMPT}

Conversation:
${conversationText}`;
}

export function EnhanceButton({
    chatId,
    userInput,
    onEnhanced,
}: EnhanceButtonProps) {
    const [isLoading, setIsLoading] = useState(false);

    const messageSetsQuery = MessageAPI.useMessageSets(chatId);
    const messageSets = messageSetsQuery.data;

    const handleEnhance = async () => {
        if (isLoading) return;

        setIsLoading(true);

        try {
            const hasUserInput = (userInput ?? "").trim().length > 0;

            if (hasUserInput) {
                // Enhance user's input with conversation context
                const messages = messageSets ? llmConversation(messageSets) : [];
                const conversationText =
                    messages.length > 0
                        ? formatConversationForPrompt(messages)
                        : undefined;
                const prompt = buildEnhancePrompt(conversationText, userInput);
                const response = await simpleLLM(prompt);
                if (response) {
                    const trimmed = response.trim();
                    if (trimmed) {
                        onEnhanced(trimmed);
                    }
                }
            } else {
                // Generate follow-up based on conversation
                if (!messageSets || messageSets.length === 0) return;

                const messages = llmConversation(messageSets);
                if (messages.length === 0) return;

                const conversationText = formatConversationForPrompt(messages);
                const prompt = buildFollowUpPrompt(conversationText);

                const response = await simpleLLM(prompt);
                if (response) {
                    const trimmed = response.trim();
                    if (trimmed) {
                        onEnhanced(trimmed);
                    }
                }
            }
        } catch (error) {
            console.error("Error enhancing prompt:", error);
        } finally {
            setIsLoading(false);
        }
    };

    // Don't show if no conversation and no input
    const hasConversation = messageSets && messageSets.length > 0;
    const hasInput = (userInput ?? "").trim().length > 0;
    if (!hasConversation && !hasInput) {
        return null;
    }

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <button
                    className="inline-flex bg-muted items-center justify-center rounded-full h-7 text-sm hover:bg-muted/80 px-3 py-1 ring-offset-background placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 flex-shrink-0"
                    aria-label="Enhance prompt"
                    onClick={() => void handleEnhance()}
                    disabled={isLoading}
                >
                    <div className="flex items-center gap-1">
                        {isLoading ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                            <SparklesIcon className="w-3 h-3 text-muted-foreground" />
                        )}
                        <span>Enhance</span>
                    </div>
                </button>
            </TooltipTrigger>
            <TooltipContent>
                {hasInput
                    ? "Enhance your prompt"
                    : "Suggest a follow-up question"}
            </TooltipContent>
        </Tooltip>
    );
}
