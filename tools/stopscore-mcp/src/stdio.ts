import { resolve } from "node:path";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { createStopScoreMcpServer } from "./server.ts";

const statusPath =
  process.env.STOPSCORE_STATUS_PATH ??
  resolve(process.cwd(), "tools/stopscore-mcp/data/status.json");
const server = createStopScoreMcpServer({ statusPath });
const transport = new StdioServerTransport();

await server.connect(transport);

