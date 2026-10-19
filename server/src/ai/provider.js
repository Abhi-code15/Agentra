import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { config } from '../config/env.js';
import { logger } from '../shared/logger.js';
import { AIProviderError } from '../shared/errors.js';

/**
 * Base AI Provider Interface
 */
export class AIProviderAdapter {
  async generateResponse({ systemPrompt, messages, tools, toolChoice }) {
    throw new Error('generateResponse must be implemented by subclass');
  }
}

/**
 * Deterministic Mock AI Provider for testing and offline development
 */
export class MockProviderAdapter extends AIProviderAdapter {
  async generateResponse({ systemPrompt, messages, tools }) {
    // Find the latest message
    const lastMessage = messages[messages.length - 1];

    // If the last message is a tool response, produce a final synthesized assistant message
    if (lastMessage && lastMessage.role === 'tool') {
      let toolData;
      try {
        toolData = JSON.parse(lastMessage.content);
      } catch {
        toolData = lastMessage.content;
      }

      if (toolData.requiresApproval && toolData.proposalId) {
        return {
          content: `I have prepared your plan:\n\n**${toolData.summary}**\n\n> [!IMPORTANT]\n> An action proposal (ID: \`${toolData.proposalId}\`) has been created. Please review and click **Approve Plan** to execute these actions.`,
          toolCalls: [],
          finishReason: 'stop',
          usage: { promptTokens: 120, completionTokens: 45 }
        };
      }

      if (toolData.tasks) {
        if (toolData.tasks.length === 0) {
          return {
            content: "You currently have no tasks matching this criteria. Would you like me to help you create one?",
            toolCalls: [],
            finishReason: 'stop',
            usage: { promptTokens: 90, completionTokens: 25 }
          };
        }
        const taskList = toolData.tasks
          .map((t) => `- **${t.title}** [${t.priority.toUpperCase()}] — Status: \`${t.status}\`${t.due_at ? ` (Due: ${new Date(t.due_at).toLocaleDateString()})` : ''}`)
          .join('\n');
        return {
          content: `Here are your current tasks:\n\n${taskList}\n\nLet me know if you want to update or prioritize any of them.`,
          toolCalls: [],
          finishReason: 'stop',
          usage: { promptTokens: 110, completionTokens: 60 }
        };
      }

      if (toolData.task) {
        return {
          content: `Success! ${toolData.message || 'Operation completed'}:\n\n- **Title**: ${toolData.task.title}\n- **Priority**: ${toolData.task.priority}\n- **Status**: \`${toolData.task.status}\``,
          toolCalls: [],
          finishReason: 'stop',
          usage: { promptTokens: 100, completionTokens: 40 }
        };
      }

      return {
        content: `I've processed that for you: ${JSON.stringify(toolData)}`,
        toolCalls: [],
        finishReason: 'stop',
        usage: { promptTokens: 80, completionTokens: 30 }
      };
    }

    // Inspect user's query for intent
    const rawContent = lastMessage?.content || '';
    const text = rawContent.toLowerCase();

    // Intent 1: Multi-step Plan / Schedule proposal
    if (text.includes('plan') && (text.includes('tomorrow') || text.includes('schedule') || text.includes('create a plan'))) {
      // Step 1 of plan: List existing pending tasks
      return {
        content: "Let me check your current tasks so we can build a realistic schedule.",
        toolCalls: [
          {
            id: `call_list_${Date.now()}`,
            name: 'list_tasks',
            args: { status: 'pending', limit: 10 }
          }
        ],
        finishReason: 'tool_calls',
        usage: { promptTokens: 100, completionTokens: 30 }
      };
    }

    // Intent 2: Create task
    if (text.startsWith('create task:') || text.startsWith('add task:') || text.includes('new task')) {
      const match = rawContent.match(/(?:create task:|add task:|new task:?)\s*(.+)/i);
      const title = match ? match[1].trim() : 'New Task from Chat';
      return {
        content: null,
        toolCalls: [
          {
            id: `call_create_${Date.now()}`,
            name: 'create_task',
            args: {
              title,
              priority: text.includes('urgent') || text.includes('high') ? 'high' : 'medium'
            }
          }
        ],
        finishReason: 'tool_calls',
        usage: { promptTokens: 90, completionTokens: 25 }
      };
    }

    // Intent 3: List tasks
    if (text.includes('show tasks') || text.includes('list tasks') || text.includes('my tasks') || text.includes('pending tasks')) {
      return {
        content: null,
        toolCalls: [
          {
            id: `call_list_${Date.now()}`,
            name: 'list_tasks',
            args: {
              status: text.includes('pending') ? 'pending' : undefined,
              limit: 20
            }
          }
        ],
        finishReason: 'tool_calls',
        usage: { promptTokens: 85, completionTokens: 20 }
      };
    }

    // Intent 4: Memory lookup
    if (text.includes('saved memories') || text.includes('my preferences') || text.includes('what do you remember')) {
      return {
        content: null,
        toolCalls: [
          {
            id: `call_mem_${Date.now()}`,
            name: 'get_saved_memories',
            args: {}
          }
        ],
        finishReason: 'tool_calls',
        usage: { promptTokens: 85, completionTokens: 20 }
      };
    }

    // Default conversational response
    return {
      content: `Hello! I am **Agentra**, your Personal AI Productivity Agent.\n\nI can help you:\n- Organize and prioritize your tasks\n- Plan your schedule for today or tomorrow\n- Propose actionable workflows\n- Remember your personal preferences and project context\n\nHow can I help you today?`,
      toolCalls: [],
      finishReason: 'stop',
      usage: { promptTokens: 75, completionTokens: 45 }
    };
  }
}

