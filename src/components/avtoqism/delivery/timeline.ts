/**
 * Reading the server's timeline, without drawing it.
 *
 * Kept apart from the component so the order list can label a card without
 * pulling the whole progress row in with it.
 */
import type { DeliveryStep, DeliveryTimeline } from "@/lib/query/commerce";

/**
 * A cancelled order keeps the timestamps of the steps it did pass, but the
 * server lights nothing up — there is no live step any more. Those steps are
 * still true, so they are drawn as reached and simply not highlighted.
 */
export function reached(step: DeliveryStep): boolean {
  return step.state === "done" || (step.state === "upcoming" && step.at !== null);
}

/** What the order list shows: the lit step's label, or the notice instead. */
export function currentStageLabel(timeline: DeliveryTimeline | null | undefined): string | null {
  if (!timeline) return null;
  if (timeline.notice) return timeline.notice;
  const current = timeline.steps.find((step) => step.state === "active");
  return current?.label ?? null;
}
