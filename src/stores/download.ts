// src/stores/download.ts
import { createStore } from "solid-js/store";
import type { DownloadJob, DownloadState } from "../api/manager/api";
import { Status } from "../bindings";

const [jobs, setJobs] = createStore<DownloadJob[]>([]);

function getIndexById(id: string) {
  return jobs.findIndex((j) => j.id === id);
}

export const downloadStore = {
  jobs,

  setJobsFull: (arr: DownloadJob[]) => setJobs(() => arr),

  addJob: (job: DownloadJob) => {
    setJobs(jobs.length, job);
  },

  removeJobById: (jobId: string) => {
    const idx = getIndexById(jobId);
    if (idx === -1) return;

    setJobs((prev) => prev.filter((j) => j.id !== jobId));
  },

  setJobState: (jobId: string, state: DownloadState) => {
    const idx = getIndexById(jobId);
    if (idx === -1) return;
    setJobs(idx, "state", state);
  },

  setJobGids: (jobId: string, gids: string[]) => {
    const idx = getIndexById(jobId);
    if (idx === -1) return;
    setJobs(idx, "gids", gids);
  },

  setJobStatus: (jobId: string, status: Status | null) => {
    const idx = getIndexById(jobId);
    if (idx === -1) return;
    // replace only the nested status object
    setJobs(idx, "status", status ? { ...(status as any) } : null);
  },

  updateStatus(statuses: Record<string, Status> | Status[]) {
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

      setJobs(idx, "status", { ...(st as any) });
      const mappedState = ((): DownloadState => {
        switch (st.status) {
          case "active":
            return "active";
          case "paused":
            return "paused";
          case "error":
            return "error";
          case "complete":
            return "complete";
          case "removed":
            return "error";
          default:
            return "waiting";
        }
      })();
      if (jobs[idx].state !== mappedState) setJobs(idx, "state", mappedState);
    }
  },

  getJobByGid(gid: string) {
    return jobs.find((job) => job.status?.gid === gid) || null;
  },
};
