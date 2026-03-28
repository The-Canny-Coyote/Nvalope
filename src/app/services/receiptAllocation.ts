export function allocateTotalProportionally({
  items,
  totalToAllocate,
}: {
  items: { amount: number }[];
  totalToAllocate: number;
}): number[] {
  const baseSum = items.reduce((s, it) => s + it.amount, 0);
  const target = roundTo2(totalToAllocate);
  if (!(baseSum > 0) || !Number.isFinite(baseSum) || !Number.isFinite(target)) {
    return items.map(() => 0);
  }

  const multiplier = target / baseSum;
  const raw = items.map((it) => it.amount * multiplier);
  const rounded = raw.map((v) => roundTo2(v));
  const roundedSum = roundTo2(rounded.reduce((s, v) => s + v, 0));
  const delta = roundTo2(target - roundedSum);
  if (delta === 0) return rounded;

  // Put remainder on the largest line so totals reconcile exactly.
  let maxIdx = 0;
  for (let i = 1; i < raw.length; i++) if (raw[i] > raw[maxIdx]) maxIdx = i;
  rounded[maxIdx] = roundTo2(rounded[maxIdx] + delta);
  return rounded;
}

function roundTo2(n: number): number {
  return Math.round(n * 100) / 100;
}

