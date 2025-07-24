import { appDataDir } from "@tauri-apps/api/path";
import {
  Aria2Error,
  Error,
  commands,
  DownloadedGame,
  Game,
  GlobalStat,
  Result,
  Status,
  FileInfo,
  TorrentApiError,
} from "../../bindings";
import { exists, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { message } from "@tauri-apps/plugin-dialog";
import { TorrentItem } from "../../pages/Downloads-01/Downloads-Page";

export type Gid = string;

export class TorrentApi {
  gameList = new Map<Gid, DownloadedGame[]>();

  private async getSavePath(): Promise<string> {
    return (await appDataDir()) + "\\torrent_game_map.json";
  }

  async saveGameListToDisk() {
    const savePath = await this.getSavePath();
    const obj: Record<Gid, DownloadedGame[]> = Object.fromEntries(
      this.gameList
    );
    await writeTextFile(savePath, JSON.stringify(obj, null, 2));
  }

  async loadGameListFromDisk() {
    const savePath = await this.getSavePath();
    if (await exists(savePath)) {
      const content = await readTextFile(savePath);
      const obj: Record<Gid, DownloadedGame[]> = JSON.parse(content);
      this.gameList = new Map(Object.entries(obj));
      return this.gameList;
    } else {
      console.warn("No saved gameList found at", savePath);
    }
  }

  private uninstalledPath: string | undefined;
  uninstalledGames = new Map<Gid, DownloadedGame>();

  private async getUninstalledPath(): Promise<string> {
    if (!this.uninstalledPath) {
      this.uninstalledPath = (await appDataDir()) + "\\uninstalled_games.json";
    }
    return this.uninstalledPath;
  }

  async saveUninstalledToDisk() {
    const path = await this.getUninstalledPath();
    const obj = Object.fromEntries(this.uninstalledGames);
    await writeTextFile(path, JSON.stringify(obj, null, 2));
  }

  async loadUninstalledFromDisk() {
    const path = await this.getUninstalledPath();
    if (await exists(path)) {
      const content = await readTextFile(path);
      const obj: Record<Gid, DownloadedGame> = JSON.parse(content);
      this.uninstalledGames = new Map(Object.entries(obj));
    }
  }

  /**
   * Start a torrent download and remember it in `gameList`.
   *
   * @param magnet  magnet URI
   * @param downloadedGame  the game metadata you want to track
   * @param path    output directory for aria2
   *
   * @return `Ok<null>` on success, `Err<Aria2Error>` otherwise
   */
  async downloadTorrent(
    magnet: string,
    downloadedGame: DownloadedGame,
    listFiles: number[],
    path: string
  ): Promise<Result<string, Aria2Error>> {
    const bytes = await commands.magnetToFile(magnet);

    if (bytes.status === "ok") {
      const res = await commands.aria2StartTorrent(bytes.data, path, listFiles);
      if (res.status === "ok") {
        const gid = res.data as Gid;

        const list = this.gameList.get(gid) ?? [];
        this.gameList.set(gid, [...list, downloadedGame]);
        if (this.gameList.size === 0) {
          console.warn("Warning: Tried to save empty gameList");
        }
        await this.saveGameListToDisk();

        return { status: "ok", data: res.data };
      } else {
        console.warn("start torrent error");
        await message("Error starting the torrent :" + res.error, {
          title: "Torrent Error",
          kind: "error",
        });
        console.error("status ", res.status, "error: " + res.error);
      }

      return res;
    } else {
      console.error("bytes error :", bytes.error);
      return { status: "error", error: "NotConfigured" };
    }
  }

  async getTorrentFileList(
    magnet: string
  ): Promise<Result<FileInfo[], TorrentApiError>> {
    return await commands.listTorrentFiles(magnet);
  }

  async getTorrentListActive(): Promise<Result<Status[], Aria2Error>> {
    return await commands.aria2GetListActive();
  }

  async getActiveTorrents(): Promise<TorrentItem[]> {
    try {
      const res = await commands.aria2GetListActive();
      if (res.status !== "ok") return [];

      const gidStatusMap = new Map(res.data.map((s) => [s.gid, s]));
      const torrentItems: TorrentItem[] = [];

      for (const [gid, games] of this.gameList.entries()) {
        if (gidStatusMap.has(gid)) {
          for (const game of games) {
            torrentItems.push({
              type: "torrent",
              gid,
              game,
              status: gidStatusMap.get(gid),
            });
          }
        }
      }

      return torrentItems;
    } catch (err) {
      console.error("getActiveTorrents exception:", err);
      return [];
    }
  }

  async getTorrentListWaiting(): Promise<Result<Status[], Aria2Error>> {
    return await commands.aria2GetListWaiting();
  }

  async getTorrentListStopped(): Promise<Result<Status[], Aria2Error>> {
    return await commands.aria2GetListStopped();
  }

  async pauseTorrent(gid: string): Promise<Result<null, Aria2Error>> {
    return await commands.aria2Pause(gid);
  }

  async resumeTorrent(
    gid: string
  ): Promise<Result<{ newGid?: string }, Aria2Error>> {
    const res = await commands.aria2Resume(gid);

    if (res.status === "ok") {
      return { status: "ok", data: {} };
    }

    const gameEntry = this.gameList.get(gid)?.[0];
    const magnet = gameEntry?.magnetlink;

    if (!magnet) {
      return {
        status: "error",
        error: { RPCError: "Resume failed and no magnet found" },
      };
    }

    console.warn(`Resuming via magnet fallback: ${magnet}`);
    const fallback = await this.downloadTorrent(magnet, gameEntry, [], "");

    if (fallback.status === "ok") {
      const newGid = fallback.data;
      const games = this.gameList.get(gid);
      if (games) {
        this.gameList.delete(gid);
        this.gameList.set(newGid, games);
        await this.saveGameListToDisk();
      }
      return { status: "ok", data: { newGid } };
    }
    return fallback;
  }

  async removeTorrent(gid: string): Promise<Result<null, Aria2Error>> {
    const res = await commands.aria2Remove(gid);

    if (res.status === "ok") {
      this.gameList.delete(gid);
      await this.saveGameListToDisk();
    }

    return res;
  }

  async removeAllTorrents({
    force = true,
  }: { force?: boolean } = {}): Promise<void> {
    const gids = Array.from(this.gameList.keys());

    for (const gid of gids) {
      const res = await commands.aria2Remove(gid);

      if (res.status === "ok") {
        this.gameList.delete(gid);
      } else {
        console.warn(`Failed to remove torrent with gid ${gid}`, res);
        if (force) {
          console.warn(`Force removing ${gid} from local gameList.`);
          this.gameList.delete(gid);
        }
      }
    }

    await this.saveGameListToDisk();
  }

  async getStatus(gid: string): Promise<Result<Status, Aria2Error>> {
    return await commands.aria2GetStatus(gid);
  }

  async getTotalDownloadSpeed(): Promise<Result<GlobalStat, Aria2Error>> {
    //todo: use this later for total download speed
    return await commands.aria2GlobalStat();
  }
}
