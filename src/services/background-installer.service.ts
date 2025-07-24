import { makePersisted } from "@solid-primitives/storage";
import { TorrentApi } from "../api/bittorrent/api";
import { DownloadManagerApi, JobId } from "../api/download/api";
import { InstallationApi } from "../api/installation/api";
import { LibraryApi } from "../api/library/api";
import {
  DdlItem,
  DownloadItem,
  TorrentItem,
} from "../pages/Downloads-01/Downloads-Page";
import { createSignal } from "solid-js";
import { commands, Status } from "../bindings";

// Enhanced persisted storage with better debugging
function makePersistedSetStorage(key: string) {
  const [arr, setArr] = makePersisted(createSignal<string[]>([]), {
    name: key,
    storage: localStorage, // Ensure we're using localStorage
  });

  const getSet = () => new Set(arr());

  const has = (item: string) => {
    const exists = arr().includes(item);
    console.debug(`[${key}] Check ${item}:`, exists);
    return exists;
  };

  const add = (item: string) => {
    if (!has(item)) {
      setArr([...arr(), item]);
    }
  };

  const remove = (item: string) => {
    if (has(item)) {
      setArr(arr().filter((i) => i !== item));
    }
  };

  return { getSet, add, remove, has };
}

const processedTorrentsStorage = makePersistedSetStorage("processedTorrents");
const processedDdlJobsStorage = makePersistedSetStorage("processedDdlJobs");
const installationsInProgressStorage = makePersistedSetStorage(
  "installationsInProgress"
);

class BackgroundInstaller {
  private torrentApi = new TorrentApi();
  private libraryApi = new LibraryApi();
  private installationApi = new InstallationApi();
  private intervalId: number | null = null;
  private isProcessing = false;

  start() {
    if (this.intervalId) return;

    this.intervalId = setInterval(
      () => this.checkDownloads(),
      5000 // Increased interval to 5 seconds
    ) as unknown as number;
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async checkDownloads() {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    try {
      const items = await this.getDownloadItems();

      for (const item of items) {
        try {
          if (item.type === "torrent") {
            await this.processTorrentItem(item);
          } else if (item.type === "ddl") {
            await this.processDdlItem(item);
          }
        } catch (error) {
          console.error(`Error processing ${item.type} item:`, error);
        }
      }
    } catch (error) {
      console.error("Error in download check:", error);
    } finally {
      this.isProcessing = false;
    }
  }

  private async getDownloadItems(): Promise<DownloadItem[]> {
    try {
      await Promise.all([
        this.torrentApi.loadGameListFromDisk(),
        DownloadManagerApi.loadJobMapFromDisk(),
      ]);

      const [activeRes, waitingRes, stoppedRes] = await Promise.all([
        this.torrentApi.getTorrentListActive(),
        this.torrentApi.getTorrentListWaiting(),
        this.torrentApi.getTorrentListStopped(),
      ]);

      const torrentStatusMap = new Map<string, Status>();
      if (activeRes.status === "ok")
        activeRes.data.forEach((s) => torrentStatusMap.set(s.gid, s));
      if (waitingRes.status === "ok")
        waitingRes.data.forEach((s) => torrentStatusMap.set(s.gid, s));
      if (stoppedRes.status === "ok")
        stoppedRes.data.forEach((s) => torrentStatusMap.set(s.gid, s));

      const ddlJobs = DownloadManagerApi.getAllJobs();
      const ddlStatusPromises = Array.from(ddlJobs).map(
        async ([jobId, job]) => {
          const statusPromises = job.gids.map((gid) =>
            commands.aria2GetStatus(gid)
          );
          const results = await Promise.all(statusPromises);
          return {
            jobId,
            statuses: results
              .filter((r) => r.status === "ok")
              .map((r) => r.data),
          };
        }
      );

      const ddlStatusResults = await Promise.all(ddlStatusPromises);
      const ddlStatuses = new Map<JobId, Status[]>();
      ddlStatusResults.forEach(({ jobId, statuses }) =>
        ddlStatuses.set(jobId, statuses)
      );

      const items: DownloadItem[] = [];

      for (const [gid, games] of this.torrentApi.gameList.entries()) {
        const status = torrentStatusMap.get(gid);
        for (const game of games) {
          items.push({
            type: "torrent",
            game,
            status,
            gid,
          });
        }
      }

      for (const [jobId, job] of ddlJobs) {
        items.push({
          type: "ddl",
          job,
          statuses: ddlStatuses.get(jobId) || [],
          jobId,
        });
      }

      return items;
    } catch (error) {
      console.error("Error fetching download items:", error);
      return [];
    }
  }

  private async processTorrentItem(item: TorrentItem) {
    if (!item.status || item.status.status !== "complete") {
      return;
    }

    const key = `torrent:${item.gid}`;

    if (installationsInProgressStorage.has(key)) {
      return;
    }

    if (processedTorrentsStorage.has(key)) {
      return;
    }

    installationsInProgressStorage.add(key);

    try {
      const fullPath = item.status.files?.[0]?.path;
      if (!fullPath) throw new Error("Missing file path for torrent");

      const folderPath = fullPath.split(/[\\/]/).slice(0, -1).join("/");

      await this.libraryApi.addDownloadedGame(item.game);

      this.torrentApi.gameList.delete(item.gid);
      await this.torrentApi.saveGameListToDisk();

      await this.installationApi.startInstallation(folderPath);

      processedTorrentsStorage.add(key);
    } catch (error) {
      console.error(`Failed to process torrent ${item.gid}:`, error);

      installationsInProgressStorage.remove(key);
      throw error;
    } finally {
      installationsInProgressStorage.remove(key);
    }
  }

  private async processDdlItem(item: DdlItem) {
    if (item.statuses.length === 0) {
      return;
    }

    const allComplete = item.statuses.every(
      (s) => s.status === "complete" && s.completedLength === s.totalLength
    );

    if (!allComplete) {
      return;
    }

    const key = `ddl:${item.jobId}`;

    if (installationsInProgressStorage.has(key)) {
      return;
    }

    if (processedDdlJobsStorage.has(key)) {
      return;
    }

    installationsInProgressStorage.add(key);

    try {
      await this.libraryApi.addDownloadedGame(item.job.downloadedGame);

      const targetPath = item.job.targetPath;

      await this.installationApi.startExtractionDdl(targetPath);

      DownloadManagerApi.removeJob(item.jobId);
      await DownloadManagerApi.saveJobMapToDisk();

      await this.installationApi.startInstallation(targetPath);

      processedDdlJobsStorage.add(key);
    } catch (error) {
      console.error(`Failed to process DDL job ${item.jobId}:`, error);
      installationsInProgressStorage.remove(key);
      throw error;
    } finally {
      installationsInProgressStorage.remove(key);
    }
  }
}

export const backgroundInstaller = new BackgroundInstaller();
