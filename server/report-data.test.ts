import assert from "node:assert/strict";
import test from "node:test";
import type { CallOrder } from "../shared/types.ts";
import { buildReportsData, reportPeriodStatus } from "./report-data.ts";

const order = (input: Partial<CallOrder> & Pick<CallOrder, "id" | "groupKey" | "funded" | "spend">): CallOrder => ({
  groupName: "Example Support", name: "Example Support", description: "", narrative: "", pop: "1/1/26 – 12/31/26",
  popStart: "2026-01-01", popEnd: "2026-12-31", eac: null, over: null, pm: "PM", pending: false,
  highlights: [], finUpdatedOn: "2026-01-01", peopleUpdatedOn: "2026-01-01", laborCategories: [], staff: [],
  weeklyReports: [], clins: [], invoices: [], contractDocuments: [], deliverables: [], risks: [], issues: [], actionItems: [],
  ...input,
});

test("BPA report rolls funded periods into a reconciled call order total", () => {
  const data = buildReportsData([
    order({ id: "Call 13.1", groupKey: "Call 013", funded: 100.10, spend: 40.05, popEnd: "2026-06-30" }),
    order({ id: "Call 13.2", groupKey: "Call 013", funded: 200.20, spend: 10.15, popStart: "2026-07-01", popEnd: "2027-06-30" }),
  ], "2026-10-28");

  assert.equal(data.bpa.callOrders.length, 1);
  assert.equal(data.bpa.callOrders[0].status, "active");
  assert.equal(data.bpa.callOrders[0].periods.length, 2);
  assert.equal(data.bpa.obligated, 300.30);
  assert.equal(data.bpa.expended, 50.20);
  assert.equal(data.bpa.remaining, 250.10);
});

test("periods become inactive only after their POP end date", () => {
  assert.equal(reportPeriodStatus("2026-10-27", "2026-10-28"), "inactive");
  assert.equal(reportPeriodStatus("2026-10-28", "2026-10-28"), "active");
  assert.equal(reportPeriodStatus(null, "2026-10-28"), "active");
});

test("staffing report excludes vacant placeholders but retains named personnel", () => {
  const data = buildReportsData([order({
    id: "Call 2.3", groupKey: "Call 002", funded: 1, spend: 0,
    staff: [
      { id: 1, name: "Jane Person", laborCategory: "Engineer", rate: 125, status: "Assigned" } as CallOrder["staff"][number],
      { id: 2, name: "VACANT – Engineer", laborCategory: "Engineer", rate: 125, status: "Vacant" } as CallOrder["staff"][number],
      { id: 3, name: "Former Person", laborCategory: "Analyst", rate: 95, status: "Offboarded" } as CallOrder["staff"][number],
    ],
  })], "2026-10-28");

  assert.deepEqual(data.staffing.map((row) => row.name), ["Former Person", "Jane Person"]);
});
