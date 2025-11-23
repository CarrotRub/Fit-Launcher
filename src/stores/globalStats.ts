import { createRoot, createSignal } from "solid-js";
import { GlobalStat } from "../bindings";
import { DM } from "../api/manager/api";

export const createGlobalStatsStore = () => {
  const [stats, setStats] = createSignal<GlobalStat | null>(null);

  const syncStats = async (): Promise<void> => {
    try {
      const res = await DM.globalStats();
      if (res.status === "ok") {
        setStats(res.data);
      }
    } catch (err) {
      console.error("Failed to sync global stats, keeping old:", err);
    }
  };

  const unsubscribes: (() => void)[] = [];

  unsubscribes.push(
    DM.onUpdated(() => {
      syncStats();
    })
  );

  syncStats();

  return {
    stats,
    syncStats,
    cleanup: () => unsubscribes.forEach((u) => u()),
  };
};

export const GlobalStatsStore = createRoot(createGlobalStatsStore);
