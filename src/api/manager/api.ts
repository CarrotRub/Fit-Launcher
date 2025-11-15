import {
  DirectLink,
  DownloadedGame,
  FileInfo,
  Result,
  Status,
  TaskStatus,
  TorrentApiError,
} from "../../bindings";
import { join, appDataDir } from "@tauri-apps/api/path";
import { exists, writeTextFile, readTextFile } from "@tauri-apps/plugin-fs";
import { commands } from "../../bindings";
import { downloadStore } from "../../stores/download";
import { listen } from "@tauri-apps/api/event";
import { FitEmitter } from "../../services/emitter";

export type DownloadSource = "torrent" | "ddl";
export type DownloadState =
  | "active"
  | "paused"
  | "waiting"
  | "error"
  | "complete"
  | "installing";

export interface DownloadJob {
  id: string;
  source: DownloadSource;
  gids: string[];
  ddlFiles?: DirectLink[];
  magnetLink?: string;
  torrentFiles?: number[];
  torrentFileBytes?: number[];
  game: DownloadedGame;
  targetPath: string;
  state: DownloadState;

  status: Status | null;
}

//todo: fix download not working
export class GlobalDownloadManager {
  private static jobs = new Map<string, DownloadJob>();
  private static savePath: string | null = null;

  private static emitter = new FitEmitter();

  //!  CALL THIS ONCE ON APP START
  static setup() {
    listen<Record<string, any>>("aria2_status_update", (event) => {
      GlobalDownloadManager.updateStatus(event.payload);
    });
  }

  static async testEventEmit() {
    await commands.aria2TestEvent();
  }

  static mapStatusToJob(status: Status): Partial<DownloadJob> {
    return {
      id: status.gid,

      state: this.mapAriaState(status.status),

      status,
    };
  }

