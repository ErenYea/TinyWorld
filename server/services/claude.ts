import Anthropic from '@anthropic-ai/sdk';
import type { Agent } from '@db/schema';

export class ClaudeService {
  private client: Anthropic;
  private static instance: ClaudeService;

  private constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!
    });
  }

  public static getInstance(): ClaudeService {
    if (!ClaudeService.instance) {
      ClaudeService.instance = new ClaudeService();
    }
    return ClaudeService.instance;
  }

  public async generateResponse(
    agent: Agent,
    context: string,
    memory: Record<string, any>
  ): Promise<{ response: string; updatedMemory: Record<string, any> }> {
    try {
      const systemPrompt = `You are an AI agent named ${agent.name} with the following description: ${agent.description}
Your goals are: ${agent.goals}

Previous context and memory:
${JSON.stringify(memory, null, 2)}

Current context:
${context}

Respond in character as the AI agent, considering your goals and previous context. Your response should be focused and concise.`;

      const response = await this.client.messages.create({
        model: 'claude-3-opus-20240229',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: systemPrompt
        }]
      });

      const messageContent = response.content[0].type === 'text' ? response.content[0].text : '';

      // Update memory with new interaction
      const updatedMemory = {
        ...memory,
        lastInteraction: {
          context,
          response: messageContent,
          timestamp: new Date().toISOString()
        }
      };

      return {
        response: messageContent,
        updatedMemory: updatedMemory
      };
    } catch (error) {
      console.error('[ClaudeService] Error generating response:', error);
      throw error;
    }
  }
}
