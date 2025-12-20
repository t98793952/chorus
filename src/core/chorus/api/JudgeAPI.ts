import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { v4 as uuidv4 } from "uuid";
import { db } from "../DB";
import { simpleLLM } from "../simpleLLM";
import { LLMMessage } from "../Models";
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
): string {
    let prompt = "Please evaluate and compare the following AI model responses to the user's question.\n\n";

    if (conversationHistory.length > 0) {
        prompt += "## Conversation History\n";
        conversationHistory.forEach((msg) => {
            const role = msg.role === "user" ? "User" : "Assistant";
            prompt += `**${role}**: ${msg.content}\n\n`;
        });
    }

    prompt += `## Current User Question\n${currentUserMessage}\n\n`;

    prompt += "## Model Responses\n\n";
    modelResponses.forEach((response) => {
        prompt += `### Model: ${response.modelDisplayName}\n${response.content}\n\n`;
    });

    prompt += `## Task
1. Evaluate each response based on accuracy, relevance, completeness, clarity, and helpfulness
2. Compare the responses and identify strengths and weaknesses
3. Provide a ranking (if applicable)
4. Give your recommendation on which response is most helpful for the user

Please structure your evaluation clearly with sections for each model.`;

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
        }) => {
            const prompt = buildJudgePrompt(
                conversationHistory,
                currentUserMessage,
                modelResponses,
            );

            const systemPrompt = `You are an AI response judge. Your role is to objectively evaluate and compare responses from different AI models based on the following criteria:

1. **Accuracy**: Is the information correct and factual?
2. **Relevance**: Does it directly address the user's question?
3. **Completeness**: Does it cover all aspects of the question?
4. **Clarity**: Is it easy to understand and well-structured?
5. **Helpfulness**: Does it provide actionable or useful information?

Provide a fair, unbiased comparison and explain your reasoning.

**Language**: Respond in the same language as the user's question unless specified otherwise.`;

            const modelConfig = await fetchModelConfigById(judgeModelId);
            const apiKeys = await getApiKeys();
            const customBaseUrl = await getCustomBaseUrl();

            const judgementText = await simpleLLM(
                modelConfig,
                [{ role: "user", content: prompt }],
                systemPrompt,
                apiKeys,
                customBaseUrl,
            );

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
