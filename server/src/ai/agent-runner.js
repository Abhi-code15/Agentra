import { pool } from '../db/pool.js';
import { conversationRepository } from '../modules/conversations/conversation-repository.js';
import { contextBuilder } from './context-builder.js';
import { toolRegistry } from './tool-registry.js';
import { getAIProvider } from './provider.js';
import { config } from '../config/env.js';
import { logger } from '../shared/logger.js';
import { TimeoutError } from '../shared/errors.js';

export class AgentRunner {
  async run({ user, conversationId, userMessageContent }) {
    const startTime = Date.now();
    logger.info('Starting agent run', { userId: user.id, conversationId });

    // 1. Persist the user message
    const userMessage = await conversationRepository.createMessage({
      conversationId,
      role: 'user',
      content: userMessageContent
    });
    await conversationRepository.touchConversation(conversationId);

    // 2. Create agent_run record
    const runRes = await pool.query(
      `INSERT INTO agent_runs (conversation_id, user_id, status, model, started_at)
       VALUES ($1, $2, 'running', $3, CURRENT_TIMESTAMP)
       RETURNING id, conversation_id, user_id, status, model, started_at`,
      [conversationId, user.id, config.AI_PROVIDER]
    );
    const agentRun = runRes.rows[0];

    const provider = getAIProvider();
    const executedTools = [];
    const proposalsCreated = [];
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;

    try {
      // 3. Build context (bounded messages + memories + system prompt)
      const { systemPrompt, messages } = await contextBuilder.buildContext({
        user,
        conversationId,
        currentQuery: userMessageContent
      });

      const loopMessages = [...messages];
      let round = 0;
      let finalContent = null;

      // 4. Bounded Agent Loop
      while (round < config.AGENT_MAX_ROUNDS) {
        round++;

        // Enforce total agent execution timeout
        if (Date.now() - startTime > config.AGENT_TOTAL_TIMEOUT_MS) {
          throw new TimeoutError(`Agent execution exceeded maximum deadline of ${config.AGENT_TOTAL_TIMEOUT_MS}ms`);
        }

        logger.debug(`Agent loop round ${round}`, { runId: agentRun.id });

        const response = await provider.generateResponse({
          systemPrompt,
          messages: loopMessages,
          tools: toolRegistry.getTools()
        });

        if (response.usage) {
          totalPromptTokens += response.usage.promptTokens || 0;
          totalCompletionTokens += response.usage.completionTokens || 0;
        }

        // If the model wants to call tools
        if (response.toolCalls && response.toolCalls.length > 0) {
          // Append assistant message indicating tool calls
          loopMessages.push({
            role: 'assistant',
            content: response.content,
            toolCalls: response.toolCalls
          });

          for (const call of response.toolCalls) {
            const toolExecRes = await pool.query(
              `INSERT INTO tool_executions (agent_run_id, tool_name, status, arguments, started_at)
               VALUES ($1, $2, 'started', $3, CURRENT_TIMESTAMP)
               RETURNING id, tool_name, arguments`,
              [agentRun.id, call.name, JSON.stringify(call.args)]
            );
            const toolExec = toolExecRes.rows[0];

            let toolResult;
            let toolError = null;

            try {
              // Execute tool with timeout
              toolResult = await Promise.race([
                toolRegistry.executeTool(call.name, {
                  userId: user.id,
                  agentRunId: agentRun.id,
                  args: call.args
                }),
                new Promise((_, reject) =>
                  setTimeout(() => reject(new TimeoutError(`Tool ${call.name} timed out`)), config.AGENT_TOOL_TIMEOUT_MS)
                )
              ]);

              await pool.query(
                `UPDATE tool_executions
                 SET status = 'success', result_summary = $1, finished_at = CURRENT_TIMESTAMP
                 WHERE id = $2`,
                [JSON.stringify(toolResult), toolExec.id]
              );

              if (call.name === 'propose_action' && toolResult.proposalId) {
                proposalsCreated.push(toolResult);
              }
            } catch (err) {
              toolError = err.message;
              logger.warn(`Tool execution failed: ${call.name}`, { error: err.message, runId: agentRun.id });

              await pool.query(
                `UPDATE tool_executions
                 SET status = 'failed', error_code = $1, result_summary = $2, finished_at = CURRENT_TIMESTAMP
                 WHERE id = $3`,
                ['TOOL_EXECUTION_ERROR', JSON.stringify({ error: err.message }), toolExec.id]
              );

              toolResult = {
                error: true,
                message: `Failed to execute tool ${call.name}: ${err.message}`
              };
            }

            executedTools.push({
              id: toolExec.id,
              toolName: call.name,
              status: toolError ? 'failed' : 'success',
              arguments: call.args,
              result: toolResult
            });

            // Feed tool result back into loop messages
            loopMessages.push({
              role: 'tool',
              toolCallId: call.id,
              toolName: call.name,
              content: JSON.stringify(toolResult)
            });
          }

          // Continue to next round so model can interpret results
          continue;
        }

        // Model produced a final textual response
        finalContent = response.content;
        break;
      }

      if (!finalContent) {
        finalContent = "I've reviewed your request and taken the necessary actions based on your current tasks and preferences.";
      }

      // 5. Persist the final assistant response
      const assistantMessage = await conversationRepository.createMessage({
        conversationId,
        role: 'assistant',
        content: finalContent,
        metadata: {
          agentRunId: agentRun.id,
          toolsUsed: executedTools.map((t) => t.toolName),
          proposals: proposalsCreated.map((p) => p.proposalId)
        }
      });
      await conversationRepository.touchConversation(conversationId);

      // 6. Complete the agent run record
      await pool.query(
        `UPDATE agent_runs
         SET status = 'completed', finished_at = CURRENT_TIMESTAMP, prompt_tokens = $1, completion_tokens = $2
         WHERE id = $3`,
        [totalPromptTokens, totalCompletionTokens, agentRun.id]
      );

      return {
        message: assistantMessage,
        agentRun: {
          id: agentRun.id,
          status: 'completed',
          model: agentRun.model,
          promptTokens: totalPromptTokens,
          completionTokens: totalCompletionTokens
        },
        tools: executedTools,
        proposals: proposalsCreated
      };
    } catch (err) {
      logger.error('Agent run failed with error', { error: err.message, runId: agentRun.id });

      await pool.query(
        `UPDATE agent_runs
         SET status = 'failed', error_code = $1, finished_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [err.errorCode || 'INTERNAL_ERROR', agentRun.id]
      );

      // Record a helpful error message in the chat
      const errorMessage = await conversationRepository.createMessage({
        conversationId,
        role: 'assistant',
        content: `I encountered an issue while processing your request: ${err.message}. Please try again.`,
        metadata: {
          agentRunId: agentRun.id,
          error: true,
          errorCode: err.errorCode || 'INTERNAL_ERROR'
        }
      });

      return {
        message: errorMessage,
        agentRun: {
          id: agentRun.id,
          status: 'failed',
          errorCode: err.errorCode || 'INTERNAL_ERROR'
        },
        tools: executedTools,
        proposals: proposalsCreated
      };
    }
  }
}

export const agentRunner = new AgentRunner();
