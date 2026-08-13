# StopScore Builder MCP

Private, tool-only MCP server for the StopScore Driver OS project. It supplies the approved project contract, bounded work packages, completion status, verification evidence, and an exact-version production confirmation gate.

## Local use

From the StopScore repository root:

```bash
npm run mcp:test
npm run mcp:typecheck
npm run mcp:start
```

The stdio server persists non-secret project status at `tools/stopscore-mcp/data/status.json`. Override it with `STOPSCORE_STATUS_PATH` when a separate status file is required.

## Inspector

```bash
npx @modelcontextprotocol/inspector@latest \
  node --import tsx tools/stopscore-mcp/src/stdio.ts
```

Verify all seven tools, four resources, input validation, annotations, idempotent evidence writes, and exact-version release confirmation.

## Streamable HTTP

```bash
npm run mcp:start:http
```

The local endpoint is `http://localhost:8788/mcp`; health is available at `http://localhost:8788/health`. For private ChatGPT testing, expose it through Secure MCP Tunnel or another approved HTTPS development tunnel. Do not publish the status file or add credentials to the repository.

## Connect in ChatGPT

1. Open **Settings → Security and login** and enable **Developer mode**.
2. Open **ChatGPT Plugins**, select **+**, and create a private app.
3. Choose Secure MCP Tunnel, or paste the approved HTTPS endpoint ending in `/mcp`.
4. Name it **StopScore Builder** and verify the discovered tools before enabling write tools.
5. Start a new chat, enable StopScore Builder, and ask it to load `get_project_contract` followed by `get_completion_status`.

Production release confirmation is only a recorded authorization boundary. Publication remains a separate deployment operation against the exact confirmed immutable version.

