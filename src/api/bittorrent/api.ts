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

export type Gid = string;

export class TorrentApi {
  gameList = new Map<Gid, DownloadedGame[]>();

  private async getSavePath(): Promise<string> {
    console.log((await appDataDir()) + "\\torrent_game_map.json");
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
    console.log("Trying to load gameList from:", savePath);

    if (await exists(savePath)) {
      const content = await readTextFile(savePath);
      const obj: Record<Gid, DownloadedGame[]> = JSON.parse(content);
      this.gameList = new Map(Object.entries(obj));
      console.log("Loaded gameList:", this.gameList);
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
    path: string
  ): Promise<Result<string, Aria2Error>> {
    const res = await commands.aria2StartDownload(magnet, path, "");

    if (res.status === "ok") {
      const gid = res.data as Gid;

      const list = this.gameList.get(gid) ?? [];
      this.gameList.set(gid, [...list, downloadedGame]);
      console.log(this.gameList);
      if (this.gameList.size === 0) {
        console.warn("Warning: Tried to save empty gameList");
      }
      await this.saveGameListToDisk();

      return { status: "ok", data: res.data };
    }

    return res;
  }

  async getTorrentFileList(
    magnet: string
  ): Promise<Result<FileInfo[], TorrentApiError>> {
    return await commands.listTorrentFiles(magnet);
  }

  async getTorrentListActive(): Promise<Result<Status[], Aria2Error>> {
    return await commands.aria2GetListActive();
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

    // Fallback: try re-adding the torrent using the magnet
    const gameEntry = this.gameList.get(gid)?.[0];
    const magnet = gameEntry?.magnetlink;

    if (!magnet) {
      return {
        status: "error",
        error: {
          RPCError:
            "Resume failed and no magnet/installDir found for re-adding",
        },
      };
    }

    console.warn(`Resuming via magnet fallback: ${magnet}`);

    const fallback = await this.downloadTorrent(magnet, gameEntry, "");
    if (fallback.status === "ok") {
      return {
        status: "ok",
        data: { newGid: fallback.data },
      };
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
