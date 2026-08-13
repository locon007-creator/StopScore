import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

import { createStopScoreMcpServer, type StopScoreMcpOptions } from "./server.ts";

const json = (value: unknown, status = 200, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });

export function createHttpRequestHandler(options: StopScoreMcpOptions = {}) {
  return async function handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health" && request.method === "GET") {
      return json({
        ok: true,
        service: "stopscore-builder",
        version: "0.1.0",
      });
    }

    if (url.pathname !== "/mcp") {
      return json(
        { jsonrpc: "2.0", error: { code: -32601, message: "Not found" }, id: null },
        404,
      );
    }

    if (request.method !== "POST") {
      return json(
        {
          jsonrpc: "2.0",
          error: { code: -32000, message: "Method not allowed" },
          id: null,
        },
        405,
        { allow: "POST" },
      );
    }

    const server = createStopScoreMcpServer(options);
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    await server.connect(transport);
    try {
      return await transport.handleRequest(request);
    } catch (error) {
      return json(
        {
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message:
              error instanceof Error ? error.message : "Internal MCP server error",
          },
          id: null,
        },
        500,
      );
    }
  };
}

