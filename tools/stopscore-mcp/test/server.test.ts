import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import { createStopScoreMcpServer } from "../src/server.ts";

async function connectedClient() {
  const directory = await mkdtemp(join(tmpdir(), "stopscore-mcp-"));
  const server = createStopScoreMcpServer({
    statusPath: join(directory, "status.json"),
  });
  const client = new Client({ name: "stopscore-test", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
  return { client, server };
}

test("server advertises focused tools with accurate safety annotations", async () => {
  const { client, server } = await connectedClient();
  const result = await client.listTools();
  const tools = new Map(result.tools.map((tool) => [tool.name, tool]));

  assert.deepEqual([...tools.keys()].sort(), [
    "confirm_production_release",
    "create_work_package",
    "get_completion_status",
    "get_project_contract",
    "get_review_handoff",
    "record_change",
    "record_verification",
  ]);
  assert.equal(tools.get("get_project_contract")?.annotations?.readOnlyHint, true);
  assert.equal(tools.get("record_change")?.annotations?.destructiveHint, false);
  assert.equal(
    tools.get("confirm_production_release")?.annotations?.destructiveHint,
    true,
  );
  assert.equal(
    tools.get("confirm_production_release")?.annotations?.openWorldHint,
    true,
  );

  await client.close();
  await server.close();
});

test("project resources return the authoritative contract and release policy", async () => {
  const { client, server } = await connectedClient();
  const listed = await client.listResources();

  assert.deepEqual(
    listed.resources.map((resource) => resource.uri).sort(),
    [
      "stopscore://project/contract",
      "stopscore://project/release-policy",
      "stopscore://project/status",
      "stopscore://project/workflow",
    ],
  );

  const contract = await client.readResource({
    uri: "stopscore://project/contract",
  });
  const firstContent = contract.contents[0];
  assert.equal(firstContent && "text" in firstContent, true);
  const contractText = firstContent && "text" in firstContent ? firstContent.text : "";
  assert.match(contractText, /StopScore Driver OS/);
  assert.match(contractText, /productionRequiresExactVersionConfirmation/);

  await client.close();
  await server.close();
});

test("read and write tools return structured project state", async () => {
  const { client, server } = await connectedClient();
  const contract = await client.callTool({
    name: "get_project_contract",
    arguments: {},
  });
  assert.equal(
    (contract.structuredContent as { product?: string })?.product,
    "StopScore Driver OS",
  );

  const change = await client.callTool({
    name: "record_change",
    arguments: {
      idempotencyKey: "server-change-1",
      summary: "Completed one bounded setup correction.",
      files: ["app/v2/components/EquipmentFlow.tsx"],
      acceptanceCriteria: ["Tractor selection opens trailer selection."],
    },
  });
  assert.equal(
    (change.structuredContent as { changeCount?: number })?.changeCount,
    1,
  );

  const status = await client.callTool({
    name: "get_completion_status",
    arguments: {},
  });
  assert.equal(
    (status.structuredContent as { changeCount?: number })?.changeCount,
    1,
  );

  await client.close();
  await server.close();
});
