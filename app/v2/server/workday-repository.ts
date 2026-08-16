import type {
  ExperienceInput,
  StopAction,
  StopKnowledgeSummary,
  StopState,
  WorkdayAggregate,
} from "../domain/workday.ts";

export type IdempotentWrite = {
  driverId: string;
  key: string;
  operation: string;
  now: string;
};

export interface WorkdayRepository {
  getCurrent(driverId: string): Promise<WorkdayAggregate | null>;
  start(aggregate: WorkdayAggregate, dayDate: string, write: IdempotentWrite): Promise<WorkdayAggregate>;
  recordStopEvent(
    stopId: string,
    action: StopAction,
    expectedState: StopState,
    nextState: StopState,
    write: IdempotentWrite,
  ): Promise<WorkdayAggregate>;
  publishExperience(stopId: string, experience: ExperienceInput, write: IdempotentWrite): Promise<WorkdayAggregate>;
  finish(workdayId: string, write: IdempotentWrite, endingOdometer: string | null): Promise<WorkdayAggregate>;
  /** Aggregated across every driver and every day for this place. Null when nobody has published one yet. */
  getStopKnowledge(providerId: string): Promise<StopKnowledgeSummary | null>;
}
