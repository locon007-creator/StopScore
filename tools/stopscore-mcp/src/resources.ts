import type { ProjectStatus } from "./status-store.ts";
import { getProjectContract } from "./project-contract.ts";

export const resourceUris = {
  contract: "stopscore://project/contract",
  status: "stopscore://project/status",
  workflow: "stopscore://project/workflow",
  releasePolicy: "stopscore://project/release-policy",
} as const;

export function contractResource() {
  return getProjectContract();
}

export function workflowResource() {
  const contract = getProjectContract();
  return {
    workflow: contract.workflow,
    operatingBoundary:
      "StopScore records the driver day and opens external maps; it does not provide GPS or route optimization.",
    experienceOrder: [
      "Yard",
      "Staging",
      "Staff",
      "Waiting Time",
      "Bathroom",
      "Publish",
    ],
  };
}

export function releasePolicyResource() {
  return {
    currentLiveVersion: "protected",
    reviewSurface: "owner-only immutable checkpoint",
    productionRule:
      "Jose must explicitly confirm the exact tested immutable version before production replacement.",
    requiredEvidence: [
      "lint",
      "full automated tests",
      "production build and artifact validation",
      "mobile workflow preview or a disclosed environment blocker",
    ],
  };
}

export function statusSummary(status: ProjectStatus) {
  return {
    milestone: status.milestone,
    changeCount: status.changes.length,
    verificationCount: status.verifications.length,
    blockers: status.blockers,
    releaseReady: status.releaseReady,
    reviewHandoff: status.reviewHandoff,
    confirmedVersion: status.releaseConfirmation?.versionId ?? null,
  };
}

export function textResource(uri: string, value: unknown) {
  return {
    contents: [
      {
        uri,
        mimeType: "application/json",
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

