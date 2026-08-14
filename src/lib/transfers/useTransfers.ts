import { useSyncExternalStore } from "react";
import {
  getTransferSnapshot,
  subscribeTransfers,
  type TransferTask,
} from "@/lib/transfers/manager";

const EMPTY: TransferTask[] = [];

/** Liste réactive de toutes les tâches de transfert (en cours + terminées récentes). */
export function useTransferTasks(): TransferTask[] {
  return useSyncExternalStore(subscribeTransfers, getTransferSnapshot, () => EMPTY);
}

/** Suit une tâche précise (null si inconnue / purgée). */
export function useTransferTask(id: string | null): TransferTask | null {
  const tasks = useTransferTasks();
  if (!id) return null;
  return tasks.find((t) => t.id === id) ?? null;
}
