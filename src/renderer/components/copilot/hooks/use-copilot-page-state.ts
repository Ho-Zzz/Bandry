import { useReducer } from "react";

import type { ChatMode } from "../../../../shared/ipc";

type CopilotPageState = {
  chatMode: ChatMode;
  clarificationInput: string;
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
    };

const initialState: CopilotPageState = {
  chatMode: "default",
  clarificationInput: ""
};

const reducer = (state: CopilotPageState, action: CopilotPageAction): CopilotPageState => {
  if (action.type === "set-chat-mode") {
    return {
      ...state,
      chatMode: action.mode
    };
  }

  if (action.type === "set-clarification-input") {
    return {
      ...state,
      clarificationInput: action.value
    };
  }

  return {
    ...state,
    clarificationInput: ""
  };
};

export const useCopilotPageState = () => {
  const [state, dispatch] = useReducer(reducer, initialState);

  return {
    state,
    setChatMode: (mode: ChatMode) => {
      dispatch({ type: "set-chat-mode", mode });
    },
    setClarificationInput: (value: string) => {
      dispatch({ type: "set-clarification-input", value });
    },
    clearClarificationInput: () => {
      dispatch({ type: "clear-clarification-input" });
    }
  };
};
