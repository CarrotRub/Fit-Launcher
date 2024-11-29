import { createEffect, createSignal, For, onCleanup, onMount } from "solid-js";
import { appCacheDir, appDataDir } from "@tauri-apps/api/path";
import { readTextFile } from "@tauri-apps/api/fs";
import './Downloads-Page.css';
import { invoke } from "@tauri-apps/api";
import { globalTorrentsInfo, setGlobalTorrentsInfo } from "../../components/functions/dataStoreGlobal";
import { makePersisted } from "@solid-primitives/storage";
import { Dynamic, render } from "solid-js/web";
import BasicErrorPopup from "../../Pop-Ups/Basic-Error-PopUp/Basic-Error-PopUp";

const cacheDir = await appCacheDir();
const appDir = await appDataDir();

const sessionJSON = `${cacheDir}.persistence\\session.json`

function DownloadPage() {
    const [downloadingTorrents, setDownloadingTorrents] = createSignal([]);
    const [torrentStats, setTorrentStats] = createSignal({});

    async function handleTorrentAction(torrentIdx, action) {
        try {
            if (action === 'pause') {
                await invoke('api_pause_torrent', { torrentIdx });
            } else if (action === 'resume') {
                await invoke('api_resume_torrent', { torrentIdx });
            }
            // Update stats reactively after the action
            const updatedStats = await invoke('api_get_torrent_stats', { torrentIdx });
            setTorrentStats((prevStats) => ({ ...prevStats, [torrentIdx]: updatedStats }));
        } catch (error) {
            console.error(`Failed to ${action} torrent ${torrentIdx}:`, error);
        }
    }

    function extractMainTitle(title) {
        return title
            ?.replace(/(?: - |, | )?(Digital Deluxe|Ultimate Edition|Deluxe Edition)\s*[:\-]?.*|(?: - |, ).*/, '')
            ?.replace(/\s*[:\-]\s*$/, '')
            ?.replace(/\(.*?\)/g, '')
            ?.replace(/\s*[:\–]\s*$/, '')
            ?.replace(/[\–].*$/, '');
    }

    function deleteAllFull() {
        setGlobalTorrentsInfo("torrents", []);
        setTorrentStats({})
            // Iterate through all torrents and pause them
            const { torrents } = globalTorrentsInfo;
            torrents.forEach((torrent) => {
                const { idx } = torrent;
                invoke('api_delete_torrent', { torrentIdx: idx })
                    .then(() => {
                        console.log(`Paused torrent with idx: ${idx}`);
                    })
                    .catch((error) => {
                        console.error(`Failed to pause torrent with idx: ${idx}`, error);
                    });
            });
        

    }

    onMount(async () => {
        // try {
        //     // Read and parse the session.json file
        //     const sessionData = JSON.parse(await readTextFile(sessionJSON));
        //     const sessionInfoHashes = Object.values(sessionData.torrents).map(
        //         (torrent) => torrent.info_hash
        //     );
    
        //     // Filter globalTorrentsInfo to retain only torrents with matching info_hash
        //     const filteredTorrents = globalTorrentsInfo.torrents.filter((torrent) =>
        //         sessionInfoHashes.includes(torrent.torrentIdx)
        //     );
    
        //     // Update globalTorrentsInfo with the filtered torrents
        //     setGlobalTorrentsInfo((prev) => ({
        //         ...prev,
        //         torrents: filteredTorrents,
        //     }));
    
        //     // Update downloadingTorrents signal
        //     setDownloadingTorrents(filteredTorrents);
        // } catch (error) {
        //     console.error("Error during initialization:", error);
        // }


        setDownloadingTorrents(globalTorrentsInfo.torrents);
        // Fetch stats for each torrent
    });

    onMount(async () => {
        const intervals = new Map(); // Map to keep track of intervals for each torrentIdx
    
        // Iterate over downloading torrents
        downloadingTorrents().forEach((torrent) => {
            const { torrentIdx } = torrent;
    
            // Avoid creating multiple intervals for the same torrentIdx
            if (!intervals.has(torrentIdx)) {
                const intervalId = setInterval(async () => {
                    try {
                        // Fetch stats and update reactively
                        if (torrentIdx !== '') {
                            const stats = await invoke('torrent_stats', { id: torrentIdx });
    
                            // Update stats reactively
                            setTorrentStats((prevStats) => {
                                return {
                                    ...prevStats,
                                    [torrentIdx]: {
                                        ...prevStats[torrentIdx],
                                        ...stats,
                                    },
                                };
                            });
    
                            if (stats.finished) {
                                // Clear the interval for the finished torrent
                                clearInterval(intervalId);
                                intervals.delete(torrentIdx);

                                console.log("This torrent is done :", torrentIdx)
                                
                            }
                        }
                    } catch (error) {
                        console.error(`Error fetching stats for torrent ${torrentIdx}:`, error);
                    }
                }, 500); // Fetch stats every 500ms
    
                intervals.set(torrentIdx, intervalId);
            }
        });
    
        // Cleanup intervals when the effect is disposed
        onCleanup(() => {
            intervals.forEach((intervalId) => clearInterval(intervalId));
            intervals.clear();
        });
    });


    return (
        <div className="downloads-page content-page">
            <div className="downloads-page-action-bar">
                <button className="downloads-page-delete-all" onClick={deleteAllFull}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-color)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trash-2"><path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2m-6 5v6m4-6v6"/></svg>
                </button>
            </div>
            {downloadingTorrents().length > 0 && Object.keys(torrentStats()).length > 0 ? (
                <For each={downloadingTorrents()}>
                    {(torrent) => (
                        <Dynamic component={DownloadingGameItem} torrent={torrent} stats={torrentStats}/>
                    )}
                </For>
            ) : (
                <div className="no-downloads">Nothing is currently downloading...</div>
            )}
        </div>
    );
}

