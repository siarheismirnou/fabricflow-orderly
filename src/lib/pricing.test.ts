import { describe, expect, it } from "vitest";
import { marginFromSale, saleFromMargin } from "./pricing";

describe("pricing", () => {
  it("sale price = cost + margin % of cost", () => {
    expect(saleFromMargin(500, 40)).toBe(700);
  });
  it("manual sale price recalculates margin from cost", () => {
    expect(marginFromSale(500, 650)).toBe(30);
    expect(marginFromSale(0, 650)).toBeNull();
  });
});
