import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];
export type OrderStatus = Database["public"]["Enums"]["order_status"];

export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: "Супер-админ",
  accountant: "Бухгалтер",
  sales_manager: "Менеджер по продажам",
  hr: "Специалист по кадрам",
  warehouse: "Складской специалист",
};

export const STATUS_FLOW: OrderStatus[] = [
  "new",
  "in_progress",
  "awaiting_payment",
  "paid",
  "in_transit",
  "at_warehouse",
  "completed",
];

export const STATUS_LABELS: Record<OrderStatus, string> = {
  new: "Новый",
  in_progress: "В работе",
  awaiting_payment: "Ожидает оплаты",
  paid: "Оплачен",
  in_transit: "В пути",
  at_warehouse: "На складе",
  completed: "Завершён",
};

/** Statuses counted as a sale in reports (payment received). */
export const SOLD_STATUSES: OrderStatus[] = ["paid", "in_transit", "at_warehouse", "completed"];

/** Which roles may move an order INTO the given status (super_admin always may). */
export const STATUS_CHANGE_ROLES: Record<OrderStatus, AppRole[]> = {
  new: ["sales_manager"],
  in_progress: ["sales_manager"],
  awaiting_payment: ["sales_manager"],
  paid: ["accountant"],
  in_transit: ["warehouse", "sales_manager"],
  at_warehouse: ["warehouse"],
  completed: ["warehouse", "sales_manager"],
};

export function nextStatus(s: OrderStatus): OrderStatus | null {
  const i = STATUS_FLOW.indexOf(s);
  return i >= 0 && i < STATUS_FLOW.length - 1 ? STATUS_FLOW[i + 1] : null;
}

export function canMoveTo(roles: AppRole[], to: OrderStatus): boolean {
  return roles.includes("super_admin") || STATUS_CHANGE_ROLES[to].some((r) => roles.includes(r));
}

export const rub = (n: number) =>
  new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(n || 0);
export const meters = (n: number) => `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(n || 0)} м`;