function DownloadingGameItem({ torrent, stats }) {
    const torrentStat = () => stats()[torrent.torrentIdx] || {};
    const [gamePercentage, setGamePercentage] = makePersisted(createSignal('0.5%'));
    const [torrentState, setTorrentState] = createSignal('initializing')

    function callError(errorMessage) {
        const pageContent = document.querySelector(".download-game")
        render(
            () =>   <BasicErrorPopup 
                        errorTitle={"AN ERROR PUTTING DOWNLOADING YOUR GAME HAPPENED"}
                        errorMessage={errorMessage} 
                        errorFooter={''}
                    />
            ,pageContent
        )
    }

    createEffect(() => {
        console.log(torrentStat())
        let percentage100 = (torrentStat().progress_bytes / torrentStat().total_bytes) * 100;

        setGamePercentage(percentage100 + '%')
        setTorrentState(torrentStat().state)

        if(torrentStat().error) {
            callError(torrentStat().error)
        }
    }, torrentStat())

    return (
        <div className="downloading-game-item" key={torrent.torrentIdx}>
            <div className="downloading-main-info-game">
                <img
                    className="downloading-game-image"
                    src={torrent.torrentExternInfo.img}
                    alt={torrent.torrentExternInfo.title}
                />
                <div className="downloading-game-title">
                    <p>{torrent.torrentExternInfo.title}</p>
                </div>
            </div>
            <div className="downloading-secondary-info-game">
                <div className="downloading-download-bar-container">
                    <div className="downloading-download-bar">
                        <div className="downloading-download-bar-active" style={{
                            'width' : gamePercentage()
                        }}>

                        </div>
                    </div>
                </div>
                <Dynamic component={ActionButtonDownload} gameState={torrentState}/>
            </div>
        </div>
    );
}

function ActionButtonDownload({ gameState }) {
    const [buttonColor, setButtonColor] = createSignal('var(--secondary-color)');
    const [globalState, setGlobalState] = createSignal(gameState())
    // React to changes in gameState
    createEffect(() => {
        const state = gameState();
        setGlobalState(state)
        switch (state) {
            case 'live':
                setButtonColor('var(--secondary-color)');
                break;
            case 'paused':
                setButtonColor('var(--resume-button-accent-color)');
                break;
            case 'initializing':
                setButtonColor('var(--non-selected-text-color)');
                break;
            default:
                setButtonColor('red');
        }
    });


    return (
        <button
            className="downloading-action-button"
            onClick={() => console.log("pause")}
            style={{
                'background-color': buttonColor()
            }}
        >
            {globalState() === 'paused' ? (
                <>
                    <svg width="21" xmlns="http://www.w3.org/2000/svg" height="21" viewBox="1874.318 773.464 24.364 24.364" style="-webkit-print-color-adjust::exact" fill="none"><g class="fills"><rect rx="0" ry="0" x="1874.5" y="773.646" width="24" height="24" transform="rotate(90.875 1886.5 785.646)" class="frame-background"/></g><g class="frame-children"><g class="fills"><rect rx="0" ry="0" x="1874.5" y="773.646" width="24" height="24" transform="rotate(90.875 1886.5 785.646)" class="frame-background"/></g><g class="frame-children"><path d="m1894.606 778.769-8.152 9.877-7.846-10.121z" style="fill:#ece0f0;fill-opacity:1" class="fills"/><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="m1894.606 778.769-8.152 9.877-7.846-10.121z" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:1" class="stroke-shape"/></g><path d="m1893.392 792.752-13.998-.214" style="fill:none" class="fills"/><g stroke-linejoin="round" stroke-linecap="round" class="strokes"><path d="m1893.392 792.752-13.998-.214" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:1" class="stroke-shape"/></g></g></g></svg>
                    <p>RESUME</p>
                </>
            ) : globalState() === 'live' ? (
                <>
                    <svg width="21" xmlns="http://www.w3.org/2000/svg" height="21" viewBox="1885 553.52 24 24" style="-webkit-print-color-adjust::exact" fill="none"><g class="fills"><rect rx="0" ry="0" x="1885" y="553.52" width="24" height="24" class="frame-background"/></g><g class="frame-children"><rect rx="0" ry="0" x="1891" y="557.52" width="4" height="16" style="fill:#ece0f0;fill-opacity:1" class="fills"/><g stroke-linejoin="round" stroke-linecap="round" class="strokes"><rect rx="0" ry="0" x="1891" y="557.52" width="4" height="16" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:1" class="stroke-shape"/></g><rect rx="0" ry="0" x="1899" y="557.52" width="4" height="16" style="fill:#ece0f0;fill-opacity:1" class="fills"/><g stroke-linejoin="round" stroke-linecap="round" class="strokes"><rect rx="0" ry="0" x="1899" y="557.52" width="4" height="16" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:1" class="stroke-shape"/></g></g></svg>
                    <p>PAUSE</p>
                </>
            ) : globalState() === 'initializing' ? (
                'INITIALIZING...'
            ) : (
                'ERROR'
            )}
        </button>
    );
}


export default DownloadPage;
