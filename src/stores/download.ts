import { createSignal } from "solid-js";
import { DownloadJob, GlobalDownloadManager } from "../api/manager/api";
import { createStore } from "solid-js/store";

const [jobs, setJobs] = createStore<DownloadJob[]>([]);

export const downloadStore = {
  jobs,
  setJobs,
  refresh: async () => {
    await GlobalDownloadManager.load();
    setJobs(GlobalDownloadManager.getAll());
  },
  updateStatus(statuses: Record<string, any>) {
    setJobs((j) =>
      j.map((job) => {
        const st = statuses[job.id];
        return st ? { ...job, ...st } : job;
      })
    );
  },
};
