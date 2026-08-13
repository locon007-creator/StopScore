# StopScore Builder MCP — Approved Design

Approved by Jose Adames on 2026-08-13. This specification records the single approval to build the private StopScore project MCP, complete the current StopScore application, run final verification, and provide a driver-testing handoff. Routine implementation decisions do not require additional approval.

## Purpose

The StopScore Builder MCP gives ChatGPT and Codex durable, authoritative project context for StopScore. It prevents rejected designs and stale requirements from returning, reports the current completion state, and supplies bounded workflows for continuing the application. The MCP does not replace the coding agent: it supplies the contract, work state, evidence, and controlled release gates that the coding agent uses while editing the real repository.

## Product shape

- Primary archetype: private, tool-only MCP server.
- Transport: streamable HTTP at `/mcp`, with stdio available for local inspection.
- SDK: TypeScript `@modelcontextprotocol/sdk` with Zod schemas.
- UI: none. StopScore itself is the visual surface and its deployed URL is the review surface.
- Installation target: a private ChatGPT developer-mode plugin connection. A human connection step may be required by ChatGPT account security.

## Authoritative sources

1. `docs/superpowers/specs/2026-08-12-stopscore-complete-workflow-approved.md`
2. The current application source under `app/v2/` and server routes under `app/api/`
3. Current automated tests under `tests/`
4. This document for MCP authority and release behavior

Earlier design boards or specifications may be consulted only when the approved complete-workflow specification explicitly references them. User-facing StopScore copy must never use the word “review.”

## MCP resources

- `stopscore://project/contract` — approved product contract and locked rules.
- `stopscore://project/status` — current milestone, open items, and latest evidence.
- `stopscore://project/workflow` — canonical driver workflow and state boundaries.
- `stopscore://project/release-policy` — preview, confirmation, and production rules.

## MCP tools

### `get_project_contract`

Read-only. Returns the authoritative source list, locked product rules, and current application identity.

### `get_completion_status`

Read-only. Returns milestone status, incomplete acceptance criteria, latest verification evidence, and the recommended next bounded task.

### `create_work_package`

Read-only and idempotent. Converts one approved gap into a minimum-change implementation brief with allowed files, acceptance criteria, and required final tests. It must not invent features or widen scope.

### `record_change`

Mutating but local/project-scoped. Records a completed bounded change, affected files, and the associated acceptance criteria. It rejects records that conflict with locked requirements.

### `record_verification`

Mutating but local/project-scoped. Stores command results and preview observations. A release cannot become review-ready while required evidence is missing or failing.

### `get_review_handoff`

Read-only. Returns the review URL when available, known limitations, driver-test script, and finishing-touches list. It must distinguish automated verification from user testing.

### `confirm_production_release`

Destructive/open-world annotation. Records explicit owner confirmation for one exact immutable version. It does not accept vague approval, cannot approve a moving target, and cannot publish any different version.

## Authority and safety

- The current live StopScore version remains protected during construction.
- Source changes must be minimum necessary and remain within approved scope.
- Existing authentication, D1 data, saved records, ownership rules, idempotency, and OSM place search are preserved.
- No production replacement occurs before Jose confirms the exact tested version.
- Secrets, account tokens, personal email, and deployment credentials are never returned by MCP tools or stored in project status files.
- MCP annotations accurately identify read-only, mutating, destructive, and open-world behavior.
- The server validates every tool input and returns stable structured results.

## Completion workflow

1. Load the authoritative contract and existing status.
2. Inspect the current source and map it against acceptance criteria.
3. Create and execute bounded work packages without redesigning approved screens.
4. Finish construction before the release test pass, except for low-cost compile checks required to prevent compounding breakage.
5. Run full automated verification and production artifact validation.
6. Exercise the primary mobile workflow in the agent preview when the environment permits.
7. Create an immutable owner-only checkpoint for Jose and driver testing.
8. Return the checkpoint, test evidence, known limitations, and finishing-touches list.
9. Publish a production replacement only after Jose confirms that exact checkpoint.

## Acceptance criteria

- The MCP initializes over stdio and streamable HTTP.
- All resources and tools list successfully in MCP Inspector.
- Valid calls return declared structured output; invalid calls return useful schema errors.
- Release confirmation is version-bound and cannot be inferred.
- Project knowledge matches the approved StopScore specification with no stale or forbidden rules.
- The StopScore application passes its release gate and has no dead-end primary workflow.
- A review handoff is produced without changing the live production version before confirmation.

## Documentation basis

- https://developers.openai.com/plugins/build/mcp-server
- https://developers.openai.com/plugins/deploy/connect-chatgpt
- https://developers.openai.com/api/docs/guides/developer-mode

