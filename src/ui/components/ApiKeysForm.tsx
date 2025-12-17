import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { ProviderName } from "@core/chorus/Models";
import { ProviderLogo } from "./ui/provider-logo";
import { Card } from "./ui/card";
import { CheckIcon, FlameIcon, PlugIcon } from "lucide-react";
import { useState } from "react";

interface ApiKeysFormProps {
    apiKeys: Record<string, string>;
    onApiKeyChange: (provider: string, value: string) => void;
}

export default function ApiKeysForm({
    apiKeys,
    onApiKeyChange,
}: ApiKeysFormProps) {
    const [selectedProvider, setSelectedProvider] = useState<string | null>(
        null,
    );

    const providers = [
        {
            id: "anthropic",
            name: "Anthropic",
            placeholder: "sk-ant-...",
            url: "https://console.anthropic.com/settings/keys",
        },
        {
            id: "openai",
            name: "OpenAI",
            placeholder: "sk-...",
            url: "https://platform.openai.com/api-keys",
        },
        {
            id: "google",
            name: "Google AI (Gemini)",
            placeholder: "AI...",
            url: "https://aistudio.google.com/apikey",
        },
        {
            id: "perplexity",
            name: "Perplexity",
            placeholder: "pplx-...",
            url: "https://www.perplexity.ai/account/api/keys",
        },
        {
            id: "openrouter",
            name: "OpenRouter",
            placeholder: "sk-or-...",
            url: "https://openrouter.ai/keys",
        },
        {
            id: "grok",
            name: "xAI",
            placeholder: "xai-...",
            url: "https://console.x.ai/settings/keys",
        },
        {
            id: "openai-compatible",
            name: "OpenAI-Compatible",
            placeholder: "sk-...",
            url: "",
        },
        {
            id: "firecrawl",
            name: "Firecrawl",
            placeholder: "fc-...",
            url: "https://www.firecrawl.dev/app/api-keys",
        },
    ];

    const selectedProviderData = providers.find((p) => p.id === selectedProvider);
    const isOpenAICompatible = selectedProvider === "openai-compatible";

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
                {providers.map((provider) => (
                    <Card
                        key={provider.id}
                        className={`relative p-6 cursor-pointer hover:bg-muted transition-colors ${
                            selectedProvider === provider.id
                                ? "ring-2 ring-primary"
                                : ""
                        }`}
                        onClick={() => setSelectedProvider(provider.id)}
                    >
                        <div className="flex flex-col items-center gap-2 text-center">
                            {provider.id === "firecrawl" ? (
                                <FlameIcon className="w-4 h-4" />
                            ) : provider.id === "openai-compatible" ? (
                                <PlugIcon className="w-4 h-4" />
                            ) : (
                                <ProviderLogo
                                    provider={provider.id as ProviderName}
                                    size="lg"
                                />
                            )}
                            <span className="font-medium">{provider.name}</span>
                        </div>
                        {(apiKeys[provider.id] || (provider.id === "openai-compatible" && apiKeys["openai-compatible-url"])) && (
                            <div className="absolute top-2 right-2">
                                <CheckIcon className="w-4 h-4 text-green-500" />
                            </div>
                        )}
                    </Card>
                ))}
            </div>

            {selectedProvider && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-4">
                    {isOpenAICompatible && (
                        <div className="space-y-2">
                            <Label htmlFor="openai-compatible-base-url">
                                Base URL
                            </Label>
                            <Input
                                id="openai-compatible-base-url"
                                placeholder="https://api.openai.com/v1"
                                value={apiKeys["openai-compatible-url"] || ""}
                                onChange={(e) =>
                                    onApiKeyChange("openai-compatible-url", e.target.value)
                                }
                            />
                            <p className="text-sm text-muted-foreground">
                                The base URL of your OpenAI-compatible API endpoint
                            </p>
                        </div>
                    )}
                    <div className="space-y-2">
                        <Label htmlFor={`${selectedProvider}-key`}>
                            {selectedProviderData?.name} API Key{isOpenAICompatible && " (optional)"}
                        </Label>
                        <Input
                            id={`${selectedProvider}-key`}
                            type="password"
                            placeholder={selectedProviderData?.placeholder}
                            value={apiKeys[selectedProvider] || ""}
                            onChange={(e) =>
                                onApiKeyChange(selectedProvider, e.target.value)
                            }
                        />
                        {selectedProviderData?.url && (
                            <p className="text-sm text-muted-foreground">
                                <a
                                    href={selectedProviderData.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    Get {selectedProviderData.name} API key
                                </a>
                                .
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
