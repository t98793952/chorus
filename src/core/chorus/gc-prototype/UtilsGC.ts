// Helper function to get display name for a model
export function getModelDisplayName(modelConfigId: string): string {
    const modelNames: Record<string, string> = {
        user: "You",
        "openai-compatible::claude-opus-4-5": "Claude",
        "openai-compatible::gemini-3-pro": "Gemini",
        "openai-compatible::gemini-3-flash": "Flash",
        "openai-compatible::gpt-5.2": "GPT",
    };
    return (
        modelNames[modelConfigId] ||
        modelConfigId.split("::")[1] ||
        modelConfigId
    );
}

// Helper function to get avatar initials and color
export function getModelAvatar(modelConfigId: string): {
    initials: string;
    bgColor: string;
    textColor: string;
} {
    if (modelConfigId === "user") {
        return {
            initials: "U",
            bgColor: "bg-blue-500",
            textColor: "text-white",
        };
    }

    // Specific model colors
    const modelColors: Record<
        string,
        { initials: string; bgColor: string; textColor: string }
    > = {
        // Anthropic - Claude Opus 4.5
        "openai-compatible::claude-opus-4-5": {
            initials: "C",
            bgColor: "bg-orange-500",
            textColor: "text-white",
        },

        // Google models
        "openai-compatible::gemini-3-pro": {
            initials: "G",
            bgColor: "bg-blue-600",
            textColor: "text-white",
        },
        "openai-compatible::gemini-3-flash": {
            initials: "F",
            bgColor: "bg-sky-500",
            textColor: "text-white",
        },

        // OpenAI - GPT-5.2
        "openai-compatible::gpt-5.2": {
            initials: "GP",
            bgColor: "bg-emerald-500",
            textColor: "text-white",
        },
    };

    if (modelColors[modelConfigId]) {
        return modelColors[modelConfigId];
    }

    // Fallback colors by provider
    if (modelConfigId.startsWith("openai::")) {
        return {
            initials: "O",
            bgColor: "bg-emerald-500",
            textColor: "text-white",
        };
    }
    if (modelConfigId.startsWith("google::")) {
        return {
            initials: "G",
            bgColor: "bg-blue-500",
            textColor: "text-white",
        };
    }
    if (modelConfigId.startsWith("anthropic::")) {
        return {
            initials: "C",
            bgColor: "bg-orange-500",
            textColor: "text-white",
        };
    }

    return { initials: "AI", bgColor: "bg-gray-500", textColor: "text-white" };
}
