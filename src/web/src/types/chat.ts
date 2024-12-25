// @ts-check
import { z } from 'zod'; // v3.22.0
import { BaseEntity, User } from './common';

/**
 * Enum defining possible chat status values for lifecycle management
 */
export enum ChatStatus {
  ACTIVE = 'ACTIVE',
  PENDING = 'PENDING',
  RESOLVED = 'RESOLVED',
  ARCHIVED = 'ARCHIVED'
}

/**
 * Enum defining all supported WhatsApp message content types
 */
export enum MessageType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  AUDIO = 'AUDIO',
  DOCUMENT = 'DOCUMENT',
  LOCATION = 'LOCATION',
  CONTACT = 'CONTACT',
  STICKER = 'STICKER'
}

/**
 * Enum defining message delivery status for tracking
 */
export enum MessageStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  READ = 'READ',
  FAILED = 'FAILED'
}

/**
 * Comprehensive interface for chat data structure with AI integration support
 */
export interface Chat extends BaseEntity {
  organizationId: string;
  assignedUserId: string | null;
  whatsappChatId: string;
  customerPhone: string;
  customerName: string;
  customerMetadata: Record<string, unknown>;
  status: ChatStatus;
  aiEnabled: boolean;
  aiConfig: Record<string, unknown>;
  lastMessageAt: Date;
  messages: Message[];
  assignedUser: User | null;
  tags: string[];
}

/**
 * Comprehensive interface for message data structure with enhanced status tracking
 */
export interface Message extends BaseEntity {
  chatId: string;
  senderId: string | null;
  whatsappMessageId: string;
  messageType: MessageType;
  content: string;
  metadata: Record<string, unknown>;
  status: MessageStatus;
  isFromCustomer: boolean;
  isFromAssistant: boolean;
  assistantMetadata: Record<string, unknown>;
  sender: User | null;
  sentAt: Date | null;
  deliveredAt: Date | null;
  readAt: Date | null;
}

/**
 * Zod schema for validating chat data with comprehensive validation rules
 */
export const chatSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  assignedUserId: z.string().uuid().nullable(),
  whatsappChatId: z.string().min(1),
  customerPhone: z.string().regex(/^\+?[1-9]\d{1,14}$/, {
    message: 'Invalid phone number format'
  }),
  customerName: z.string().min(1),
  customerMetadata: z.record(z.unknown()),
  status: z.nativeEnum(ChatStatus),
  aiEnabled: z.boolean(),
  aiConfig: z.record(z.unknown()),
  lastMessageAt: z.date(),
  messages: z.array(z.lazy(() => messageSchema)),
  assignedUser: z.lazy(() => z.null().or(z.object({
    id: z.string().uuid(),
    name: z.string()
  }))),
  tags: z.array(z.string()),
  createdAt: z.date(),
  updatedAt: z.date()
});

/**
 * Zod schema for validating message data with comprehensive validation rules
 */
export const messageSchema = z.object({
  id: z.string().uuid(),
  chatId: z.string().uuid(),
  senderId: z.string().uuid().nullable(),
  whatsappMessageId: z.string().min(1),
  messageType: z.nativeEnum(MessageType),
  content: z.string().min(1),
  metadata: z.record(z.unknown()),
  status: z.nativeEnum(MessageStatus),
  isFromCustomer: z.boolean(),
  isFromAssistant: z.boolean(),
  assistantMetadata: z.record(z.unknown()),
  sender: z.lazy(() => z.null().or(z.object({
    id: z.string().uuid(),
    name: z.string()
  }))),
  sentAt: z.date().nullable(),
  deliveredAt: z.date().nullable(),
  readAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date()
}).refine(
  data => {
    if (data.status === MessageStatus.SENT && !data.sentAt) return false;
    if (data.status === MessageStatus.DELIVERED && !data.deliveredAt) return false;
    if (data.status === MessageStatus.READ && !data.readAt) return false;
    return true;
  },
  {
    message: "Message status must match corresponding timestamp fields"
  }
);