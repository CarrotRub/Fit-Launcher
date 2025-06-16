// store.tsx
import { makePersisted } from "@solid-primitives/storage";
import { createSignal } from "solid-js";
import { createStore, SetStoreFunction } from "solid-js/store";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface InstallationConfig {
  two_gb_limit: boolean;
  directx_install: boolean;
  microsoftcpp_install: boolean;
}

interface TorrentEntry {
  torrentExternInfo: unknown;  
  torrentIdx: number;
  torrentOutputFolder: string;
  torrentDownloadFolder: string;
  torrentFileList: string[];
  checkboxesList: boolean[];
  twoGbLimit: boolean;
}

interface GlobalTorrentsStore {
  torrents: TorrentEntry[];
}

interface RestartTorrentInfo {
  magnetLink: string;
  fileList: string[];
}

interface DownloadGamePageInfo {
  gameTitle: string;
  gameHref: string;
  filePath: string;
}

/* ------------------------------------------------------------------ */
/*  Installation-level settings (persisted)                           */
/* ------------------------------------------------------------------ */

export const [installationConfigurations, setInstallationConfigurations] =
  makePersisted(
    createStore<InstallationConfig>({
      two_gb_limit: true,
      directx_install: false,
      microsoftcpp_install: false
    })
  );

/* ------------------------------------------------------------------ */
/*  Global torrents info (persisted)                                  */
/* ------------------------------------------------------------------ */

export const [globalTorrentsInfo, setGlobalTorrentsInfo] = makePersisted(
  createStore<GlobalTorrentsStore>({ torrents: [] })
);

export function addGlobalTorrentsInfo(entry: TorrentEntry) {
  setGlobalTorrentsInfo("torrents", (list) => [...list, entry]);
}

/* ------------------------------------------------------------------ */
/*  Restart-torrent payload (in-memory only)                          */
/* ------------------------------------------------------------------ */

export const [restartTorrentInfo, setRestartTorrentInfo] =
  createStore<RestartTorrentInfo>({
    magnetLink: "",
    fileList: []
  });

/* ------------------------------------------------------------------ */
/*  Misc persistent helpers                                           */
/* ------------------------------------------------------------------ */

export const [colorCache, setColorCache] = makePersisted(createStore<string[]>(
  []
));

export const [downloadGamePageInfo, setDownloadGamePageInfo] = makePersisted(
  createStore<DownloadGamePageInfo>({
    gameTitle: "",
    gameHref: "",
    filePath: ""
  })
);

/* ------------------------------------------------------------------ */
/*  One-shot trigger (not persisted)                                  */
/* ------------------------------------------------------------------ */

export const [torrentTrigger, setTorrentTrigger] = createSignal(false);
