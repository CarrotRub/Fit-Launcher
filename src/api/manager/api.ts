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

  private unlistenUpdated: UnlistenFn | null = null;
  private unlistenRemoved: UnlistenFn | null = null;
  private unlistenCompleted: UnlistenFn | null = null;

  async setup() {
    if (!this.unlistenUpdated) {
      this.unlistenUpdated = await listen("download::job_updated", (e) => {
        const job = (e.payload as any) ?? null;
        if (!job || !job.id) return;
        this.jobs.set(job.id, job);

        this.updatedCbs.forEach((cb) => cb(job));
      });
    }
    if (!this.unlistenRemoved) {
      this.unlistenRemoved = await listen("download::job_removed", (e) => {
        const id = e.payload as string;
        const job = this.jobs.get(id) ?? null;
        this.jobs.delete(id);

        this.removedCbs.forEach((cb) => cb(id));
      });
    }
    if (!this.unlistenCompleted) {
      this.unlistenCompleted = await listen("download::job_completed", (e) => {
        const job = (e.payload as any) ?? null;
        if (!job || !job.id) return;
        this.jobs.set(job.id, job);
        this.completedCbs.forEach((cb) => cb(job));
      });
    }

    try {
      let resAll = await commands.dmAllJobs();
      let all: Job[] = [];
      if (resAll.status === "ok") {
        all = resAll.data;
      }
      if (Array.isArray(all)) {
        for (const j of all) {
          if (j && j.id) this.jobs.set(j.id, j);
        }
      }
    } catch (err) {
      console.warn("dmAllJobs failed:", err);
    }
  }

  // getters
  getAll(): Job[] {
    return Array.from(this.jobs.values());
  }
  get(id: string): Job | undefined {
    return this.jobs.get(id);
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
        status: "error",
        error: e instanceof Error ? e.message : (e as any),
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
        status: "error",
        error: e instanceof Error ? e.message : (e as any),
      };
    }
  }

  async pause(jobId: string): Promise<Result<void, string>> {
    try {
      await commands.dmPause(jobId);
      return { status: "ok", data: undefined };
    } catch (e) {
      return {
        status: "error",
        error: e instanceof Error ? e.message : (e as any),
      };
    }
  }

  async resume(jobId: string): Promise<Result<void, string>> {
    try {
      await commands.dmResume(jobId);
      return { status: "ok", data: undefined };
    } catch (e) {
      return {
        status: "error",
        error: e instanceof Error ? e.message : (e as any),
      };
    }
  }

  async remove(jobId: string): Promise<Result<void, string>> {
    try {
      await commands.dmRemove(jobId);
      return { status: "ok", data: undefined };
    } catch (e) {
      return {
        status: "error",
        error: e instanceof Error ? e.message : (e as any),
      };
    }
  }

  async globalStats(): Promise<Result<GlobalStat, Aria2Error>> {
    return await commands.aria2GlobalStat();
  }

  async saveNow(): Promise<Result<void, string>> {
    try {
      await commands.dmSaveNow();
      return { status: "ok", data: undefined };
    } catch (e) {
      return {
        status: "error",
        error: e instanceof Error ? e.message : (e as any),
      };
    }
  }

  async loadFromDisk(): Promise<Result<void, string>> {
    try {
      await commands.dmLoadFromDisk();
      return { status: "ok", data: undefined };
    } catch (e) {
      return {
        status: "error",
        error: e instanceof Error ? e.message : (e as any),
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
  }
}

export const DM = new GlobalDownloadManager();
