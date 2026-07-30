import type { ComponentAvailabilityStatus, OperationVisualStatus } from "@/lib/production/types";

export const STATUS_META: Record<
  OperationVisualStatus,
  { label: string; short: string; dot: string; bar: string; badge: string; ring: string }
> = {
  blocked: {
    label: "БЛОКИРУЕТ ВЫПУСК",
    short: "Блокирует",
    dot: "bg-status-block",
    bar: "bg-status-block",
    badge: "bg-status-block/15 text-status-block border-status-block/40",
    ring: "border-l-status-block",
  },
  next: {
    label: "СЛЕДУЮЩАЯ ПРОБЛЕМА",
    short: "Следующая проблема",
    dot: "bg-status-next",
    bar: "bg-status-next",
    badge: "bg-status-next/15 text-status-next border-status-next/40",
    ring: "border-l-status-next",
  },
  waiting: {
    label: "ЖДЁТ ПРЕДЫДУЩУЮ",
    short: "Ждёт предыдущую",
    dot: "bg-status-wait",
    bar: "bg-status-wait",
    badge: "bg-status-wait/15 text-status-wait border-status-wait/40",
    ring: "border-l-status-wait",
  },
  ready: {
    label: "ГОТОВА К ЗАПУСКУ",
    short: "Готова",
    dot: "bg-status-ready",
    bar: "bg-status-ready",
    badge: "bg-status-ready/15 text-foreground border-status-ready/40",
    ring: "border-l-status-ready",
  },
  running: {
    label: "ВЫПОЛНЯЕТСЯ",
    short: "Выполняется",
    dot: "bg-status-run",
    bar: "bg-status-run",
    badge: "bg-status-run/15 text-status-run border-status-run/40",
    ring: "border-l-status-run",
  },
  done: {
    label: "ЗАВЕРШЕНА",
    short: "Завершена",
    dot: "bg-status-done",
    bar: "bg-status-done",
    badge: "bg-status-done/15 text-status-done border-status-done/40",
    ring: "border-l-status-done",
  },
};

/** CD005: нет — красная рамка, частично — жёлтая, есть — зелёная. */
export const AVAILABILITY_CHIP: Record<ComponentAvailabilityStatus, string> = {
  none: "border-status-block bg-status-block/10 text-status-block",
  partial: "border-status-wait/70 bg-status-wait/10 text-status-wait",
  full: "border-status-done/40 bg-status-done/5 text-muted-foreground",
};

export const AVAILABILITY_DOT: Record<ComponentAvailabilityStatus, string> = {
  none: "bg-status-block",
  partial: "bg-status-wait",
  full: "bg-status-done",
};

export const AVAILABILITY_RANK: Record<ComponentAvailabilityStatus, number> = {
  none: 0,
  partial: 1,
  full: 2,
};

export function fmtQty(n: number) {
  return Number.isFinite(n) ? String(n) : "∞";
}
