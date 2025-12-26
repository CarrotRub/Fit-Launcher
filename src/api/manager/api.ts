import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import {
  Aria2Error,
  commands,
  DirectLink,
  FileInfo,
  Game,
  GlobalStat,
  Job,
  Result,
  TorrentApiError,
} from "../../bindings";

type JobCallback = (job: Job) => void;
type RemovedCallback = (id: string) => void;

export class GlobalDownloadManager {
  private jobs = new Map<string, Job>();

  private updatedCbs: Set<JobCallback> = new Set();
  private completedCbs: Set<JobCallback> = new Set();
  private removedCbs: Set<RemovedCallback> = new Set();

  private pendingUpdates = new Map<string, Job>();
  private flushScheduled = false;
  private readonly FLUSH_INTERVAL = 250;
  private flushTimer: number | null = null;

  // Keep only the last N completed jobs in memory
  private readonly MAX_COMPLETED_JOBS = 50;
  private completedJobIds = new Set<string>();

  private unlistenUpdated: UnlistenFn | null = null;
  private unlistenRemoved: UnlistenFn | null = null;
  private unlistenCompleted: UnlistenFn | null = null;

  private flushUpdates() {
    this.flushScheduled = false;
    this.flushTimer = null;

    for (const [id, job] of this.pendingUpdates) {
      this.jobs.set(id, job);

      this.updatedCbs.forEach((cb) => {
        try {
          cb(job);
        } catch (err) {
          console.error("Error in job updated callback:", err);
        }
      });
    }

    this.pendingUpdates.clear();

    this.cleanupCompletedJobs();
  }

  private cleanupCompletedJobs() {
    if (this.completedJobIds.size > this.MAX_COMPLETED_JOBS) {
      const toRemove = this.completedJobIds.size - this.MAX_COMPLETED_JOBS;
      const idsArray = Array.from(this.completedJobIds);

      for (let i = 0; i < toRemove; i++) {
        const oldId = idsArray[i];
        this.jobs.delete(oldId);
        this.completedJobIds.delete(oldId);
      }
    }
  }

  async setup() {
    if (!this.unlistenUpdated) {
      this.unlistenUpdated = await listen("download::job_updated", (e) => {
        const job = e.payload as Job | null;
        if (!job?.id) return;

        // Only keep the latest update per job
        this.pendingUpdates.set(job.id, job);

        if (!this.flushScheduled) {
          this.flushScheduled = true;
          this.flushTimer = window.setTimeout(
            () => this.flushUpdates(),
            this.FLUSH_INTERVAL
          );
        }
      });
    }

    if (!this.unlistenRemoved) {
      this.unlistenRemoved = await listen("download::job_removed", (e) => {
        const id = e.payload as string;

        this.jobs.delete(id);
        this.pendingUpdates.delete(id);
        this.completedJobIds.delete(id);

        this.removedCbs.forEach((cb) => {
          try {
            cb(id);
          } catch (err) {
            console.error("Error in job removed callback:", err);
          }
        });
      });
    }

    if (!this.unlistenCompleted) {
      this.unlistenCompleted = await listen("download::job_completed", (e) => {
        const job = (e.payload as any) ?? null;
        if (!job || !job.id) return;

        this.jobs.set(job.id, job);
        this.completedJobIds.add(job.id);

        this.completedCbs.forEach((cb) => {
          try {
            cb(job);
          } catch (err) {
            console.error("Error in job completed callback:", err);
          }
        });

        this.cleanupCompletedJobs();
      });
    }

    try {
      const resAll = await commands.dmAllJobs();
      let all: Job[] = [];
      if (resAll.status === "ok") {
        all = resAll.data;
      }
      if (Array.isArray(all)) {
        for (const j of all) {
          if (j && j.id) {
            this.jobs.set(j.id, j);
            if (j.state === "complete") {
              this.completedJobIds.add(j.id);
            }
          }
        }
        this.cleanupCompletedJobs();
      }
    } catch (err) {
      console.warn("dmAllJobs failed:", err);
    }
  }

  // getters
  getAll(): Job[] {
    return Array.from(this.jobs.values());
  }

  getAllActive(): Job[] {
    return Array.from(this.jobs.values()).filter(
      (j) =>
        j.state === "active" || j.state === "paused" || j.state === "waiting"
    );
  }

  getAllCompleted(): Job[] {
    return Array.from(this.jobs.values()).filter((j) => j.state === "complete");
  }

  get(id: string): Job | undefined {
    return this.jobs.get(id);
  }

