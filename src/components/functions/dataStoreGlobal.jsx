import { createSignal } from "solid-js";
import { createStore } from "solid-js/store";

const [globalTorrentInfo, setGlobalTorrentInfo] = createStore({
    torrentIdx: '',
    torrentOutputFolder: '',
    checkboxesList: [],
    twoGbLimit: false
  });


/// Object containing informations about the current downloading game (CDG), necessary to restart game.
const [restartTorrentInfo, setRestartTorrentInfo] = createStore({
    magnetLink: '',
    fileList: []
})

const [torrentTrigger, setTorrentTrigger] = createSignal(false);

export { globalTorrentInfo, setGlobalTorrentInfo, torrentTrigger, setTorrentTrigger, restartTorrentInfo, setRestartTorrentInfo };
