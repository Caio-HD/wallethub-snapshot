import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import type { McpConfig, McpServerEntry } from '../../core/config/mcp.config';

export interface McpToolDefinitionEntry {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

function sanitizeSegment(s: string): string {
  const t = s.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return t.length > 0 ? t : 'x';
}

type Connection = {
  client: Client;
};

@Injectable()
export class McpClientService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(McpClientService.name);
  private connections: Connection[] = [];
  private definitions: McpToolDefinitionEntry[] = [];
  private readonly toolRouter = new Map<
    string,
    { client: Client; originalName: string; serverLabel: string }
  >();

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const cfg = this.configService.get<McpConfig>('mcp');
    if (!cfg?.servers?.length) {
      return;
    }
    for (const server of cfg.servers) {
      try {
        await this.connectServer(server);
      } catch (e) {
        this.logger.warn(`MCP servidor "${server.name}" indisponível: ${(e as Error).message}`);
      }
    }
    if (this.definitions.length > 0) {
      this.logger.log(`${this.definitions.length} ferramenta(s) MCP registadas`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    for (const c of this.connections) {
      try {
        await c.client.close();
      } catch {
        /* ignore */
      }
    }
    this.connections = [];
    this.definitions = [];
    this.toolRouter.clear();
  }

  getToolDefinitions(): McpToolDefinitionEntry[] {
    return this.definitions;
  }

  hasTool(prefixedName: string): boolean {
    return this.toolRouter.has(prefixedName);
  }

  async callTool(prefixedName: string, args: Record<string, unknown>): Promise<string> {
    const route = this.toolRouter.get(prefixedName);
    if (!route) {
      return JSON.stringify({ error: `Ferramenta MCP não encontrada: ${prefixedName}` });
    }
    const result = await route.client.callTool({
      name: route.originalName,
      arguments: args,
    });
    return JSON.stringify(result);
  }

  private async connectServer(server: McpServerEntry): Promise<void> {
    const client = new Client({ name: 'wallethub-api', version: '1.0.0' });
    const url = new URL(server.url);
    const requestInit: RequestInit = {};
    if (server.headers && Object.keys(server.headers).length > 0) {
      requestInit.headers = new Headers(server.headers);
    }

    let connected = false;
    try {
      const transport = new StreamableHTTPClientTransport(url, { requestInit });
      await client.connect(transport);
      connected = true;
    } catch (e) {
      this.logger.debug(
        `Streamable HTTP falhou para ${server.name}: ${(e as Error).message}; a tentar SSE`,
      );
    }
    if (!connected) {
      const sseTransport = new SSEClientTransport(url, { requestInit });
      await client.connect(sseTransport);
    }

    const list = await client.listTools();
    const sn = sanitizeSegment(server.name);

    for (const tool of list.tools) {
      const prefixed = `mcp_${sn}_${sanitizeSegment(tool.name)}`;
      if (this.toolRouter.has(prefixed)) {
        continue;
      }
      this.toolRouter.set(prefixed, {
        client,
        originalName: tool.name,
        serverLabel: server.name,
      });

      const schema = tool.inputSchema as
        { type?: string; properties?: Record<string, unknown>; required?: string[] } | undefined;
      const parameters = {
        type: 'object' as const,
        properties: schema?.properties ?? {},
        required: Array.isArray(schema?.required) ? schema.required : [],
      };

      this.definitions.push({
        name: prefixed,
        description: `[MCP:${server.name}] ${tool.description ?? tool.name}`,
        parameters,
      });
    }

    this.connections.push({ client });
  }
}
