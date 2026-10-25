import { AgentToolCatalogService } from '@app/modules/ai/agent-tool-catalog.service';
import { McpClientService } from '@app/modules/mcp/mcp-client.service';
import { AI_TOOL_DEFINITIONS } from '@app/modules/ai/tools/ai-tools.definitions';

describe('AgentToolCatalogService', () => {
  it('merges static definitions with MCP tools', () => {
    const mcp = {
      getToolDefinitions: jest.fn().mockReturnValue([
        {
          name: 'mcp_srv_echo',
          description: 'echo',
          parameters: { type: 'object' as const, properties: {}, required: [] },
        },
      ]),
    } as unknown as McpClientService;

    const catalog = new AgentToolCatalogService(mcp);
    const defs = catalog.getDefinitions();
    expect(defs.length).toBe(AI_TOOL_DEFINITIONS.length + 1);
    expect(defs.some((d) => d.name === 'mcp_srv_echo')).toBe(true);
    const tools = catalog.toChatTools();
    expect(tools.some((t) => t.function.name === 'mcp_srv_echo')).toBe(true);
  });
});
