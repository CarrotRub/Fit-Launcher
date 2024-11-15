import { makePersisted } from "@solid-primitives/storage";
import { createSignal } from "solid-js";
import { createStore } from "solid-js/store";

const [installationConfigurations, setInstallationConfigurations] = makePersisted(createStore({
    two_gb_limit: true,
    directx_install: false,
    microsoftcpp_install: false
}))

const [globalTorrentInfo, setGlobalTorrentInfo] = makePersisted(createStore({
    torrents: [
        {
            torrentIdx: '',
            torrentOutputFolder: '',
            torrentFileList: [],
            checkboxesList: [],
            twoGbLimit: false
        }
    ]
}));

function addGlobalTorrentInfo(torrentIdx, torrentOutputFolder, checkboxesList, twoGbLimit) {
    setGlobalTorrentInfo("torrents", [
        ...globalTorrentInfo.torrents,
        {
            torrentIdx: torrentIdx,
            torrentOutputFolder: torrentOutputFolder,
            checkboxesList: checkboxesList,
            twoGbLimit: twoGbLimit
        }
    ]);
}


/// Object containing informations about the current downloading game (CDG), necessary to restart game.
const [restartTorrentInfo, setRestartTorrentInfo] = createStore({
    magnetLink: '',
    fileList: []
})

// Use MakePersisted for duh making it persistant 
const [colorCache, setColorCache] = makePersisted(createStore([]));
const [downloadGamePageInfo, setDownloadGamePageInfo] = makePersisted(createStore({
    gameTitle: '',
    gameHref: '',
    filePath: ''
}))

const [torrentTrigger, setTorrentTrigger] = createSignal(false);


export { 
    globalTorrentInfo,
    addGlobalTorrentInfo,
    torrentTrigger, 
    setTorrentTrigger, 
    restartTorrentInfo, 
    setRestartTorrentInfo,
    setDownloadGamePageInfo,
    downloadGamePageInfo,
    colorCache, 
    setColorCache,
    installationConfigurations,
    setInstallationConfigurations
};
