import { useCallback, useReducer } from "react";

import type { ChatMode } from "../../../../shared/ipc";

type CopilotPageState = {
  chatMode: ChatMode;
  clarificationInput: string;
  thinkingEnabled: boolean;
};

type CopilotPageAction =
  | {
      type: "set-chat-mode";
      mode: ChatMode;
    }
  | {
      type: "set-clarification-input";
      value: string;
    }
  | {
      type: "clear-clarification-input";
    }
  | {
      type: "set-thinking-enabled";
      enabled: boolean;
    };

const initialState: CopilotPageState = {
  chatMode: "default",
  clarificationInput: "",
  thinkingEnabled: false
};

const reducer = (state: CopilotPageState, action: CopilotPageAction): CopilotPageState => {
  if (action.type === "set-chat-mode") {
    if (state.chatMode === action.mode) {
      return state;
    }
    return {
      ...state,
      chatMode: action.mode
    };
  }

  if (action.type === "set-clarification-input") {
    if (state.clarificationInput === action.value) {
      return state;
    }
    return {
      ...state,
      clarificationInput: action.value
    };
  }

  if (action.type === "set-thinking-enabled") {
    if (state.thinkingEnabled === action.enabled) {
      return state;
    }
    return {
      ...state,
      thinkingEnabled: action.enabled
    };
  }

  if (!state.clarificationInput) {
    return state;
  }

  return {
    ...state,
    clarificationInput: ""
  };
};

export const useCopilotPageState = () => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const setChatMode = useCallback((mode: ChatMode) => {
    dispatch({ type: "set-chat-mode", mode });
  }, []);
  const setClarificationInput = useCallback((value: string) => {
    dispatch({ type: "set-clarification-input", value });
  }, []);
  const clearClarificationInput = useCallback(() => {
    dispatch({ type: "clear-clarification-input" });
  }, []);
  const setThinkingEnabled = useCallback((enabled: boolean) => {
    dispatch({ type: "set-thinking-enabled", enabled });
  }, []);

  return {
    state,
    setChatMode,
    setClarificationInput,
    clearClarificationInput,
    setThinkingEnabled
  };
};
