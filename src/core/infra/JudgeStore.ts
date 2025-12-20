import { create } from "zustand";

interface JudgeStore {
    isOpen: boolean;
    isStreaming: boolean;
    judgementText: string;
    currentMessageSetId: string | null;
    onStartEvaluation: ((judgeModelId: string) => void) | null;
    openDialog: () => void;
    closeDialog: () => void;
    setStreaming: (streaming: boolean) => void;
    appendText: (text: string) => void;
    setMessageSetId: (id: string) => void;
    setOnStartEvaluation: (callback: ((judgeModelId: string) => void) | null) => void;
    reset: () => void;
}

const useJudgeStore = create<JudgeStore>((set) => ({
    isOpen: false,
    isStreaming: false,
    judgementText: "",
    currentMessageSetId: null,
    onStartEvaluation: null,
    openDialog: () => set({ isOpen: true }),
    closeDialog: () => set({ isOpen: false, onStartEvaluation: null }),
    setStreaming: (streaming) => set({ isStreaming: streaming }),
    appendText: (text) => set((state) => ({ judgementText: state.judgementText + text })),
    setMessageSetId: (id) => set({ currentMessageSetId: id }),
    setOnStartEvaluation: (callback) => set({ onStartEvaluation: callback }),
    reset: () => set({ judgementText: "", isStreaming: false }),
}));

// Export stable actions that won't cause re-renders
export const judgeActions = {
    openDialog: () => useJudgeStore.getState().openDialog(),
    closeDialog: () => useJudgeStore.getState().closeDialog(),
    setStreaming: (streaming: boolean) => useJudgeStore.getState().setStreaming(streaming),
    appendText: (text: string) => useJudgeStore.getState().appendText(text),
    setMessageSetId: (id: string) => useJudgeStore.getState().setMessageSetId(id),
    reset: () => useJudgeStore.getState().reset(),
    // Open dialog with callback for starting evaluation
    openJudgeDialog: (messageSetId: string, onStartEvaluation: (judgeModelId: string) => void) => {
        const state = useJudgeStore.getState();
        state.reset();
        state.setMessageSetId(messageSetId);
        state.setOnStartEvaluation(onStartEvaluation);
        state.openDialog();
    },
    startEvaluation: (messageSetId: string) => {
        const state = useJudgeStore.getState();
        state.reset();
        state.setMessageSetId(messageSetId);
        state.setStreaming(true);
        state.openDialog();
    },
    finishEvaluation: () => {
        useJudgeStore.getState().setStreaming(false);
    },
};

export { useJudgeStore };
