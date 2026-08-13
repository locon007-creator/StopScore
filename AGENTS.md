# StopScore project instructions

- Load the `stopscore_builder` MCP server before planning or changing StopScore.
- Call `get_project_contract` followed by `get_completion_status` at the start of StopScore work.
- Use `create_work_package` for each bounded approved gap and preserve the allowed-file boundary.
- Treat `docs/superpowers/specs/2026-08-12-stopscore-complete-workflow-approved.md` as the authoritative application design.
- Preserve authentication, D1 data, saved content, workday ownership, idempotency, canonical OSM search, and in-progress recovery.
- Never add GPS, in-app mapping, route optimization, invented business facts, or unapproved screens.
- Never use the word “review” in user-facing StopScore application copy.
- Keep the live version protected until Jose confirms the exact tested immutable version.
- Run the full release gate and record its evidence before presenting the owner-testing handoff.

