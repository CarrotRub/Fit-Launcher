import { invoke } from "@tauri-apps/api/core";
import { commands, DirectLink, DownloadedGame, Result } from "../../bindings";
import { appDataDir } from "@tauri-apps/api/path";
import { exists, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";

export type JobId = string;
export interface DdlJobEntry {
  downloadedGame: DownloadedGame;
  gids: string[];
  files: DirectLink[];
}

export class DownloadManagerApi {
  private static ddlJobMap = new Map<JobId, DdlJobEntry>();
  private static savePath: string | null = null;

  static async getSavePath(): Promise<string> {
    if (!this.savePath) {
      this.savePath = (await appDataDir()) + "\\ddl_jobs.json";
    }
    return this.savePath;
  }

  static async saveJobMapToDisk() {
    const savePath = await this.getSavePath();
    const obj: Record<JobId, DdlJobEntry> = Object.fromEntries(this.ddlJobMap);
    await writeTextFile(savePath, JSON.stringify(obj, null, 2));
  }

  static async loadJobMapFromDisk() {
    const savePath = await this.getSavePath();
    if (await exists(savePath)) {
      const content = await readTextFile(savePath);
      const obj: Record<JobId, DdlJobEntry> = JSON.parse(content);
      this.ddlJobMap = new Map(Object.entries(obj));
    }
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

  static async startDownload(
    directLinks: DirectLink[],
    downloadedGame: DownloadedGame,
    path: string
  ): Promise<Result<JobId, string>> {
    const jobId = crypto.randomUUID();

    const results = await commands.aria2TaskSpawn(directLinks, path);

    if (results.status === "ok") {
      const gids = results.data
        .filter((result) => result.task)
        .map((result) => result.task!.gid);

      this.ddlJobMap.set(jobId, {
        downloadedGame,
        gids,
        files: directLinks,
      });

      await this.saveJobMapToDisk();

      return { status: "ok", data: jobId };
    } else {
      return { status: "error", error: results.error.toString() };
    }
  }

  static getJob(jobId: JobId): DdlJobEntry | undefined {
    return this.ddlJobMap.get(jobId);
  }

  static getAllJobs(): [JobId, DdlJobEntry][] {
    return Array.from(this.ddlJobMap.entries());
  }

  static async removeJob(jobId: JobId) {
    const job = this.ddlJobMap.get(jobId);
    if (!job) return;

    for (const gid of job.gids) {
      await commands.aria2Remove(gid);
    }

    this.ddlJobMap.delete(jobId);
    await this.saveJobMapToDisk();
  }

  static async pauseJob(jobId: string) {
    const job = this.ddlJobMap.get(jobId);
    if (!job) return;

    for (const gid of job.gids) {
      await commands.aria2Pause(gid);
    }
  }

  static async resumeJob(jobId: string) {
    const job = this.ddlJobMap.get(jobId);
    if (!job) return;

    for (const gid of job.gids) {
      await commands.aria2Resume(gid);
    }
  }

  // static async getStatus(jobId: string) {
  //   const job = this.ddlJobMap.get(jobId);
  //   if (!job) return;

  //   for (const)
  // }
}
