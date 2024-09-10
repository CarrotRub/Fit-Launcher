import { createSignal } from "solid-js";
import { createStore } from "solid-js/store";

const [globalTorrentInfo, setGlobalTorrentInfo] = createStore({
    torrentIdx: '',
    torrentOutputFolder: '',
    checkboxesList: [],
    twoGbLimit: false
  });

const [torrentTrigger, setTorrentTrigger] = createSignal(false);

export { globalTorrentInfo, setGlobalTorrentInfo, torrentTrigger, setTorrentTrigger };
