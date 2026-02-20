/**
 * Chat View Component
 * 
 * Full chat interface supporting both channels and direct messages.
 * Features iMessage-style bubbles, auto-resize textarea, and message history.
 */

import { useState, useRef, useEffect } from 'react';
import {
  Send,
  Paperclip,
  Smile,
  Info,
  MoreHorizontal,
  Video,
  Hash,
  Lock,
} from 'lucide-react';
import { clsx } from 'clsx';
import { MOCK_CHANNELS, MOCK_DMS, MOCK_EMPLOYEES } from '../../data/mock';
import type { NavigationItem, ChatMessage } from '../../types/app';

interface ChatProps {
  /** Current navigation item determining which chat to display */
  activeNav: NavigationItem;
}

/**
 * ChatHeader Component
 * Displays channel/DM info and action buttons
 */
const ChatHeader = ({
  title,
  subtitle,
  isPrivate,
  avatar,
}: {
  title: string;
  subtitle: string;
  isPrivate?: boolean;
  avatar?: string;
}) => (
  <header className="h-14 border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0 bg-white">
    <div className="flex items-center gap-3">
      {avatar ? (
        <img src={avatar} alt={title} className="w-8 h-8 rounded-full" />
      ) : (
        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
          {isPrivate ? (
            <Lock size={14} className="text-gray-500" />
          ) : (
            <Hash size={14} className="text-gray-500" />
          )}
        </div>
      )}
      <div>
        <h2 className="font-semibold text-gray-900">{title}</h2>
        <p className="text-xs text-gray-500">{subtitle}</p>
      </div>
    </div>
    <div className="flex items-center gap-2">
      <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
        <Video size={18} />
      </button>
      <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
        <Info size={18} />
      </button>
      <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
        <MoreHorizontal size={18} />
      </button>
    </div>
  </header>
);

/**
 * MessageBubble Component
 * Individual chat message with iMessage-style styling
 */
const MessageBubble = ({ message }: { message: ChatMessage }) => {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  if (isSystem) {
    return (
      <div className="flex justify-center my-4">
        <div className="bg-gray-100 text-gray-600 text-xs px-3 py-1.5 rounded-full">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div
      className={clsx(
        'flex mb-4',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      <div
        className={clsx(
          'max-w-[70%] px-4 py-2.5 rounded-2xl text-[15px] leading-relaxed',
          isUser
            ? 'bg-blue-600 text-white rounded-br-md'
            : 'bg-gray-100 text-gray-900 rounded-bl-md'
        )}
      >
        {message.content}
      </div>
    </div>
  );
};

/**
 * MessageInput Component
 * Auto-resizing textarea with send button
 */
const MessageInput = ({
  onSend,
}: {
  onSend: (content: string) => void;
}) => {
  const [inputValue, setInputValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [inputValue]);

  const handleSend = () => {
    if (inputValue.trim()) {
      onSend(inputValue.trim());
      setInputValue('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-gray-200 p-4 bg-white">
      <div className="flex items-end gap-2 bg-gray-100 rounded-2xl p-2">
        <button className="p-2 text-gray-500 hover:text-gray-700 transition-colors flex-shrink-0">
          <Paperclip size={20} />
        </button>
        <textarea
          ref={textareaRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          rows={1}
          className="flex-1 bg-transparent border-none resize-none outline-none text-[15px] text-gray-900 placeholder-gray-500 py-2 min-h-[40px] max-h-[120px]"
        />
        <button className="p-2 text-gray-500 hover:text-gray-700 transition-colors flex-shrink-0">
          <Smile size={20} />
        </button>
        <button
          onClick={handleSend}
          disabled={!inputValue.trim()}
          className={clsx(
            'p-2 rounded-xl transition-colors flex-shrink-0',
            inputValue.trim()
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          )}
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
};

/**
 * Chat Component
 * 
 * Full chat interface for channels and direct messages.
 * Displays message history and allows sending new messages.
 * 
 * @example
 * ```tsx
 * <Chat activeNav={{ type: 'channel', id: 'ch_general' }} />
 * ```
 */
export const Chat = ({ activeNav }: ChatProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load initial messages based on activeNav
  useEffect(() => {
    if (activeNav.type === 'channel') {
      const channel = MOCK_CHANNELS.find((c) => c.id === activeNav.id);
      setMessages(channel?.messages || []);
    } else if (activeNav.type === 'dm') {
      const dm = MOCK_DMS.find((d) => d.id === activeNav.id);
      setMessages(dm?.messages || []);
    } else {
      setMessages([]);
    }
  }, [activeNav]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Get chat info
  const getChatInfo = () => {
    if (activeNav.type === 'channel') {
      const channel = MOCK_CHANNELS.find((c) => c.id === activeNav.id);
      return {
        title: channel?.name || 'Unknown Channel',
        subtitle: channel?.description || '',
        isPrivate: channel?.isPrivate,
      };
    }
    if (activeNav.type === 'dm') {
      const dm = MOCK_DMS.find((d) => d.id === activeNav.id);
      const employee = MOCK_EMPLOYEES.find((e) => e.id === dm?.employeeId);
      return {
        title: employee?.name || 'Unknown',
        subtitle: dm?.lastActive || '',
        avatar: employee?.avatar,
      };
    }
    return { title: 'Chat', subtitle: '' };
  };

  const chatInfo = getChatInfo();

  /**
   * Handle sending a new message
   */
  const handleSendMessage = (content: string) => {
    const newMessage: ChatMessage = {
      id: `m_${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };

    setMessages((prev) => [...prev, newMessage]);

    // Simulate agent response for DMs
    if (activeNav.type === 'dm') {
      setTimeout(() => {
        const responseMessage: ChatMessage = {
          id: `m_${Date.now() + 1}`,
          role: 'assistant',
          content: 'I received your message. How can I help you today?',
          timestamp: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
        };
        setMessages((prev) => [...prev, responseMessage]);
      }, 1000);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <ChatHeader
        title={chatInfo.title}
        subtitle={chatInfo.subtitle}
        isPrivate={chatInfo.isPrivate}
        avatar={chatInfo.avatar}
      />

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              {activeNav.type === 'dm' ? (
                <span className="text-2xl">👋</span>
              ) : (
                <Hash size={28} className="text-gray-400" />
              )}
            </div>
            <p className="text-lg font-medium text-gray-600">
              {activeNav.type === 'dm'
                ? `Start a conversation with ${chatInfo.title}`
                : `Welcome to #${chatInfo.title}`}
            </p>
            <p className="text-sm mt-1">
              {activeNav.type === 'dm'
                ? 'Send a message to get started'
                : 'This is the beginning of the channel'}
            </p>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      <MessageInput onSend={handleSendMessage} />
    </div>
  );
};
