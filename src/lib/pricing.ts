/** Sale price from cost and margin percent (markup on cost), rounded to kopecks. */
export function saleFromMargin(cost: number, marginPercent: number): number {
  return Math.round(cost * (1 + marginPercent / 100) * 100) / 100;
}
/** Margin percent implied by a manually set sale price; null when cost is 0. */
export function marginFromSale(cost: number, sale: number): number | null {
  if (!cost) return null;
  return Math.round(((sale - cost) / cost) * 10000) / 100;
}
