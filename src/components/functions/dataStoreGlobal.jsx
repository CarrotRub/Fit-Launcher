import { makePersisted } from "@solid-primitives/storage";
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

// Use MakePersisted for duh making it persistant 
const [colorCache, setColorCache] = makePersisted(createStore([]));

const [torrentTrigger, setTorrentTrigger] = createSignal(false);


export { 
    globalTorrentInfo,
    setGlobalTorrentInfo,
    torrentTrigger, 
    setTorrentTrigger, 
    restartTorrentInfo, 
    setRestartTorrentInfo,
    colorCache, 
    setColorCache 
};
