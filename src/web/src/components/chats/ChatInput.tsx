import React, { useState, useRef, useCallback, useEffect } from 'react'; // v18.0.0
import clsx from 'clsx'; // v2.0.0
import Input from '../common/Input';
import Button from '../common/Button';
import { useChat } from '../../hooks/useChat';
import { MessageType } from '../../types/chat';

// Constants for input validation
const MAX_MESSAGE_LENGTH = 4096;
const DEFAULT_PLACEHOLDER = 'Type a message...';
const ALLOWED_FILE_TYPES = ['image/*', 'application/pdf', '.doc', '.docx'];
const MAX_FILE_SIZE = 16 * 1024 * 1024; // 16MB
const DRAFT_KEY_PREFIX = 'chat_draft_';

interface ChatInputProps {
  chatId: string;
  disabled?: boolean;
  aiEnabled?: boolean;
  onAiToggle?: (enabled: boolean) => void;
  className?: string;
  maxLength?: number;
  placeholder?: string;
  allowedFileTypes?: string[];
  maxFileSize?: number;
}

/**
 * Multi-modal chat input component for WhatsApp message composition
 * Supports text input, file attachments, AI assistance, and offline capabilities
 */
const ChatInput: React.FC<ChatInputProps> = ({
  chatId,
  disabled = false,
  aiEnabled = false,
  onAiToggle,
  className,
  maxLength = MAX_MESSAGE_LENGTH,
  placeholder = DEFAULT_PLACEHOLDER,
  allowedFileTypes = ALLOWED_FILE_TYPES,
  maxFileSize = MAX_FILE_SIZE,
}) => {
  // State management
  const [message, setMessage] = useState<string>('');
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const draftTimeoutRef = useRef<NodeJS.Timeout>();

  // Custom hooks
  const { sendMessage, toggleAI, isTyping, setTyping } = useChat(chatId);

  // Load draft message on mount
  useEffect(() => {
    const draft = localStorage.getItem(`${DRAFT_KEY_PREFIX}${chatId}`);
    if (draft) {
      setMessage(draft);
    }
    return () => {
      if (draftTimeoutRef.current) {
        clearTimeout(draftTimeoutRef.current);
      }
    };
  }, [chatId]);

  // Save draft message with debounce
  const saveDraft = useCallback((text: string) => {
    if (draftTimeoutRef.current) {
      clearTimeout(draftTimeoutRef.current);
    }
    draftTimeoutRef.current = setTimeout(() => {
      localStorage.setItem(`${DRAFT_KEY_PREFIX}${chatId}`, text);
    }, 500);
  }, [chatId]);

  // Handle message input changes
  const handleMessageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    if (text.length <= maxLength) {
      setMessage(text);
      saveDraft(text);
      setTyping(text.length > 0);
      setError(null);
    }
  }, [maxLength, saveDraft, setTyping]);

  // Handle file selection
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = e.target.files?.[0];
      if (!file) return;

      // Validate file type
      const isValidType = allowedFileTypes.some(type => {
        if (type.startsWith('.')) {
          return file.name.toLowerCase().endsWith(type);
        }
        return file.type.match(new RegExp(type.replace('*', '.*')));
      });

      if (!isValidType) {
        throw new Error('Invalid file type. Please select an allowed file type.');
      }

      // Validate file size
      if (file.size > maxFileSize) {
        throw new Error(`File size exceeds ${maxFileSize / (1024 * 1024)}MB limit.`);
      }

      // Generate preview for images
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => setFilePreview(e.target?.result as string);
        reader.readAsDataURL(file);
      } else {
        setFilePreview(null);
      }

      // Prepare file for sending
      const messageType = file.type.startsWith('image/') 
        ? MessageType.IMAGE 
        : MessageType.DOCUMENT;

      setMessage(file.name);
      setError(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to process file');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [allowedFileTypes, maxFileSize]);

  // Handle message sending
  const handleSendMessage = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!message.trim() && !filePreview) {
      setError('Please enter a message or select a file');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      await sendMessage(message);

      // Clear input and states
      setMessage('');
      setFilePreview(null);
      localStorage.removeItem(`${DRAFT_KEY_PREFIX}${chatId}`);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to send message');
    } finally {
      setIsLoading(false);
    }
  }, [message, filePreview, chatId, sendMessage]);

  // Handle AI toggle
  const handleAiToggle = useCallback(async () => {
    try {
      await toggleAI(!aiEnabled);
      onAiToggle?.(!aiEnabled);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to toggle AI');
    }
  }, [aiEnabled, toggleAI, onAiToggle]);

  return (
    <form 
      onSubmit={handleSendMessage}
      className={clsx(
        'flex items-center gap-2 p-4 border-t bg-white dark:bg-gray-800 transition-colors',
        className
      )}
    >
      {/* File input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={allowedFileTypes.join(',')}
        onChange={handleFileSelect}
        className="hidden"
        aria-label="Attach file"
      />

      {/* File preview */}
      {filePreview && (
        <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-gray-100">
          <img
            src={filePreview}
            alt="File preview"
            className="w-full h-full object-cover"
          />
          <button
            type="button"
            onClick={() => {
              setFilePreview(null);
              if (fileInputRef.current) {
                fileInputRef.current.value = '';
              }
            }}
            className="absolute top-1 right-1 p-1 bg-gray-800/50 rounded-full text-white"
            aria-label="Remove file"
          >
            ×
          </button>
        </div>
      )}

      {/* Message input */}
      <div className="flex-1 relative">
        <Input
          id={`chat-input-${chatId}`}
          value={message}
          onChange={handleMessageChange}
          placeholder={placeholder}
          disabled={disabled || isLoading}
          maxLength={maxLength}
          error={error}
          aria-label="Message input"
          className="min-h-[40px] max-h-[120px] resize-none"
        />
        {isTyping && (
          <span className="absolute right-2 bottom-2 text-xs text-gray-500">
            Typing...
          </span>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isLoading}
          aria-label="Attach file"
        >
          📎
        </Button>
        <Button
          type="button"
          variant={aiEnabled ? 'primary' : 'outline'}
          onClick={handleAiToggle}
          disabled={disabled || isLoading}
          aria-label={`${aiEnabled ? 'Disable' : 'Enable'} AI assistant`}
        >
          🤖
        </Button>
        <Button
          type="submit"
          variant="primary"
          loading={isLoading}
          disabled={disabled || (!message.trim() && !filePreview)}
          aria-label="Send message"
        >
          Send
        </Button>
      </div>
    </form>
  );
};

export default ChatInput;