export interface ProjectContract {
  product: string;
  projectSlug: string;
  approvedSpecification: string;
  workflow: string[];
  lockedRules: string[];
  protectedSystems: string[];
  releasePolicy: {
    keepCurrentLiveVersionProtected: boolean;
    productionRequiresExactVersionConfirmation: boolean;
    checkpointMustRemainOwnerOnly: boolean;
  };
}

const contract: ProjectContract = {
  product: "StopScore Driver OS",
  projectSlug: "stopscore-driver-os",
  approvedSpecification:
    "docs/superpowers/specs/2026-08-12-stopscore-complete-workflow-approved.md",
  workflow: [
    "Home",
    "Equipment",
    "Route",
    "Prepare",
    "Navigate",
    "Arrive",
    "Depart",
    "Experience",
    "Publish",
    "Next Stop or Home Base",
    "Finish Day",
  ],
  lockedRules: [
    "StopScore is a driver day-of operations system, not a GPS or route optimizer.",
    "Use one primary action per state and minimize driver cognitive load.",
    "Light mode uses #FFFFFF for the app background and primary surfaces.",
    "Dark mode remains unchanged unless Jose approves a new design.",
    "Experience order is Yard, Staging, Staff, Waiting Time, Bathroom, Publish.",
    "Scores are whole numbers from 1 through 5.",
    "Only Truck Tractor requires trailer type during setup.",
    "Production publication requires Jose to confirm the exact tested version.",
  ],
  protectedSystems: [
    "ChatGPT authentication and workday ownership",
    "D1 persisted workdays and saved data",
    "Idempotent workday and experience mutations",
    "OSM canonical place search without an embedded map",
    "In-progress setup and experience recovery",
  ],
  releasePolicy: {
    keepCurrentLiveVersionProtected: true,
    productionRequiresExactVersionConfirmation: true,
    checkpointMustRemainOwnerOnly: true,
  },
};

export function getProjectContract(): ProjectContract {
  return structuredClone(contract);
}

