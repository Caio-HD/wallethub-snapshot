import { Injectable } from '@nestjs/common';
import { AI_TOOL_DEFINITIONS, toChatTools } from './tools/ai-tools.definitions';
import { McpClientService } from '../mcp/mcp-client.service';
import type { AiChatTool } from './ai.types';

@Injectable()
export class AgentToolCatalogService {
  constructor(private readonly mcpClient: McpClientService) {}

  getDefinitions(): ReadonlyArray<{
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties?: Record<string, unknown>;
      required?: readonly string[];
    };
  }> {
    return [...AI_TOOL_DEFINITIONS, ...this.mcpClient.getToolDefinitions()];
  }

  toChatTools(): AiChatTool[] {
    return toChatTools(this.getDefinitions());
  }
}
