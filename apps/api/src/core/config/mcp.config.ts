import { registerAs } from '@nestjs/config';

export interface McpServerEntry {
  name: string;
  url: string;
  headers?: Record<string, string>;
}

export interface McpConfig {
  servers: McpServerEntry[];
}

function parseMcpServersJson(raw: string | undefined): McpServerEntry[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: McpServerEntry[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      const o = item as Record<string, unknown>;
      const name = typeof o.name === 'string' ? o.name.trim() : '';
      const url = typeof o.url === 'string' ? o.url.trim() : '';
      if (!name || !url) continue;
      let headers: Record<string, string> | undefined;
      if (o.headers && typeof o.headers === 'object' && !Array.isArray(o.headers)) {
        headers = {};
        for (const [k, v] of Object.entries(o.headers as Record<string, unknown>)) {
          if (typeof v === 'string') headers[k] = v;
        }
      }
      out.push({ name, url, headers });
    }
    return out;
  } catch {
    return [];
  }
}

export const mcpConfig = registerAs('mcp', (): McpConfig => ({
  servers: parseMcpServersJson(process.env.MCP_SERVERS_JSON),
}));