/**
 * Google Gemini Provider Adapter
 */
export class GeminiProviderAdapter extends AIProviderAdapter {
  constructor() {
    super();
    if (!config.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not configured');
    }
    this.genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);
  }

  async generateResponse({ systemPrompt, messages, tools }) {
    try {
      const model = this.genAI.getGenerativeModel({
        model: config.GEMINI_MODEL,
        systemInstruction: systemPrompt
      });

      // Format gemini function declarations
      const functionDeclarations = tools.map((t) => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters
      }));

      // Convert messages to Gemini history
      const contents = messages.map((m) => {
        const role = m.role === 'assistant' ? 'model' : m.role === 'tool' ? 'function' : 'user';
        if (m.role === 'tool') {
          return {
            role: 'function',
            parts: [{ functionResponse: { name: m.toolName || 'tool', response: { content: m.content } } }]
          };
        }
        return {
          role,
          parts: [{ text: m.content || '' }]
        };
      });

      const chat = model.startChat({
        tools: [{ functionDeclarations }],
        history: contents.slice(0, -1)
      });

      const lastMsg = contents[contents.length - 1];
      const result = await chat.sendMessage(lastMsg.parts);
      const response = await result.response;

      const functionCalls = response.functionCalls();
      const toolCalls = (functionCalls || []).map((fc, i) => ({
        id: `gemini_call_${Date.now()}_${i}`,
        name: fc.name,
        args: fc.args
      }));

      return {
        content: response.text() || null,
        toolCalls,
        finishReason: toolCalls.length > 0 ? 'tool_calls' : 'stop',
        usage: {
          promptTokens: response.usageMetadata?.promptTokenCount || 0,
          completionTokens: response.usageMetadata?.candidatesTokenCount || 0
        }
      };
    } catch (err) {
      logger.error('Gemini Provider Error', { error: err.message });
      throw new AIProviderError(`Gemini Provider Error: ${err.message}`);
    }
  }
}

/**
 * OpenAI Provider Adapter
 */
export class OpenAIProviderAdapter extends AIProviderAdapter {
  constructor() {
    super();
    if (!config.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }
    this.client = new OpenAI({ apiKey: config.OPENAI_API_KEY });
  }

  async generateResponse({ systemPrompt, messages, tools, toolChoice }) {
    try {
      const openAiMessages = [
        { role: 'system', content: systemPrompt },
        ...messages.map((m) => {
          if (m.role === 'tool') {
            return {
              role: 'tool',
              tool_call_id: m.toolCallId || 'call_default',
              content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
            };
          }
          if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
            return {
              role: 'assistant',
              content: m.content || null,
              tool_calls: m.toolCalls.map((tc) => ({
                id: tc.id,
                type: 'function',
                function: {
                  name: tc.name,
                  arguments: JSON.stringify(tc.args)
                }
              }))
            };
          }
          return {
            role: m.role,
            content: m.content
          };
        })
      ];

      const formattedTools = tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters
        }
      }));

      const res = await this.client.chat.completions.create({
        model: config.OPENAI_MODEL,
        messages: openAiMessages,
        tools: formattedTools.length > 0 ? formattedTools : undefined,
        tool_choice: toolChoice || 'auto'
      });

      const choice = res.choices[0];
      const message = choice.message;

      const toolCalls = (message.tool_calls || []).map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        args: JSON.parse(tc.function.arguments || '{}')
      }));

      return {
        content: message.content || null,
        toolCalls,
        finishReason: choice.finish_reason === 'tool_calls' ? 'tool_calls' : 'stop',
        usage: {
          promptTokens: res.usage?.prompt_tokens || 0,
          completionTokens: res.usage?.completion_tokens || 0
        }
      };
    } catch (err) {
      logger.error('OpenAI Provider Error', { error: err.message });
      throw new AIProviderError(`OpenAI Provider Error: ${err.message}`);
    }
  }
}

/**
 * Factory for selecting the active AI provider
 */
export function getAIProvider() {
  if (config.AI_PROVIDER === 'gemini' && config.GEMINI_API_KEY) {
    return new GeminiProviderAdapter();
  }
  if (config.AI_PROVIDER === 'openai' && config.OPENAI_API_KEY) {
    return new OpenAIProviderAdapter();
  }
  // Default to deterministic Mock adapter
  return new MockProviderAdapter();
}
