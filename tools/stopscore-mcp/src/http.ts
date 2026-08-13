import { resolve } from "node:path";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Request, Response } from "express";

import { createStopScoreMcpServer } from "./server.ts";

const port = Number.parseInt(process.env.PORT ?? "8788", 10);
const statusPath =
  process.env.STOPSCORE_STATUS_PATH ??
  resolve(process.cwd(), "tools/stopscore-mcp/data/status.json");
const app = createMcpExpressApp();

app.get("/health", (_request: Request, response: Response) => {
  response.json({ ok: true, service: "stopscore-builder", version: "0.1.0" });
});

app.post("/mcp", async (request: Request, response: Response) => {
  const server = createStopScoreMcpServer({ statusPath });
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(request, response, request.body);
  } catch (error) {
    if (!response.headersSent) {
      response.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message:
            error instanceof Error ? error.message : "Internal MCP server error",
        },
        id: null,
      });
    }
  }
});

app.all("/mcp", (_request: Request, response: Response) => {
  response.status(405).set("allow", "POST").json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed" },
    id: null,
  });
});

app.listen(port, (error?: Error) => {
  if (error) {
    console.error("Failed to start StopScore Builder MCP", error);
    process.exitCode = 1;
    return;
  }
  console.error(`StopScore Builder MCP listening on http://localhost:${port}/mcp`);
});