  static mapAriaState(s: TaskStatus): DownloadJob["state"] {
    switch (s) {
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
  }

  static onCompleted(cb: (job: DownloadJob) => void) {
    this.emitter.on("download::completed", cb);
  }

  private static isComplete(job: DownloadJob) {
    return job.state === "complete";
  }

  static updateStatus(statusMap: Record<string, Status> | Status[]) {
    const statusesArray: Status[] = Array.isArray(statusMap)
      ? statusMap
      : Object.values(statusMap as Record<string, Status>);

    const statusMapByGid: Record<string, Status> = {};
    statusesArray.forEach((s) => {
      if (s && s.gid) statusMapByGid[String(s.gid)] = s;
    });

    for (const s of statusesArray) {
      const gid = String(s.gid);
      const job = Array.from(this.jobs.values()).find(
        (job) => Array.isArray(job.gids) && job.gids.includes(gid)
      );
      if (!job) continue;

      const updated: DownloadJob = { ...job, status: { ...(s as any) } };
      this.jobs.set(job.id, updated);

      if (this.isComplete(updated)) {
        this.emitter.emit("download::completed", updated);
      }
    }

    downloadStore.updateStatus(statusMapByGid);
  }

  private static async ensureSavePath() {
    if (!this.savePath)
      this.savePath = await join(await appDataDir(), "downloads.json");
    return this.savePath;
  }

  static async save() {
    const path = await this.ensureSavePath();
    await writeTextFile(
      path,
      JSON.stringify(Object.fromEntries(this.jobs), null, 2)
    );
  }

  static async load() {
    const path = await this.ensureSavePath();
    if (await exists(path)) {
      const raw = await readTextFile(path);
      const obj: Record<string, DownloadJob> = JSON.parse(raw);
      this.jobs = new Map(Object.entries(obj));
    }

    downloadStore.setJobsFull(this.getAll());
  }

  static get(jobId: string) {
    return this.jobs.get(jobId);
  }

  static getAll(): DownloadJob[] {
    return Array.from(this.jobs.values());
  }

  static async addDirectLinks(
    id: string,
    files: DirectLink[],
    game: DownloadedGame,
    targetPath: string
  ) {
    const res = await commands.aria2TaskSpawn(files, targetPath);
    if (res.status !== "ok") {
      throw new Error(`DDL spawn failed: ${res.error}`);
    }

    const gids = res.data.flatMap((r) => r.task?.gid || []);

    const job: DownloadJob = {
      id,
      source: "ddl",
      ddlFiles: files,
      game,
      targetPath,
      gids,
      state: "active",
      status: null,
    };

    this.jobs.set(id, job);
    await this.save();

    downloadStore.addJob(job);
    return job;
  }

  static async getDatahosterLinks(
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

  static async extractFuckingfastDDL(
    links: string[]
  ): Promise<DirectLink[] | null> {
    try {
      return await commands.extractFuckingfastDdl(links);
    } catch (error) {
      console.error("Error extracting fuckingfast DDL:", error);
      return null;
    }
  }

  static async getTorrentFileList(
    magnet: string
  ): Promise<Result<FileInfo[], TorrentApiError>> {
    return await commands.listTorrentFiles(magnet);
  }

  static async addTorrent(
    id: string,
    magnetLink: string,
    game: DownloadedGame,
    targetPath: string,
    listFiles: number[]
  ) {
    const bytesRes = await commands.magnetToFile(magnetLink);
    if (bytesRes.status !== "ok") throw new Error(`magnet -> file failed`);

    const bytes = bytesRes.data;
    const res = await commands.aria2StartTorrent(bytes, targetPath, listFiles);
    if (res.status !== "ok") throw new Error(`Torrent spawn failed`);

    const job: DownloadJob = {
      id,
      source: "torrent",
      magnetLink,
      torrentFileBytes: bytes,
      game,
      torrentFiles: listFiles,
      targetPath,
      gids: [res.data],
      state: "active",
      status: null,
    };

    this.jobs.set(id, job);
    await this.save();
    downloadStore.addJob(job);
    return job;
  }

  static async remove(jobId: string) {
    const job = this.jobs.get(jobId);
    if (!job) return;

    for (const gid of job.gids) {
      await commands.aria2Remove(gid);
    }

    this.jobs.delete(jobId);
    await this.save();
    downloadStore.removeJobById(jobId);
  }

  static async pause(jobId: string) {
    const job = this.jobs.get(jobId);
    if (!job) return;
    for (const gid of job.gids) await commands.aria2Pause(gid);
    job.state = "paused";
    await this.save();
    downloadStore.setJobState(jobId, "paused");
  }

  static async resume(jobId: string) {
    const job = this.jobs.get(jobId);
    if (!job) return;
    if (job.source === "ddl") {
      const result = await commands.aria2TaskSpawn(
        job.ddlFiles!,
        job.targetPath
      );
      if (result.status === "ok") {
        job.gids = result.data.flatMap((r) => r.task?.gid || []);
        job.state = "active";
        await this.save();
        downloadStore.setJobGids(jobId, job.gids);
        downloadStore.setJobState(jobId, "active");
      } else {
        job.state = "error";
        await this.save();
        downloadStore.setJobState(jobId, "error");
      }
      return;
    }
    if (job.source === "torrent") {
      console.log(job.torrentFileBytes, job.targetPath, job.torrentFiles);
      console.log(jobId);
      let gid = job.status?.gid;
      let res_res = await commands.aria2Resume(gid!);
      if (res_res.status === "ok") {
        if (res_res.status === "ok") {
          job.state = "active";
        } else {
          job.state = "error";
        }
        await this.save();
        downloadStore.setJobGids(jobId, job.gids);
        downloadStore.setJobState(jobId, "active");
      } else {
        console.error("Error unpausing torrent: ", res_res.error);

        downloadStore.setJobState(jobId, "error");
      }
    }
    let gid = job.status?.gid;
    const res_res = await commands.aria2Resume(gid!);
    if (res_res.status === "ok") {
      job.state = "active";
      await this.save();
      downloadStore.setJobState(jobId, "active");
    } else {
      console.error("Error unpausing torrent: ", res_res.error);
    }
  }
}
