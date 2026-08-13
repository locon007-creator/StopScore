import { resolve } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { getProjectContract } from "./project-contract.ts";
import {
  contractResource,
  releasePolicyResource,
  resourceUris,
  statusSummary,
  textResource,
  workflowResource,
} from "./resources.ts";
import { StatusStore } from "./status-store.ts";
import { createWorkPackage } from "./work-packages.ts";

export interface StopScoreMcpOptions {
  statusPath?: string;
}

const statusOutput = {
  milestone: z.string(),
  changeCount: z.number(),
  verificationCount: z.number(),
  blockers: z.array(z.string()),
  releaseReady: z.boolean(),
  reviewHandoff: z.unknown().nullable(),
  confirmedVersion: z.string().nullable(),
};

const text = (message: string) => [{ type: "text" as const, text: message }];

export function createStopScoreMcpServer(options: StopScoreMcpOptions = {}) {
  const statusPath =
    options.statusPath ??
    resolve(process.cwd(), "tools/stopscore-mcp/data/status.json");
  const store = new StatusStore(statusPath);
  const server = new McpServer(
    { name: "stopscore-builder", version: "0.1.0" },
    {
      instructions:
        "Before changing StopScore, call get_project_contract and get_completion_status. Work only from approved requirements, preserve saved data, and use minimum-change work packages. Never publish production without exact-version confirmation from Jose.",
    },
  );

  server.registerResource(
    "StopScore project contract",
    resourceUris.contract,
    { title: "StopScore project contract", mimeType: "application/json" },
    async () => textResource(resourceUris.contract, contractResource()),
  );
  server.registerResource(
    "StopScore project status",
    resourceUris.status,
    { title: "StopScore project status", mimeType: "application/json" },
    async () => textResource(resourceUris.status, statusSummary(await store.read())),
  );
  server.registerResource(
    "StopScore driver workflow",
    resourceUris.workflow,
    { title: "StopScore driver workflow", mimeType: "application/json" },
    async () => textResource(resourceUris.workflow, workflowResource()),
  );
  server.registerResource(
    "StopScore release policy",
    resourceUris.releasePolicy,
    { title: "StopScore release policy", mimeType: "application/json" },
    async () =>
      textResource(resourceUris.releasePolicy, releasePolicyResource()),
  );

  server.registerTool(
    "get_project_contract",
    {
      title: "Get StopScore project contract",
      description:
        "Use this when beginning or resuming StopScore work so approved requirements and protected systems are loaded before any change.",
      inputSchema: {},
      outputSchema: {
        product: z.string(),
        projectSlug: z.string(),
        approvedSpecification: z.string(),
        workflow: z.array(z.string()),
        lockedRules: z.array(z.string()),
        protectedSystems: z.array(z.string()),
        releasePolicy: z.object({
          keepCurrentLiveVersionProtected: z.boolean(),
          productionRequiresExactVersionConfirmation: z.boolean(),
          checkpointMustRemainOwnerOnly: z.boolean(),
        }),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
        idempotentHint: true,
      },
    },
    async () => {
      const contract = getProjectContract();
      return {
        structuredContent: contract as unknown as Record<string, unknown>,
        content: text("Loaded the approved StopScore project contract."),
      };
    },
  );

  server.registerTool(
    "get_completion_status",
    {
      title: "Get StopScore completion status",
      description:
        "Use this when deciding what approved StopScore work remains or whether the current version is ready for owner testing.",
      inputSchema: {},
      outputSchema: statusOutput,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
        idempotentHint: true,
      },
    },
    async () => {
      const summary = statusSummary(await store.read());
      return {
        structuredContent: summary,
        content: text(
          summary.releaseReady
            ? "StopScore has passing release evidence for the recorded version."
            : `StopScore is ${summary.milestone} with ${summary.blockers.length} recorded blocker(s).`,
        ),
      };
    },
  );

  server.registerTool(
    "create_work_package",
    {
      title: "Create a bounded StopScore work package",
      description:
        "Use this when one approved gap needs a minimum-change implementation brief. Do not use it to add unapproved features or redesign unrelated screens.",
      inputSchema: {
        gapId: z.string().min(3).max(100),
        goal: z.string().min(10).max(500),
        allowedFiles: z.array(z.string()).min(1).max(20),
        acceptanceCriteria: z.array(z.string()).min(1).max(20),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
        idempotentHint: true,
      },
    },
    async (input) => {
      const workPackage = createWorkPackage(input);
      return {
        structuredContent: workPackage,
        content: text(`Created bounded work package ${workPackage.id}.`),
      };
    },
  );

  server.registerTool(
    "record_change",
    {
      title: "Record a completed StopScore change",
      description:
        "Use this after completing one approved bounded change to record affected files and satisfied acceptance criteria.",
      inputSchema: {
        idempotencyKey: z.string().min(3).max(160),
        summary: z.string().min(5).max(1000),
        files: z.array(z.string()).min(1).max(100),
        acceptanceCriteria: z.array(z.string()).min(1).max(100),
        metadata: z.record(z.string(), z.unknown()).optional(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
        idempotentHint: true,
      },
    },
    async (input) => {
      const status = await store.recordChange(input);
      return {
        structuredContent: { changeCount: status.changes.length },
        content: text(`Recorded ${status.changes.length} completed change(s).`),
      };
    },
  );

  server.registerTool(
    "record_verification",
    {
      title: "Record StopScore verification evidence",
      description:
        "Use this after running a real verification command or preview check for one immutable StopScore version.",
      inputSchema: {
        idempotencyKey: z.string().min(3).max(160),
        versionId: z.string().min(3).max(200),
        command: z.string().min(2).max(500),
        status: z.enum(["passed", "failed", "blocked"]),
        summary: z.string().min(3).max(2000),
        requiredForRelease: z.boolean(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
        idempotentHint: true,
      },
    },
    async (input) => {
      const status = await store.recordVerification(input);
      const summary = statusSummary(status);
      return {
        structuredContent: summary,
        content: text(
          summary.releaseReady
            ? "Recorded passing release evidence."
            : "Recorded verification evidence; the release remains blocked.",
        ),
      };
    },
  );

  server.registerTool(
    "get_review_handoff",
    {
      title: "Get StopScore owner-testing handoff",
      description:
        "Use this when Jose is ready to test the completed owner-only StopScore checkpoint and needs the exact URL, limitations, and finishing touches.",
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
        idempotentHint: true,
      },
    },
    async () => {
      const status = await store.read();
      return {
        structuredContent: {
          available: status.reviewHandoff !== null,
          handoff: status.reviewHandoff,
          blockers: status.blockers,
        },
        content: text(
          status.reviewHandoff
            ? "The owner-testing handoff is ready."
            : "No owner-testing checkpoint has been recorded yet.",
        ),
      };
    },
  );

  server.registerTool(
    "confirm_production_release",
    {
      title: "Confirm an exact StopScore production release",
      description:
        "Use this only after Jose explicitly confirms the exact immutable StopScore version that he tested. Never infer confirmation from general approval.",
      inputSchema: {
        versionId: z.string().min(3).max(200),
        confirmationText: z.string().min(3).max(500),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: true,
        idempotentHint: true,
      },
    },
    async (input) => {
      const status = await store.confirmProductionRelease(input);
      return {
        structuredContent: {
          confirmedVersion: status.releaseConfirmation?.versionId ?? null,
          confirmedAt: status.releaseConfirmation?.confirmedAt ?? null,
        },
        content: text(
          `Recorded explicit production confirmation for ${status.releaseConfirmation?.versionId}.`,
        ),
      };
    },
  );

  return server;
}
