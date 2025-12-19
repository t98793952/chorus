import { streamResponse, ModelConfig } from "./Models";
import { getApiKeys, getInternalTaskModelConfigId } from "./api/AppMetadataAPI";
import { db } from "./DB";

type ModelConfigDBRow = {
    id: string;
    display_name: string;
    author: "user" | "system";
    model_id: string;
    system_prompt: string;
    is_enabled: boolean;
    supported_attachment_types: string;
    is_default: boolean;
    is_internal: boolean;
    is_deprecated: boolean;
    budget_tokens: number | null;
    reasoning_effort: "low" | "medium" | "high" | null;
    is_pinned: boolean;
};

async function getModelConfigById(id: string): Promise<ModelConfig | null> {
    const rows = await db.select<ModelConfigDBRow[]>(
        `SELECT mc.id, mc.display_name, mc.author, mc.model_id, mc.system_prompt, 
                m.is_enabled, m.supported_attachment_types, mc.is_default, 
                m.is_internal, m.is_deprecated, mc.budget_tokens, mc.reasoning_effort, mc.is_pinned
         FROM model_configs mc
         JOIN models m ON mc.model_id = m.id
         WHERE mc.id = ?`,
        [id],
    );
    if (rows.length === 0) return null;
    const row = rows[0];
    return {
        id: row.id,
        displayName: row.display_name,
        author: row.author,
        modelId: row.model_id,
        systemPrompt: row.system_prompt,
        isEnabled: row.is_enabled,
        supportedAttachmentTypes: JSON.parse(row.supported_attachment_types),
        isDefault: row.is_default,
        isInternal: row.is_internal,
        isDeprecated: row.is_deprecated,
        budgetTokens: row.budget_tokens ?? undefined,
        reasoningEffort: row.reasoning_effort ?? undefined,
        isPinned: row.is_pinned ?? false,
    };
}

/**
 * Makes a simple LLM call using the user's selected internal task model.
 * Used for generating chat titles and project summaries.
 * Returns empty string if no model configured or on error.
 */
export async function simpleLLM(prompt: string): Promise<string> {
    try {
        const modelConfigId = await getInternalTaskModelConfigId();
        if (!modelConfigId) {
            return "";
        }

        const modelConfig = await getModelConfigById(modelConfigId);
        if (!modelConfig || !modelConfig.isEnabled) {
            return "";
        }

        const apiKeys = await getApiKeys();

        let fullResponse = "";

        await streamResponse({
            modelConfig,
            llmConversation: [{ role: "user", content: prompt, attachments: [] }],
            apiKeys,
            onChunk: (chunk) => {
                fullResponse += chunk;
            },
            onComplete: async () => {},
            onError: (err) => {
                console.error("simpleLLM error:", err);
            },
        });

        return fullResponse;
    } catch (err) {
        console.error("simpleLLM error:", err);
        return "";
    }
}
