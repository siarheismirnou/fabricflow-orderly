import { describe, expect, it } from "vitest";
import { soldOrders, type ReportOrder } from "./reports";
import { canMoveTo } from "./domain";

const now = new Date("2026-10-12T12:00:00Z");
const mk = (days: number, status: ReportOrder["status"], manager = "m1"): ReportOrder => ({
  created_at: new Date(now.getTime() - days * 86400000).toISOString(),
  status,
  manager_id: manager,
  total: 100,
  order_items: [],
});

describe("sales reports", () => {
  it("counts only paid-or-later orders as sold", () => {
    const r = soldOrders([mk(1, "new"), mk(1, "awaiting_payment"), mk(1, "paid"), mk(1, "completed")], "week", "all", now);
    expect(r.length).toBe(2);
  });
  it("week period excludes orders older than 7 days", () => {
    expect(soldOrders([mk(3, "paid"), mk(10, "paid")], "week", "all", now).length).toBe(1);
  });
  it("filters by specialist", () => {
    expect(soldOrders([mk(1, "paid", "a"), mk(1, "paid", "b")], "month", "a", now).length).toBe(1);
  });
});

describe("status permissions", () => {
  it("only accountant (or super admin) can mark an order as paid", () => {
    expect(canMoveTo(["accountant"], "paid")).toBe(true);
    expect(canMoveTo(["sales_manager"], "paid")).toBe(false);
    expect(canMoveTo(["super_admin"], "paid")).toBe(true);
  });
});
