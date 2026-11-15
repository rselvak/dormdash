import { describe, expect, it } from "vitest";
import { z } from "zod";
import { participationSummary, waitingListFields } from "@/lib/event-participation";

const schema = z.object(waitingListFields);
describe("waiting list settings", () => {
  it("allows an unlimited waiting list when the maximum is omitted", () => {
    expect(schema.parse({ waitingListAllowed: true })).toEqual({ waitingListAllowed: true });
    expect(schema.parse({ waitingListAllowed: true, maxWaitingList: null }).maxWaitingList).toBeNull();
  });
  it.each([-1, 1.5, "3", "abc", Infinity, 2147483648])("rejects invalid maximum %s", value => {
    expect(schema.safeParse({ waitingListAllowed: true, maxWaitingList: value }).success).toBe(false);
  });
  it("accepts zero and positive whole-number limits", () => {
    for (const maxWaitingList of [0, 1, 100]) expect(schema.safeParse({ waitingListAllowed: true, maxWaitingList }).success).toBe(true);
  });
  it("counts accepted participants separately and exposes the user's response time", () => {
    const joinedAt = new Date("2026-11-15T01:00:00Z");
    expect(participationSummary([
      { parentId: "owner", status: "ACCEPTED", joinedAt },
      { parentId: "waiting", status: "WAITLISTED", joinedAt },
    ], "waiting")).toEqual({ participantCount: 1, waitingListCount: 1, isJoined: true, participationStatus: "WAITLISTED", joinedAt });
  });
});
