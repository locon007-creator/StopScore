# StopScore Builder MCP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and validate a private tool-only MCP server that carries the approved StopScore contract, guides minimum-change completion work, records evidence, and gates production release on explicit confirmation of one immutable version.

**Architecture:** Add a focused TypeScript MCP package under `tools/stopscore-mcp/` so it can version with the application without entering the application runtime. Pure domain modules own contract/status validation, while one server module registers resources and tools for both stdio and streamable HTTP transports. JSON status files contain non-secret project state and evidence.

**Tech Stack:** TypeScript 5.9, Node 22, `@modelcontextprotocol/sdk`, Zod, Node test runner.

## Global Constraints

- The approved source is `docs/superpowers/specs/2026-08-13-stopscore-builder-mcp-design.md`.
- Never expose credentials, access tokens, personal email, or connector identifiers.
- Never use the word “review” in user-facing StopScore application copy.
- Production confirmation is bound to one immutable version and must be explicit.
- Keep the MCP tool-only; do not add a widget.
- Preserve the existing application package manager, lockfile, runtime, and build scripts.

---

### Task 1: Add the project knowledge and status domain

**Files:**
- Create: `tools/stopscore-mcp/src/project-contract.ts`
- Create: `tools/stopscore-mcp/src/status-store.ts`
- Create: `tools/stopscore-mcp/data/status.json`
- Test: `tools/stopscore-mcp/test/project-domain.test.ts`

**Interfaces:**
- Produces: `getProjectContract(): ProjectContract`, `StatusStore.read(): ProjectStatus`, `StatusStore.recordChange(input)`, and `StatusStore.recordVerification(input)`.
- Consumes: approved design files and repository-relative paths only.

- [ ] Write domain tests proving locked rules are present, stale requirements are absent, path traversal is rejected, and secrets cannot be stored.
- [ ] Run the focused tests and confirm they fail because the modules do not exist.
- [ ] Implement immutable contract data, Zod status schemas, atomic status writes, and deterministic status summaries.
- [ ] Rerun focused tests and confirm they pass.
- [ ] Commit the independently testable domain layer.

### Task 2: Register MCP resources and read-only planning tools

**Files:**
- Create: `tools/stopscore-mcp/src/server.ts`
- Create: `tools/stopscore-mcp/src/resources.ts`
- Create: `tools/stopscore-mcp/src/work-packages.ts`
- Test: `tools/stopscore-mcp/test/read-tools.test.ts`

**Interfaces:**
- Consumes: `getProjectContract()` and `StatusStore.read()`.
- Produces: resources `stopscore://project/{contract,status,workflow,release-policy}` and tools `get_project_contract`, `get_completion_status`, `create_work_package`, `get_review_handoff`.

- [ ] Write in-memory MCP client tests that list resources/tools and call each read-only tool with valid and invalid inputs.
- [ ] Run the tests and confirm registration failures.
- [ ] Register focused tools with `Use this when...` descriptions, explicit schemas, output schemas, and accurate annotations.
- [ ] Return concise `structuredContent` plus model-readable `content`; never return repository secrets.
- [ ] Rerun read-tool tests and confirm they pass.
- [ ] Commit the read-only MCP surface.

### Task 3: Add controlled evidence and release-confirmation tools

**Files:**
- Modify: `tools/stopscore-mcp/src/server.ts`
- Modify: `tools/stopscore-mcp/src/status-store.ts`
- Test: `tools/stopscore-mcp/test/write-tools.test.ts`

**Interfaces:**
- Produces: `record_change`, `record_verification`, and `confirm_production_release`.
- Preserves: immutable version binding through `{ versionId, confirmationText, confirmedAt }`.

- [ ] Write tests for accepted evidence, rejected failing release evidence, forbidden feature conflicts, redacted secrets, vague confirmation rejection, and version mismatch rejection.
- [ ] Run the tests and confirm failures.
- [ ] Implement schema-validated writes with idempotency keys and exact-version confirmation.
- [ ] Mark release confirmation destructive/open-world and all local evidence writes non-destructive/closed-world.
- [ ] Rerun tests and confirm they pass.
- [ ] Commit the controlled write surface.

### Task 4: Add stdio, HTTP, package, and operator entry points

**Files:**
- Create: `tools/stopscore-mcp/src/stdio.ts`
- Create: `tools/stopscore-mcp/src/http.ts`
- Create: `tools/stopscore-mcp/package.json`
- Create: `tools/stopscore-mcp/tsconfig.json`
- Create: `tools/stopscore-mcp/README.md`
- Modify: root `package.json`
- Test: `tools/stopscore-mcp/test/transport.test.ts`

**Interfaces:**
- Produces: `npm run mcp:dev`, `npm run mcp:test`, `npm run mcp:inspect`, and streamable HTTP `/mcp`.
- Consumes: `createStopScoreMcpServer(options)` from `server.ts`.

- [ ] Write transport tests for initialization, tool listing, health response, unsupported methods, and isolated sessions.
- [ ] Run transport tests and confirm failures.
- [ ] Implement stdio and streamable HTTP entry points without embedding credentials.
- [ ] Add exact local run, Inspector, HTTPS/tunnel, and ChatGPT developer-mode connection instructions.
- [ ] Run typecheck and all MCP tests.
- [ ] Commit the runnable MCP package.

### Task 5: Validate and package the private MCP handoff

**Files:**
- Create: `docs/qa/stopscore-builder-mcp.md`
- Modify: `tools/stopscore-mcp/data/status.json`

**Interfaces:**
- Consumes: final MCP commands and Inspector output.
- Produces: documented connection URL/tunnel requirement, tool inventory, evaluation prompts, and exact remaining account-side connection step.

- [ ] Run every MCP tool with representative, invalid, and boundary inputs.
- [ ] Run the MCP test suite, root type checks, secret scan, and package validation.
- [ ] Inspect tools/resources with MCP Inspector and record observed annotations and schemas.
- [ ] Record evidence in `docs/qa/stopscore-builder-mcp.md` and the MCP status store.
- [ ] Commit the verified MCP handoff.

