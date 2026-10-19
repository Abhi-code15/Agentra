import { z } from 'zod';

export const createConversationSchema = z.object({
  title: z.string().max(255).optional().default('New Conversation')
});

export const sendMessageSchema = z.object({
  content: z.string().min(1, 'Message content cannot be empty').max(10000)
});
