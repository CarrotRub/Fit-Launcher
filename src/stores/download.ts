import { createSignal } from "solid-js";
import { DownloadJob, GlobalDownloadManager } from "../api/manager/api";
import { createStore } from "solid-js/store";
import { Status } from "../bindings";

const [jobs, setJobs] = createStore<DownloadJob[]>([]);

export const downloadStore = {
  jobs,
  setJobs,

  refresh: async () => {
    await GlobalDownloadManager.load();
    setJobs(GlobalDownloadManager.getAll());
  },

  updateStatus(statuses: Record<string, Status>) {
    const statusByGid: Record<string, Status> = {};
    if (Array.isArray(statuses)) {
      (statuses as Status[]).forEach((s) => (statusByGid[String(s.gid)] = s));
    } else {
      for (const k of Object.keys(statuses)) {
        const s = statuses[k] as Status;
        if (s && s.gid) statusByGid[String(s.gid)] = s;
        else statusByGid[String(k)] = s;
      }
    }

    const gids = Object.keys(statusByGid);
    if (gids.length === 0) return;

    const touchedIndex = new Set<number>();

    for (const gid of gids) {
      const st = statusByGid[gid];
      if (!st) continue;

      const idx = jobs.findIndex(
        (job) => Array.isArray(job.gids) && job.gids.includes(gid)
      );
      if (idx === -1 || touchedIndex.has(idx)) continue;
      touchedIndex.add(idx);
      const mapped = GlobalDownloadManager.mapStatusToJob(st);

      setJobs(idx, "status", { ...(st as any) });
      setJobs(idx, "state", (mapped.state as any) ?? jobs[idx].state);
    }
  },

  getJobByGid(gid: string) {
    return jobs.find((job) => job.status?.gid === gid) || null;
  },
};
