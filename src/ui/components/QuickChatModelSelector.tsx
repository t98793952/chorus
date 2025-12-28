import { ProviderLogo } from "./ui/provider-logo";
import { CheckIcon } from "lucide-react";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@ui/components/ui/popover";
import {
    Command,
    CommandEmpty,
    CommandInput,
    CommandItem,
    CommandList,
} from "@ui/components/ui/command";
import { getProviderName, ModelConfig } from "@core/chorus/Models";
import { useCallback, useState } from "react";
import { useMemo } from "react";
import * as ModelsAPI from "@core/chorus/api/ModelsAPI";
import * as AppMetadataAPI from "@core/chorus/api/AppMetadataAPI";
import { hasApiKey } from "@core/utilities/ProxyUtils";

interface ModelSelectorProps {
    onModelSelect: (modelId: string) => void;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export function QuickChatModelSelector({
    onModelSelect,
    open,
    onOpenChange,
}: ModelSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);

    const onChangeOpen = useCallback(
        (newOpen: boolean) => {
            console.log("Popover onOpenChange called", newOpen);
            setIsOpen(newOpen);
            onOpenChange?.(newOpen);
        },
        [onOpenChange],
    );

    // Use the Quick Chat model hook to keep track of the selected model
    const { data: selectedModelConfigQuickChat } =
        ModelsAPI.useSelectedModelConfigQuickChat();
    const modelConfigsQuery = ModelsAPI.useModelConfigs();
    const { data: apiKeys } = AppMetadataAPI.useApiKeys();

    // Check if a model has a valid API key (same logic as ManageModelsBox)
    const hasValidApiKey = useCallback(
        (model: ModelConfig) => {
            const provider = getProviderName(model.modelId);

            // Local models (ollama, lmstudio) don't require API keys
            if (provider === "ollama" || provider === "lmstudio") {
                return true;
            }

            // OpenAI-compatible requires baseUrl to be configured
            if (provider === "openai-compatible") {
                return !!apiKeys?.["openai-compatible-url"];
            }

            // Check if user has API key for this provider
            if (
                apiKeys &&
                provider &&
                hasApiKey(
                    provider.toLowerCase() as keyof typeof apiKeys,
                    apiKeys,
                )
            ) {
                return true;
            }

            // No API key for this provider
            return false;
        },
        [apiKeys],
    );

    const quickChatSelectableModelConfigs = useMemo(
        () =>
            modelConfigsQuery?.data?.filter(
                (config) =>
                    config.isEnabled &&
                    !config.id.includes("chorus") &&
                    !config.displayName.includes("Deprecated") &&
                    hasValidApiKey(config),
            ) ?? [],
        [modelConfigsQuery, hasValidApiKey],
    );

    const handleModelSelect = useCallback(
        (modelId: string) => {
            onModelSelect(modelId);
        },
        [onModelSelect],
    );

    return (
        <Popover
            open={open !== undefined ? open : isOpen}
            onOpenChange={onChangeOpen}
        >
            <PopoverTrigger asChild>
                <button
                    tabIndex={-1}
                    type="button"
                    onClick={() => onChangeOpen(true)}
                    className="text-sm text-foreground/75 inline-flex items-center gap-1 hover:bg-foreground/5 rounded-md px-1.5 py-0.5"
                >
                    {selectedModelConfigQuickChat ? (
                        <div className="flex items-center gap-1">
                            <ProviderLogo
                                provider={getProviderName(
                                    selectedModelConfigQuickChat.modelId,
                                )}
                                size="sm"
                            />
                            <span>
                                {selectedModelConfigQuickChat.displayName}
                            </span>
                        </div>
                    ) : (
                        <span>Select model</span>
                    )}
                </button>
            </PopoverTrigger>
            <PopoverContent
                className="p-0 ml-6 bg-background rounded-lg text-foreground"
                onKeyDown={(e) => {
                    if (e.key === "Escape") {
                        e.stopPropagation();
                    }
                }}
            >
                <Command>
                    <CommandInput placeholder="Choose an ambient chat model..." />
                    <CommandEmpty>No models found</CommandEmpty>
                    <CommandList className="max-h-[300px] overflow-y-auto">
                        {quickChatSelectableModelConfigs.map((config) => (
                            <CommandItem
                                key={config.id}
                                onSelect={() => {
                                    console.log(
                                        "CommandItem onSelect called",
                                        config.id,
                                    );
                                    handleModelSelect(config.id);
                                    onChangeOpen(false); // Close after selection
                                }}
                            >
                                <div className="flex items-center gap-2">
                                    <ProviderLogo
                                        provider={getProviderName(
                                            config.modelId,
                                        )}
                                        size="sm"
                                    />
                                    {config.displayName}
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        {config.id ===
                                            selectedModelConfigQuickChat?.id && (
                                            <CheckIcon className="w-4 h-4 ml-2" />
                                        )}
                                    </div>
                                </div>
                            </CommandItem>
                        ))}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
