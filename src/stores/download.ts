import { createStore, reconcile } from "solid-js/store";
import { createEffect } from "solid-js";

import type { DirectLink, Status } from "../bindings";
import { TorrentApi } from "../api/bittorrent/api";
import { DownloadManagerApi } from "../api/download/api";

export type DownloadNormalized = {
  id: string;
  title: string;
  img: string;
  progress: number;
  totalSize: number;
  speed: number;
  status: "active" | "paused" | "complete" | "error";
  type: "torrent" | "ddl";
  files: DirectLink[];
};

const EMPTY: DownloadNormalized[] = [];

export const downloadStore = (() => {
  const [state, setState] = createStore({
    items: EMPTY,
    refreshing: false,
  });

  let torrentApi = new TorrentApi();
  async function refresh() {
    if (state.refreshing) return;
    setState("refreshing", true);

    const [activeT, waitingT, stoppedT] = await Promise.all([
      torrentApi.getTorrentListActive(),
      torrentApi.getTorrentListWaiting(),
      torrentApi.getTorrentListStopped(),
    ]);

    const torrentStatuses: Status[] = [
      ...(activeT.status === "ok" ? activeT.data : []),
      ...(waitingT.status === "ok" ? waitingT.data : []),
      ...(stoppedT.status === "ok" ? stoppedT.data : []),
    ];

    const ddlJobs = DownloadManagerApi.getAllJobs();

    const normalized: DownloadNormalized[] = [];

    for (const t of torrentStatuses) {
      normalized.push({
        id: t.gid,
        //TODO: fix
        title: "Unknown torrent",
        img: "",
        progress: t.completedLength / t.totalLength,
        totalSize: t.totalLength,
        speed: t.downloadSpeed,
        status: t.status === "paused" ? "paused" : "active",
        type: "torrent",
        files: [],
      });
    }

    for (const [jobId, job] of ddlJobs) {
      for (const gid of job.gids) {
        const s = await torrentApi.getStatus(gid);
        if (s.status !== "ok") continue;

        normalized.push({
          id: `${jobId}_${gid}`,
          title: job.downloadedGame.title,
          img: job.downloadedGame.img ?? "",
          progress: s.data.completedLength / s.data.totalLength,
          totalSize: s.data.totalLength,
          speed: s.data.downloadSpeed,
          status: s.data.status === "paused" ? "paused" : "active",
          type: "ddl",
          files: job.files.map((f) => f),
        });
      }
    }

    setState("items", reconcile(normalized));
    setState("refreshing", false);
  }

  function pause(id: string) {
    return torrentApi.pauseTorrent(id);
  }

  function resume(id: string) {
    return torrentApi.resumeTorrent(id);
  }

  function remove(id: string) {
    return torrentApi.removeTorrent(id);
  }

  createEffect(() => {
    const interval = setInterval(refresh, 2000);
    return () => clearInterval(interval);
  });

  return { state, refresh, pause, resume, remove };
})();
