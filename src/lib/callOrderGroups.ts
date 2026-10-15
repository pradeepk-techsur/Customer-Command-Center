import type { CallOrder } from "../../shared/types.ts";
import { periodState } from "./format.ts";

export interface CallOrderGroup {
  key: string;
  name: string;
  periods: CallOrder[];
  current: CallOrder;
}

const byNewestStart = (a: CallOrder, b: CallOrder) =>
  String(b.popStart || "").localeCompare(String(a.popStart || ""))
  || String(b.popEnd || "").localeCompare(String(a.popEnd || ""))
  || b.id.localeCompare(a.id);

const byNewestEnd = (a: CallOrder, b: CallOrder) =>
  String(b.popEnd || "").localeCompare(String(a.popEnd || ""))
  || byNewestStart(a, b);

const byEarliestStart = (a: CallOrder, b: CallOrder) =>
  String(a.popStart || "").localeCompare(String(b.popStart || ""))
  || a.id.localeCompare(b.id);

/**
 * Select the effective period for a call-order family.
 * If periods overlap, the most recently started active period wins instead of
 * whichever period happened to be returned first by the database.
 */
export function effectivePeriod(periods: CallOrder[], today: string): CallOrder {
  if (!periods.length) throw new Error("Cannot select an effective period from an empty list.");

  const active = periods.filter((p) => periodState(p, today) === "current").sort(byNewestStart);
  if (active[0]) return active[0];

  const prior = periods.filter((p) => periodState(p, today) === "prior").sort(byNewestEnd);
  if (prior[0]) return prior[0];

  const upcoming = periods.filter((p) => periodState(p, today) === "upcoming").sort(byEarliestStart);
  return upcoming[0] || periods[0];
}

/** One row per call-order family, rolled up onto its effective funded period. */
export function groupCallOrders(orders: CallOrder[], today: string): CallOrderGroup[] {
  const groups: CallOrderGroup[] = [];
  for (const order of orders) {
    let group = groups.find((candidate) => candidate.key === order.groupKey);
    if (!group) {
      group = { key: order.groupKey, name: order.groupName, periods: [], current: order };
      groups.push(group);
    }
    group.periods.push(order);
  }
  for (const group of groups) group.current = effectivePeriod(group.periods, today);
  return groups;
}
