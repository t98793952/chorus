import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { v4 as uuidv4 } from "uuid";
import { db } from "../DB";
import { LLMMessage, streamResponse } from "../Models";
import { fetchModelConfigById } from "./ModelsAPI";
import { getApiKeys, getCustomBaseUrl } from "./AppMetadataAPI";

const judgeKeys = {
    evaluations: (messageSetId: string) =>
        ["messageSets", messageSetId, "judgeEvaluations"] as const,
};

export interface JudgeEvaluationDBRow {
    id: string;
    chat_id: string;
    message_set_id: string;
    judge_model_id: string;
    judgement_text: string;
    created_at: string;
}

export interface JudgeEvaluatedMessageDBRow {
    id: string;
    judge_evaluation_id: string;
    message_id: string;
    model_id: string;
}

export interface JudgeEvaluation {
    id: string;
    chatId: string;
    messageSetId: string;
    judgeModelId: string;
    judgementText: string;
    createdAt: string;
    evaluatedMessages: Array<{
        messageId: string;
        modelId: string;
    }>;
}

function readJudgeEvaluation(
    row: JudgeEvaluationDBRow,
    evaluatedMessages: JudgeEvaluatedMessageDBRow[],
): JudgeEvaluation {
    return {
        id: row.id,
        chatId: row.chat_id,
        messageSetId: row.message_set_id,
        judgeModelId: row.judge_model_id,
        judgementText: row.judgement_text,
        createdAt: row.created_at,
        evaluatedMessages: evaluatedMessages.map((em) => ({
            messageId: em.message_id,
            modelId: em.model_id,
        })),
    };
}

function buildJudgePrompt(
    conversationHistory: LLMMessage[],
    currentUserMessage: string,
    modelResponses: Array<{ modelDisplayName: string; content: string }>,
    userFocus?: string,
): string {
    let prompt = "Please evaluate and compare the following AI model responses to the user's question.\n\n";

    if (conversationHistory.length > 0) {
        prompt += "## Conversation History\n";
        conversationHistory.forEach((msg) => {
            const role = msg.role === "user" ? "User" : "Assistant";
            const content = msg.role === "tool_results"
                ? msg.toolResults.map(t => t.content).join("\n")
                : msg.content;
            prompt += `**${role}**: ${content}\n\n`;
        });
    }

    prompt += `## Current User Question\n${currentUserMessage}\n\n`;

    prompt += "## Model Responses\n\n";
    modelResponses.forEach((response) => {
        prompt += `### Model: ${response.modelDisplayName}\n${response.content}\n\n`;
    });

    if (userFocus?.trim()) {
        prompt += `## Evaluation Focus (User Specified)\nThe user wants you to pay special attention to: ${userFocus.trim()}\n\n`;
    }

    prompt += `## Task
1. Determine the most relevant evaluation criteria for this specific question${userFocus?.trim() ? ", with emphasis on the evaluation focus above" : ""}
2. Score each response on a scale of 1-10 for each criterion you choose
3. Provide a total score and final ranking`;

    return prompt;
}

export function useJudgeEvaluations(messageSetId: string) {
    return useQuery({
        queryKey: judgeKeys.evaluations(messageSetId),
        queryFn: async () => {
            const evaluations = await db.select<JudgeEvaluationDBRow[]>(
                "SELECT * FROM judge_evaluations WHERE message_set_id = ? ORDER BY created_at DESC",
                [messageSetId],
            );

            const result: JudgeEvaluation[] = [];
            for (const evaluation of evaluations) {
                const evaluatedMessages = await db.select<JudgeEvaluatedMessageDBRow[]>(
                    "SELECT * FROM judge_evaluated_messages WHERE judge_evaluation_id = ?",
                    [evaluation.id],
                );
                result.push(readJudgeEvaluation(evaluation, evaluatedMessages));
            }

            return result;
        },
    });
}

export function useCreateJudgeEvaluation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            chatId,
            messageSetId,
            judgeModelId,
            conversationHistory,
            currentUserMessage,
            modelResponses,
            userFocus,
            onStreamChunk,
        }: {
            chatId: string;
            messageSetId: string;
            judgeModelId: string;
            conversationHistory: LLMMessage[];
            currentUserMessage: string;
            modelResponses: Array<{
                messageId: string;
                modelId: string;
                modelDisplayName: string;
                content: string;
            }>;
            userFocus?: string;
            onStreamChunk?: (chunk: string) => void;
        }) => {
            const prompt = buildJudgePrompt(
                conversationHistory,
                currentUserMessage,
                modelResponses,
                userFocus,
            );

            const systemPrompt = `You are an AI response judge. Your role is to objectively evaluate and compare responses from different AI models.

Based on the nature of the question, determine the most appropriate evaluation criteria yourself (e.g., accuracy, creativity, code quality, reasoning depth, etc.).

Provide a fair, unbiased comparison with scores and explain your reasoning.

**Language**: Respond in the same language as the conversation.`;

            const modelConfig = await fetchModelConfigById(judgeModelId);
            if (!modelConfig) {
                throw new Error(`Model config not found: ${judgeModelId}`);
            }

            const apiKeys = await getApiKeys();
            const customBaseUrl = await getCustomBaseUrl();

            // Override system prompt for judge evaluation
            const judgeModelConfig = {
                ...modelConfig,
                systemPrompt: systemPrompt,
            };

            let judgementText = "";
            await streamResponse({
                modelConfig: judgeModelConfig,
                llmConversation: [
                    { role: "user", content: prompt, attachments: [] }
                ],
                apiKeys,
                customBaseUrl,
                onChunk: (chunk) => {
                    judgementText += chunk;
                    if (onStreamChunk) {
                        onStreamChunk(chunk);
                    }
                },
                onComplete: async () => {},
                onError: (error) => {
                    throw new Error(`Judge evaluation failed: ${error}`);
                },
            });

            const evaluationId = uuidv4();
            await db.execute(
                "INSERT INTO judge_evaluations (id, chat_id, message_set_id, judge_model_id, judgement_text) VALUES (?, ?, ?, ?, ?)",
                [evaluationId, chatId, messageSetId, judgeModelId, judgementText],
            );

            for (const response of modelResponses) {
                await db.execute(
                    "INSERT INTO judge_evaluated_messages (id, judge_evaluation_id, message_id, model_id) VALUES (?, ?, ?, ?)",
                    [uuidv4(), evaluationId, response.messageId, response.modelId],
                );
            }

            return evaluationId;
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({
                queryKey: judgeKeys.evaluations(variables.messageSetId),
            });
        },
    });
}
