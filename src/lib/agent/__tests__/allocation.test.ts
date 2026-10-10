import { describe, expect, it } from "vitest";
import { allocatePayment } from "../allocation";
import type { Pot } from "@/types/domain";

function makePots(allocations: number[]): Pot[] {
  return allocations.map((pct, idx) => ({
    id: `pot_${idx}`,
    key: `pot_${idx}`,
    name: `Pot ${idx}`,
    allocation_pct: pct,
    balance_cents: 0,
    paypal_payout_receiver: `pot${idx}@example.com`,
    color: "#000000",
  }));
}

describe("allocatePayment", () => {
  it("splits an amount exactly according to allocation percentages", () => {
    const pots = makePots([0.3, 0.2, 0.15, 0.35]);
    const result = allocatePayment(100_000, pots);

    expect(result).toHaveLength(4);
    expect(result.reduce((s, l) => s + l.amountCents, 0)).toBe(100_000);
  });

  it("always sums exactly to the input amount even with rounding-unfriendly splits", () => {
    const pots = makePots([1 / 3, 1 / 3, 1 / 3]);
    const result = allocatePayment(100, pots);

    expect(result.reduce((s, l) => s + l.amountCents, 0)).toBe(100);
  });

  it("assigns rounding remainder to the largest-allocation pot", () => {
    const pots = makePots([0.7, 0.3]);
    const result = allocatePayment(101, pots);

    const total = result.reduce((s, l) => s + l.amountCents, 0);
    expect(total).toBe(101);
    const biggest = result.find((l) => l.potId === "pot_0")!;
    expect(biggest.amountCents).toBeGreaterThanOrEqual(Math.floor(101 * 0.7));
  });

  it("returns an empty array when there are no pots", () => {
    expect(allocatePayment(1000, [])).toEqual([]);
  });

  it("handles a single pot by routing the entire amount to it", () => {
    const pots = makePots([1]);
    const result = allocatePayment(54_321, pots);
    expect(result).toEqual([{ potId: "pot_0", potKey: "pot_0", amountCents: 54_321 }]);
  });
});
