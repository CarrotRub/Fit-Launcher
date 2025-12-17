import { createRoot, onCleanup } from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import { DM } from "../api/manager/api";
import type { Job } from "../bindings";

export const createDownloadsStore = () => {
  const jobsMap = new Map<string, Job>();

  const [state, setState] = createStore<{ jobs: Job[] }>({ jobs: [] });

  const syncState = (updatedJobs: Job[]) => {
    let changed = false;
    for (const job of updatedJobs) {
      const existing = jobsMap.get(job.id);
      if (existing) {
        const reconciled = reconcile(job)(existing);
        if (reconciled !== existing) {
          jobsMap.set(job.id, reconciled);
          changed = true;
        }
      } else {
        jobsMap.set(job.id, job);
        changed = true;
      }
    }
    if (changed) {
      setState("jobs", Array.from(jobsMap.values()));
    }
  };

  const unsubscribes: (() => void)[] = [];

  unsubscribes.push(
    DM.onUpdated((job) => {
      syncState([job]);
    })
  );

  unsubscribes.push(
    DM.onCompleted((job) => {
      syncState([job]);
    })
  );

  unsubscribes.push(
    DM.onRemoved((id) => {
      if (jobsMap.delete(id)) {
        setState("jobs", Array.from(jobsMap.values()));
      }
    })
  );

  syncState(DM.getAll());

  onCleanup(() => {
    unsubscribes.forEach((fn) => fn());
    jobsMap.clear();
  });

  return {
    getJob: (id: string) => jobsMap.get(id),
    jobs: () => state.jobs,
  };
};

export const DownloadsStore = createRoot(createDownloadsStore);