  // Manual cleanup method
  // call this when user navigates away from downloads page
  // todo: call this cuz i dont have time rn
  cleanup() {
    if (this.flushTimer !== null) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    this.pendingUpdates.clear();
    this.flushScheduled = false;

    const activeJobs = new Map<string, Job>();
    for (const [id, job] of this.jobs) {
      if (job.state !== "complete") {
        activeJobs.set(id, job);
      }
    }

    const completedJobs = Array.from(this.jobs.values())
      .filter((j) => j.state === "complete")
      .slice(-10);

    this.jobs.clear();
    this.completedJobIds.clear();

    for (const [id, job] of activeJobs) {
      this.jobs.set(id, job);
    }

    for (const job of completedJobs) {
      this.jobs.set(job.id, job);
      this.completedJobIds.add(job.id);
    }
  }

  // commands
  async addDdl(
    files: DirectLink[],
    target: string,
    game: Game
  ): Promise<Result<string, string>> {
    try {
      return await commands.dmAddDdlJob(files, target, game);
    } catch (e) {
      return {
        error: e instanceof Error ? e.message : (e as any),
        status: "error",
      };
    }
  }

  async addTorrent(
    magnet: string,
    filesList: number[],
    target: string,
    game: Game
  ): Promise<Result<string, string>> {
    try {
      return await commands.dmAddTorrentJob(magnet, filesList, target, game);
    } catch (e) {
      return {
        error: e instanceof Error ? e.message : (e as any),
        status: "error",
      };
    }
  }

  async pause(jobId: string): Promise<Result<void, string>> {
    try {
      await commands.dmPause(jobId);
      return { data: undefined, status: "ok" };
    } catch (e) {
      return {
        error: e instanceof Error ? e.message : (e as any),
        status: "error",
      };
    }
  }

  async resume(jobId: string): Promise<Result<void, string>> {
    try {
      await commands.dmResume(jobId);
      return { data: undefined, status: "ok" };
    } catch (e) {
      return {
        error: e instanceof Error ? e.message : (e as any),
        status: "error",
      };
    }
  }

  async remove(jobId: string): Promise<Result<void, string>> {
    try {
      await commands.dmRemove(jobId);
      return { data: undefined, status: "ok" };
    } catch (e) {
      return {
        error: e instanceof Error ? e.message : (e as any),
        status: "error",
      };
    }
  }

  async globalStats(): Promise<Result<GlobalStat, Aria2Error>> {
    return await commands.aria2GlobalStat();
  }

  async saveNow(): Promise<Result<void, string>> {
    try {
      await commands.dmSaveNow();
      return { data: undefined, status: "ok" };
    } catch (e) {
      return {
        error: e instanceof Error ? e.message : (e as any),
        status: "error",
      };
    }
  }

  async loadFromDisk(): Promise<Result<void, string>> {
    try {
      await commands.dmLoadFromDisk();
      return { data: undefined, status: "ok" };
    } catch (e) {
      return {
        error: e instanceof Error ? e.message : (e as any),
        status: "error",
      };
    }
  }

  // misc

  async getTorrentFileList(
    magnet: string
  ): Promise<Result<FileInfo[], TorrentApiError>> {
    return await commands.listTorrentFiles(magnet);
  }

  async getDatahosterLinks(
    gameLink: string,
    datahosterName: string
  ): Promise<string[] | null> {
    try {
      return await commands.getDatahosterLinks(gameLink, datahosterName);
    } catch (error) {
      console.error("Error getting datahoster links:", error);
      return null;
    }
  }

  async extractFuckingfastDDL(links: string[]): Promise<DirectLink[] | null> {
    try {
      return await commands.extractFuckingfastDdl(links);
    } catch (error) {
      console.error("Error extracting fuckingfast DDL:", error);
      return null;
    }
  }

  // subscriptions
  onUpdated(cb: JobCallback) {
    this.updatedCbs.add(cb);
    return () => this.updatedCbs.delete(cb);
  }

  onRemoved(cb: RemovedCallback) {
    this.removedCbs.add(cb);
    return () => this.removedCbs.delete(cb);
  }

  onCompleted(cb: JobCallback) {
    this.completedCbs.add(cb);
    return () => this.completedCbs.delete(cb);
  }

  async teardown() {
    if (this.flushTimer !== null) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.unlistenUpdated) {
      this.unlistenUpdated();
      this.unlistenUpdated = null;
    }
    if (this.unlistenRemoved) {
      this.unlistenRemoved();
      this.unlistenRemoved = null;
    }
    if (this.unlistenCompleted) {
      this.unlistenCompleted();
      this.unlistenCompleted = null;
    }

    this.updatedCbs.clear();
    this.removedCbs.clear();
    this.completedCbs.clear();

    this.jobs.clear();
    this.pendingUpdates.clear();
    this.completedJobIds.clear();
    this.flushScheduled = false;
  }
}

export const DM = new GlobalDownloadManager();
