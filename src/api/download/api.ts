import { invoke } from "@tauri-apps/api/core";
import {
  commands,
  DirectLink,
  DownloadedGame,
  Result,
  Status,
} from "../../bindings";
import { appDataDir, join } from "@tauri-apps/api/path";
import {
  create,
  exists,
  mkdir,
  readTextFile,
  writeTextFile,
} from "@tauri-apps/plugin-fs";
import { cleanForFolder, extractMainTitle } from "../../helpers/format";
import { DdlItem } from "../../pages/Downloads-01/Downloads-Page";

export type JobId = string;
export interface DdlJobEntry {
  downloadedGame: DownloadedGame;
  gids: string[];
  files: DirectLink[];
  targetPath: string;
}

export class DownloadManagerApi {
  private static ddlJobMap = new Map<JobId, DdlJobEntry>();
  private static savePath: string | null = null;

  static async getSavePath(): Promise<string> {
    if (!this.savePath) {
      this.savePath = await join(await appDataDir(), "ddl_jobs.json");
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
    } else {
      console.warn("No saved job map found at", savePath);
      this.ddlJobMap = new Map<JobId, DdlJobEntry>();
      await writeTextFile(savePath, JSON.stringify({}, null, 2));
    }

    return this.ddlJobMap;
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

    await commands.allowDir(path);

    try {
      const folderName = cleanForFolder(
        extractMainTitle(downloadedGame.title)
      ).concat(" [FitGirl Repack]");

      const targetPath = await join(path, folderName);

      const dirExists = await exists(targetPath);
      if (!dirExists) {
        await mkdir(targetPath, { recursive: true });
      }

      const results = await commands.aria2TaskSpawn(directLinks, targetPath);

      if (results.status === "ok") {
        const gids = results.data
          .filter((result) => result.task)
          .map((result) => result.task!.gid);

        this.ddlJobMap.set(jobId, {
          downloadedGame,
          gids,
          files: directLinks,
          targetPath,
        });

        await this.saveJobMapToDisk();

        return { status: "ok", data: jobId };
      } else {
        return { status: "error", error: results.error.toString() };
      }
    } catch (e) {
      return { status: "error", error: `Download initialization failed: ${e}` };
    }
  }

  static getJob(jobId: JobId): DdlJobEntry | undefined {
    return this.ddlJobMap.get(jobId);
  }

  static getAllJobs(): [JobId, DdlJobEntry][] {
    return Array.from(this.ddlJobMap.entries());
  }

  static async getActiveDdlJobs(): Promise<DdlItem[]> {
    try {
      const activeStatuses = await commands.aria2GetListActive();

      if (activeStatuses.status !== "ok") return [];

      const gidStatusMap = new Map(activeStatuses.data.map((s) => [s.gid, s]));

      const ddlItems: DdlItem[] = [];

      for (const [jobId, job] of this.ddlJobMap.entries()) {
        const matchingStatuses = job.gids
          .map((gid) => gidStatusMap.get(gid))
          .filter((s): s is Status => !!s);

        if (matchingStatuses.length > 0) {
          ddlItems.push({
            type: "ddl",
            job,
            statuses: matchingStatuses,
            jobId,
          });
        }
      }

      return ddlItems;
    } catch (error) {
      console.error("Failed to get active DDL jobs:", error);
      return [];
    }
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

  static async unpauseJob(jobId: string) {
    const job = this.ddlJobMap.get(jobId);
    if (!job) return;

    for (const gid of job.gids) {
      await commands.aria2Resume(gid);
    }
  }

  static async resumeJob(jobId: string) {
    const job = this.ddlJobMap.get(jobId);
    if (!job) return;

    const results = await commands.aria2TaskSpawn(job.files, job.targetPath);

    if (results.status === "ok") {
      const gids = results.data
        .filter((result) => result.task)
        .map((result) => result.task!.gid);

      this.ddlJobMap.set(jobId, {
        ...job,
        gids,
        files: job.files,
        targetPath: job.targetPath,
      });

      await this.saveJobMapToDisk();

      return { status: "ok", data: jobId };
    } else {
      return { status: "error", error: results.error.toString() };
    }
  }
  // static async getStatus(jobId: string) {
  //   const job = this.ddlJobMap.get(jobId);
  //   if (!job) return;

  //   for (const)
  // }
}
