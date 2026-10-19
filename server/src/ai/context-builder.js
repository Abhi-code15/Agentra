import { conversationRepository } from '../modules/conversations/conversation-repository.js';
import { memoryRepository } from '../modules/memories/memory-repository.js';
import { buildSystemPrompt } from './prompts.js';
import { config } from '../config/env.js';

export class ContextBuilder {
  async buildContext({ user, conversationId, currentQuery }) {
    // 1. Fetch relevant memories via keyword matching on current query
    const memories = await memoryRepository.searchRelevantMemories(
      user.id,
      currentQuery || '',
      5
    );

    // 2. Fetch bounded conversation history
    const recentDbMessages = await conversationRepository.getRecentMessages(
      conversationId,
      config.AGENT_MAX_CONTEXT_MESSAGES
    );

    // 3. Format messages for AI provider (user, assistant, tool, system)
    const messages = recentDbMessages.map((m) => {
      const msg = {
        role: m.role,
        content: m.content
      };
      if (m.metadata && m.metadata.toolCalls) {
        msg.toolCalls = m.metadata.toolCalls;
      }
      if (m.metadata && m.metadata.toolCallId) {
        msg.toolCallId = m.metadata.toolCallId;
      }
      return msg;
    });

    // 4. Build system prompt
    const systemPrompt = buildSystemPrompt({ user, memories });

    return {
      systemPrompt,
      messages,
      retrievedMemories: memories
    };
  }
}

export const contextBuilder = new ContextBuilder();
