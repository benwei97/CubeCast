import { strict as assert } from "node:assert";
import { getNextTargetWeekend, getTargetWeekend, getWeekendPublicationError, getWeekendSunday, overlapsTargetWeekend } from "../src/lib/contest-weekend";
import { getSelectedContestTiming } from "../src/lib/contest-workflow";

const date = (value: string) => new Date(`${value}T00:00:00Z`);
const saturday = date("2026-09-19");
assert.equal(getNextTargetWeekend(new Date("2026-09-17T23:30:00Z")).toISOString(), saturday.toISOString());
assert.equal(getNextTargetWeekend(date("2026-09-19")).toISOString(), date("2026-09-26").toISOString());
assert.equal(getNextTargetWeekend(date("2026-09-20")).toISOString(), date("2026-09-26").toISOString());
assert.equal(getNextTargetWeekend(date("2026-12-31")).toISOString(), date("2027-01-02").toISOString());
assert.equal(getWeekendSunday(saturday).toISOString(), date("2026-09-20").toISOString());
assert.equal(getTargetWeekend({ targetWeekend: "2026-09-19" }, date("2026-10-01")).toISOString(), saturday.toISOString(), "Refresh must not move a pinned weekend");
assert.equal(getTargetWeekend({ windowStart: "2026-09-19", windowEnd: "2026-10-03" }, date("2026-09-17")).toISOString(), saturday.toISOString(), "Legacy rolling windows do not determine the new anchor");
for (const invalid of ["2026-09-18", "2026-02-30", "invalid", "2026-09-19T00:00:00Z"]) {
  assert.throws(() => getTargetWeekend({ targetWeekend: invalid }, date("2026-09-17")));
}
for (const [start, end, expected] of [
  ["2026-09-19", "2026-09-19", true],
  ["2026-09-19", "2026-09-20", true],
  ["2026-09-18", "2026-09-20", true],
  ["2026-09-19", "2026-09-21", true],
  ["2026-09-17", "2026-09-20", true],
  ["2026-09-18", "2026-09-21", true],
  ["2026-09-17", "2026-09-22", true],
  ["2026-09-20", "2026-09-22", true],
  ["2026-09-17", "2026-09-19", true],
  ["2026-09-15", "2026-09-17", false],
  ["2026-09-21", "2026-09-25", false],
  ["2026-09-26", "2026-09-27", false],
  ["2026-09-12", "2026-09-13", false],
  ["2026-09-20", "2026-09-19", false]
] as const) {
  assert.equal(overlapsTargetWeekend(date(start), date(end), saturday), expected, `${start} through ${end}`);
}
assert.equal(overlapsTargetWeekend(null, saturday, saturday), false);
assert.equal(overlapsTargetWeekend(new Date("invalid"), saturday, saturday), false);
const timing = getSelectedContestTiming([
  { startDate: date("2026-09-18"), endDate: date("2026-09-20") },
  { startDate: date("2026-09-19"), endDate: date("2026-09-22") }
]);
assert.equal(timing.lockAt.toISOString(), "2026-09-17T23:00:00.000Z");
assert.equal(timing.endsAt.toISOString(), "2026-09-22T00:00:00.000Z", "Full competition duration is retained");
const policy = { targetWeekend: "2026-09-19", weekendPolicyVersion: 1 };
const validCompetitions = [{ startDate: date("2026-09-18"), endDate: date("2026-09-21") }];
assert.equal(getWeekendPublicationError(policy, validCompetitions, date("2026-09-17")), null);
assert.match(getWeekendPublicationError({}, validCompetitions, date("2026-09-17"))!, /Refresh/);
assert.match(getWeekendPublicationError(policy, [...validCompetitions, { startDate: date("2026-09-26"), endDate: date("2026-09-27") }], date("2026-09-17"))!, /Every included competition/);
console.log("Contest weekend tests passed.");
