# StopScore Builder MCP Verification

Date: 2026-08-13

## Installation

The repository includes a project-scoped Codex MCP registration in `.codex/config.toml`. When the repository is trusted, Codex starts the server over stdio with `node --import tsx tools/stopscore-mcp/src/stdio.ts`.

`AGENTS.md` requires future StopScore work to load the project contract and completion status before planning or writing code.

## Capabilities

- Returns the authoritative StopScore product contract and protected boundaries.
- Reports implementation status, blockers, verification evidence, and owner-test handoff state.
- Creates bounded work packages with allowed-file limits.
- Records sanitized change and verification evidence.
- Rejects paths outside the StopScore repository.
- Requires explicit confirmation and passing evidence for an exact production release.
- Supports both stdio and streamable HTTP transports.

## Evidence

| Gate | Result |
|---|---|
| MCP TypeScript typecheck | Pass |
| Contract, status, safety, resource, and work-package tests | Pass |
| stdio/server tool registration tests | Pass |
| Streamable HTTP initialization test | Pass |
| Total MCP tests | 11/11 pass |

ChatGPT web does not load repository-local Codex configuration. Connecting this server directly in ChatGPT requires the normal remote HTTPS endpoint and ChatGPT developer-mode connector step after deployment.
