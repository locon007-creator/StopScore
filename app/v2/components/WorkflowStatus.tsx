"use client";

import { useEffect } from "react";
import type { WorkdayAggregate } from "../domain/workday.ts";
import { resolveWorkflowPresentation } from "../workflow/model.ts";

export function WorkflowStatus({ workday }: { workday: WorkdayAggregate }) {
  const presentation = resolveWorkflowPresentation(workday);
  useEffect(() => {
    const frame = requestAnimationFrame(() => document.getElementById(presentation.focusId)?.focus());
    return () => cancelAnimationFrame(frame);
  }, [presentation.focusId]);
  return <p className="v2-sr-status" aria-live="polite">{presentation.announcement}</p>;
}
