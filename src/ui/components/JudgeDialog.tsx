import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { MessageMarkdown } from "./renderers/MessageMarkdown";
import { Button } from "./ui/button";
import { Copy, Check, Loader2, ChevronDown, ChevronRight, Search } from "lucide-react";
import { toast } from "sonner";
import { useJudgeStore } from "@core/infra/JudgeStore";
import { cn } from "@ui/lib/utils";
import * as JudgeAPI from "@core/chorus/api/JudgeAPI";
import * as ModelsAPI from "@core/chorus/api/ModelsAPI";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";
import { ProviderLogo } from "./ui/provider-logo";
import * as AppMetadataAPI from "@core/chorus/api/AppMetadataAPI";

// Inline model selector component
function InlineModelSelector({
    onSelectModel,
    disabled,
}: {
    onSelectModel: (modelId: string) => void;
    disabled: boolean;
}) {
    const [searchQuery, setSearchQuery] = React.useState("");
    const modelConfigsQuery = ModelsAPI.useModelConfigs();
    const { data: apiKeys } = AppMetadataAPI.useApiKeys();
    const inputRef = React.useRef<HTMLInputElement>(null);

    // Focus input on mount
    React.useEffect(() => {
        if (inputRef.current && !disabled) {
            inputRef.current.focus();
        }
    }, [disabled]);

    // Filter models - same logic as InternalTaskModelSelector
    const enabledModels = React.useMemo(() => {
        if (!modelConfigsQuery.data) return [];
        return modelConfigsQuery.data.filter((m) => {
            if (!m.isEnabled || m.isInternal || m.isDeprecated) return false;
            const provider = m.modelId.split("::")[0];
            if (provider === "ollama" || provider === "lmstudio") return true;
            if (provider === "openai-compatible") return !!apiKeys?.["openai-compatible-url"];
            return !!apiKeys?.[provider as keyof typeof apiKeys];
        });
    }, [modelConfigsQuery.data, apiKeys]);

    const filteredModels = React.useMemo(() => {
        const searchTerms = searchQuery.toLowerCase().split(" ").filter(Boolean);

        return enabledModels
            .filter((m) => {
                if (searchTerms.length === 0) return true;
                return searchTerms.every(
                    (term) =>
                        m.displayName.toLowerCase().includes(term) ||
                        m.modelId.toLowerCase().includes(term)
                );
            })
            .sort((a, b) => {
                // Pinned models first
                if (a.isPinned && !b.isPinned) return -1;
                if (!a.isPinned && b.isPinned) return 1;
                return a.displayName.localeCompare(b.displayName, undefined, { numeric: true });
            });
    }, [enabledModels, searchQuery]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" && filteredModels.length > 0) {
            e.preventDefault();
            onSelectModel(filteredModels[0].id);
        }
    };

    return (
        <div className="space-y-2">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                    ref={inputRef}
                    type="text"
                    placeholder="Search models to start evaluation..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={disabled}
                    className="w-full pl-10 pr-4 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                />
            </div>
            <div className="max-h-[200px] overflow-y-auto space-y-1">
                {filteredModels.map((model) => (
                    <button
                        key={model.id}
                        onClick={() => onSelectModel(model.id)}
                        disabled={disabled}
                        className={cn(
                            "w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md text-left",
                            "hover:bg-muted transition-colors",
                            "disabled:opacity-50 disabled:cursor-not-allowed"
                        )}
                    >
                        <ProviderLogo modelId={model.modelId} size="sm" />
                        <span>{model.displayName}</span>
                    </button>
                ))}
                {filteredModels.length === 0 && (
                    <div className="text-sm text-muted-foreground text-center py-4">
                        No models found
                    </div>
                )}
            </div>
        </div>
    );
}

