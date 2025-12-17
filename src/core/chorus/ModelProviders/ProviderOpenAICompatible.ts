import OpenAI from "openai";
import { StreamResponseParams } from "../Models";
import { IProvider } from "./IProvider";
import OpenAICompletionsAPIUtils from "@core/chorus/OpenAICompletionsAPIUtils";
import { SettingsManager } from "@core/utilities/Settings";

export class ProviderOpenAICompatible implements IProvider {
    async streamResponse({
        llmConversation,
        modelConfig,
        onChunk,
        onComplete,
        onError,
        tools,
    }: StreamResponseParams): Promise<void> {
        const settings = await SettingsManager.getInstance().get();
        const baseURL = settings.apiKeys?.["openai-compatible-url"];
        const apiKey = settings.apiKeys?.["openai-compatible"];

        if (!baseURL) {
            throw new Error("Please configure OpenAI-Compatible endpoint URL in Settings.");
        }

        const modelName = modelConfig.modelId.split("::")[1];

        const client = new OpenAI({
            baseURL,
            apiKey: apiKey || "not-needed",
            dangerouslyAllowBrowser: true,
        });

        let messages: OpenAI.ChatCompletionMessageParam[] =
            await OpenAICompletionsAPIUtils.convertConversation(llmConversation, {
                imageSupport: true,
                functionSupport: true,
            });

        if (modelConfig.systemPrompt) {
            messages = [
                { role: "system", content: modelConfig.systemPrompt },
                ...messages,
            ];
        }

        const params: OpenAI.ChatCompletionCreateParamsStreaming & {
            reasoning_effort?: string;
        } = {
            model: modelName,
            messages,
            stream: true,
            reasoning_effort: "medium",
        };

        if (tools && tools.length > 0) {
            params.tools = OpenAICompletionsAPIUtils.convertToolDefinitions(tools);
            params.tool_choice = "auto";
        }

        const chunks: OpenAI.ChatCompletionChunk[] = [];

        try {
            const stream = await client.chat.completions.create(params);

            for await (const chunk of stream) {
                chunks.push(chunk);
                if (chunk.choices[0]?.delta?.content) {
                    onChunk(chunk.choices[0].delta.content);
                }
            }
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            if (onError) {
                onError(errorMessage);
            } else {
                throw error;
            }
            return;
        }

        const toolCalls = OpenAICompletionsAPIUtils.convertToolCalls(chunks, tools ?? []);
        await onComplete(undefined, toolCalls.length > 0 ? toolCalls : undefined);
    }
}
