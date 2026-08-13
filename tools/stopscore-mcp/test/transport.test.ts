import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { createHttpRequestHandler } from "../src/http-handler.ts";

test("HTTP handler exposes health and rejects unsupported MCP methods", async () => {
  const directory = await mkdtemp(join(tmpdir(), "stopscore-http-"));
  const handle = createHttpRequestHandler({
    statusPath: join(directory, "status.json"),
  });

  const health = await handle(new Request("http://localhost/health"));
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), {
    ok: true,
    service: "stopscore-builder",
    version: "0.1.0",
  });

  const unsupported = await handle(
    new Request("http://localhost/mcp", { method: "PUT" }),
  );
  assert.equal(unsupported.status, 405);
  assert.equal(unsupported.headers.get("allow"), "POST");
});

test("HTTP handler completes MCP initialization over streamable HTTP", async () => {
  const directory = await mkdtemp(join(tmpdir(), "stopscore-http-"));
  const handle = createHttpRequestHandler({
    statusPath: join(directory, "status.json"),
  });
  const request = new Request("http://localhost/mcp", {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "transport-test", version: "1.0.0" },
      },
    }),
  });

  const response = await handle(request);
  const payload = await response.json() as {
    result?: { serverInfo?: { name?: string } };
  };

  assert.equal(response.status, 200);
  assert.equal(payload.result?.serverInfo?.name, "stopscore-builder");
});