export function JudgeDialog() {
    const { isOpen, isStreaming, judgementText, currentMessageSetId, onStartEvaluation } = useJudgeStore();
    const [copied, setCopied] = React.useState(false);
    const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set());

    // Query historical evaluations
    const evaluationsQuery = JudgeAPI.useJudgeEvaluations(currentMessageSetId || "");
    const modelConfigsQuery = ModelsAPI.useModelConfigs();

    const handleCopy = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            toast.success("Copied to clipboard", {
                description: "The evaluation has been copied to your clipboard.",
            });
            const timeoutId = setTimeout(() => setCopied(false), 2000);
            return () => clearTimeout(timeoutId);
        } catch {
            toast.error("Failed to copy", {
                description: "Could not copy the evaluation to clipboard.",
            });
        }
    };

    const handleOpenChange = (open: boolean) => {
        if (!open) {
            useJudgeStore.getState().closeDialog();
        }
    };

    const toggleExpanded = (id: string) => {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const getModelName = (modelId: string) => {
        const model = modelConfigsQuery.data?.find((m) => m.id === modelId);
        return model?.displayName || modelId;
    };

    const handleSelectModel = (modelId: string) => {
        if (onStartEvaluation) {
            onStartEvaluation(modelId);
        }
    };

    // Filter out the current streaming evaluation from history
    const historicalEvaluations = evaluationsQuery.data?.filter(
        (e) => !isStreaming || e.judgementText !== judgementText
    ) || [];

    // Show model selector when not streaming and no current judgement
    const showModelSelector = !isStreaming && !judgementText;

    return (
        <DialogPrimitive.Root open={isOpen} onOpenChange={handleOpenChange}>
            <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay
                    className={cn(
                        "fixed inset-0 z-50 bg-overlay backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
                    )}
                />
                <DialogPrimitive.Content
                    className={cn(
                        "fixed left-[50%] top-[50%] rounded-md z-50 grid w-full max-w-3xl max-h-[80vh] overflow-y-auto translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-8 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
                    )}
                >
                    <DialogPrimitive.Title className="hidden">
                        Judge Evaluation
                    </DialogPrimitive.Title>

                    {/* Model Selector - show when not evaluating */}
                    {showModelSelector && (
                        <div>
                            <div className="mb-3 flex items-center gap-2">
                                <span className="text-sm uppercase tracking-wider font-geist-mono text-gray-500">
                                    Select Judge Model
                                </span>
                                <div className="h-[1px] flex-1 bg-gray-300" />
                            </div>
                            <InlineModelSelector
                                onSelectModel={handleSelectModel}
                                disabled={isStreaming}
                            />
                        </div>
                    )}

                    {/* Current Evaluation */}
                    {(isStreaming || judgementText) && (
                        <div>
                            <div className="mb-1 flex items-center gap-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm uppercase tracking-wider font-geist-mono text-gray-500">
                                        {isStreaming ? "New Evaluation" : "Latest Evaluation"}
                                    </span>
                                </div>
                                <div className="h-[1px] flex-1 bg-gray-300" />
                                <div className="flex items-center gap-2">
                                    {isStreaming && (
                                        <div className="flex items-center gap-2 text-sm text-gray-500 uppercase tracking-wider font-geist-mono">
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                            Evaluating
                                        </div>
                                    )}
                                    {!isStreaming && judgementText && (
                                        <Button
                                            className="text-sm text-gray-500 uppercase tracking-wider font-geist-mono border-none"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => void handleCopy(judgementText)}
                                        >
                                            {copied ? (
                                                <>
                                                    Copied
                                                    <Check className="h-3 w-3 ml-1 text-gray-900" />
                                                </>
                                            ) : (
                                                <>
                                                    Copy
                                                    <Copy className="h-3 w-3 ml-1" />
                                                </>
                                            )}
                                        </Button>
                                    )}
                                </div>
                            </div>
                            <div>
                                {judgementText ? (
                                    <MessageMarkdown text={judgementText} />
                                ) : (
                                    <div className="flex items-center justify-center py-8 text-gray-500">
                                        <Loader2 className="h-6 w-6 animate-spin mr-2" />
                                        Starting evaluation...
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Historical Evaluations */}
                    {historicalEvaluations.length > 0 && (
                        <div className={cn(showModelSelector || isStreaming || judgementText ? "mt-4 border-t pt-4" : "")}>
                            <div className="mb-3 flex items-center gap-2">
                                <span className="text-sm uppercase tracking-wider font-geist-mono text-gray-500">
                                    History ({historicalEvaluations.length})
                                </span>
                                <div className="h-[1px] flex-1 bg-gray-300" />
                            </div>
                            <div className="space-y-2">
                                {historicalEvaluations.map((evaluation) => (
                                    <Collapsible
                                        key={evaluation.id}
                                        open={expandedIds.has(evaluation.id)}
                                        onOpenChange={() => toggleExpanded(evaluation.id)}
                                    >
                                        <CollapsibleTrigger className="flex items-center gap-2 w-full text-left p-2 rounded hover:bg-muted">
                                            {expandedIds.has(evaluation.id) ? (
                                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                            ) : (
                                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                            )}
                                            <span className="font-medium text-sm">
                                                {getModelName(evaluation.judgeModelId)}
                                            </span>
                                        </CollapsibleTrigger>
                                        <CollapsibleContent className="pl-6 pt-2">
                                            <MessageMarkdown text={evaluation.judgementText} />
                                        </CollapsibleContent>
                                    </Collapsible>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Empty state when no current evaluation and no history */}
                    {!showModelSelector && !isStreaming && !judgementText && historicalEvaluations.length === 0 && (
                        <div className="flex items-center justify-center py-8 text-gray-500">
                            No evaluations yet
                        </div>
                    )}
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    );
}
