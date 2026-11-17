import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCollegeMajors } from "@/lib/colleges";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), user: vi.fn(), parent: vi.fn(), updateParent: vi.fn(), count: vi.fn(), remove: vi.fn(), updateStudent: vi.fn(), addStudent: vi.fn(), revalidate: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth, currentUser: mocks.user }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/db", () => {
  const tx = { $queryRaw: vi.fn(), parent: { findUnique: mocks.parent, update: mocks.updateParent }, student: { count: mocks.count, deleteMany: mocks.remove, update: mocks.updateStudent, create: mocks.addStudent } };
  return { getPrisma: () => ({ $transaction: (fn: (client: typeof tx) => unknown) => fn(tx) }) };
});
import { saveProfile } from "@/app/profile/actions";

const input = () => ({ parent: { name: "Updated parent", email: "old@example.test", phone: "5551234567", parent2Name: "", parent2Phone: "", parent2Email: "" }, students: [{ id: "student", name: "Updated student", email: "child@example.test", college: "Stanford University", major: getCollegeMajors("Stanford University")[0], dorm: "", phone: "", year: null }] });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ userId: "user" });
  mocks.user.mockResolvedValue({ primaryEmailAddress: { emailAddress: "verified@example.test", verification: { status: "verified" } } });
  mocks.parent.mockResolvedValue({ id: "family" });
  mocks.count.mockResolvedValue(1);
});
describe("profile editing", () => {
  it("updates owned records and uses the verified Clerk primary email", async () => {
    expect((await saveProfile(input())).ok).toBe(true);
    expect(mocks.updateParent).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "family" }, data: expect.objectContaining({ email: "verified@example.test", name: "Updated parent" }) }));
    expect(mocks.updateStudent).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "student", parentId: "family" }, data: expect.objectContaining({ name: "Updated student" }) }));
    expect(mocks.revalidate).toHaveBeenCalledWith("/profile");
  });
  it("rejects a student ID from another family before any write", async () => {
    mocks.count.mockResolvedValue(0);
    expect((await saveProfile(input())).ok).toBe(false);
    expect(mocks.updateParent).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
  });
  it("scopes student deletion to the signed-in family", async () => {
    mocks.count.mockResolvedValue(0);
    expect((await saveProfile({ ...input(), students: [] })).ok).toBe(true);
    expect(mocks.remove).toHaveBeenCalledWith({ where: { parentId: "family", id: { notIn: [] } } });
  });
  it("requires sign-in and verified login email", async () => {
    mocks.auth.mockResolvedValueOnce({ userId: null });
    expect((await saveProfile(input())).ok).toBe(false);
    mocks.user.mockResolvedValueOnce({ primaryEmailAddress: { emailAddress: "new@example.test", verification: { status: "unverified" } } });
    expect((await saveProfile(input())).ok).toBe(false);
    expect(mocks.updateParent).not.toHaveBeenCalled();
  });
});
