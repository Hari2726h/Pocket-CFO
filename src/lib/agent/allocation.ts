import type { Pot } from "@/types/domain";

export interface AllocationLine {
  potId: string;
  potKey: string;
  amountCents: number;
}

/**
 * Splits a collected payment across pots by their allocation_pct, with any
 * leftover cent(s) from integer rounding assigned to the largest-allocation
 * pot so the split always sums to exactly amountCents.
 */
export function allocatePayment(amountCents: number, pots: Pot[]): AllocationLine[] {
  if (pots.length === 0) return [];

  const totalPct = pots.reduce((sum, p) => sum + p.allocation_pct, 0);
  const lines = pots.map((p) => ({
    potId: p.id,
    potKey: p.key,
    amountCents: Math.floor((amountCents * p.allocation_pct) / totalPct),
  }));

  const allocated = lines.reduce((sum, l) => sum + l.amountCents, 0);
  const remainder = amountCents - allocated;

  if (remainder > 0) {
    const biggest = [...pots].sort((a, b) => b.allocation_pct - a.allocation_pct)[0]!;
    const target = lines.find((l) => l.potId === biggest.id)!;
    target.amountCents += remainder;
  }

  return lines;
}
