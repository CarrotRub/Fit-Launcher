import { createEffect, createSignal, For, onCleanup, onMount } from "solid-js";
import { appCacheDir, appDataDir, join } from "@tauri-apps/api/path";
import { mkdir, readTextFile, writeFile, writeTextFile } from "@tauri-apps/plugin-fs";
import './Downloads-Page.css';
import { invoke } from "@tauri-apps/api/core";
import { globalTorrentsInfo, setGlobalTorrentsInfo } from "../../components/functions/dataStoreGlobal";
import { makePersisted } from "@solid-primitives/storage";
import { Dynamic, render } from "solid-js/web";
import BasicChoicePopup from "../../Pop-Ups/Basic-Choice-PopUp/Basic-Choice-PopUp";
import { message } from "@tauri-apps/plugin-dialog";

const cacheDir = await appCacheDir();
const appDir = await appDataDir();



function DownloadPage() {
    const [downloadingTorrents, setDownloadingTorrents] = createSignal([]);
    const [torrentStats, setTorrentStats] = createSignal({});
    const [toDeleteTorrentIdxList, setToDeleteTorrentIdxList] = createSignal([]);

    function handleCheckboxChange(torrentIdx, isChecked) {
        setToDeleteTorrentIdxList((prevList) =>
            isChecked ? [...prevList, torrentIdx] : prevList.filter((idx) => idx !== torrentIdx)
        );

        console.warn(toDeleteTorrentIdxList(), torrentIdx)
    }

    function deleteSelectedGames() {
        const torrentIdxList = toDeleteTorrentIdxList();
        if (torrentIdxList.length === 0) {
            console.log("No torrents selected for deletion.");
            return;
        }

        const { torrents } = globalTorrentsInfo;

        torrents.forEach(async (torrent) => {
            const { torrentIdx } = torrent;
            if (torrentIdxList.includes(torrentIdx)) {
                await invoke('torrent_action_delete', { id: torrentIdx })
                    .then(() => {
                        console.log(`Deleted torrent with idx: ${torrentIdx}`);
                    })
                    .catch((error) => {
                        console.error(`Failed to delete torrent with idx: ${torrentIdx}`, error);
                    });
            }
        });

        setGlobalTorrentsInfo("torrents", torrents.filter(torrent => !torrentIdxList.includes(torrent.torrentIdx)));
        setDownloadingTorrents(torrents.filter(torrent => !torrentIdxList.includes(torrent.torrentIdx)))
        setToDeleteTorrentIdxList([]);
    }

    function extractMainTitle(title) {
        return title
            ?.replace(/(?: - |, | )?(Digital Deluxe|Ultimate Edition|Deluxe Edition)\s*[:\-]?.*|(?: - |, ).*/, '')
            ?.replace(/\s*[:\-]\s*$/, '')
            ?.replace(/\(.*?\)/g, '')
            ?.replace(/\s*[:\–]\s*$/, '')
            ?.replace(/[\–].*$/, '');
    }

    function handleDeleteTorrents() {
        const torrentIdxList = toDeleteTorrentIdxList();
        const pageContent = document.querySelector(".downloads-page");

        if (torrentIdxList.length === 0) {
            render(
                () => (
                    <BasicChoicePopup
                        infoTitle={"Nothing to download"}
                        infoMessage={"Nothing there"} // Pass the generated message
                        infoFooter={''}
                        action={null}
                    />
                ),
                pageContent
            );
            return;
        }

        const gameTitles = [];

        downloadingTorrents().forEach((torrent) => {
            const { torrentIdx } = torrent;
            if (torrentIdxList.includes(torrentIdx)) {
                gameTitles.push(torrent.torrentExternInfo?.title || `Unknown Title \n(idx: ${torrentIdx})`);
            }
        })

        // const torrent = torrents.find((t) => t.torrentIdx === torrentIdx);
        // if (torrent) {
        //     gameTitles.push(torrent.torrentExternInfo?.gameTitle || `Unknown Title \n(idx: ${torrentIdx})`);
        // }

        // Create the message string
        const infoMessage = `The following games will be deleted:<br />${gameTitles.join("<br />- ")}`;

        render(
            () => (
                <BasicChoicePopup
                    infoTitle={"Are you sure about that?"}
                    infoMessage={infoMessage} // Pass the generated message
                    infoFooter={''}
                    action={deleteSelectedGames}
                />
            ),
            pageContent
        );
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

    async function addGameToDownloadedGames(gameData) {
        let currentData = { games: [] };
        const userDownloadedGames = await join(appDir, 'library', 'downloadedGames', 'downloaded_games.json');
        // Ensure the directory exists

        try {
            let toDownloadDirPath = await join(appDir, 'library', 'downloadedGames');
            await mkdir(toDownloadDirPath, { recursive: true }); // Create the directory
        } catch (error) {
            console.error('Error creating directory:', error);
        }

        // Read the current data from the file if it exists, or initialize it
        try {
            const fileContent = await readTextFile(userDownloadedGames);
            currentData = JSON.parse(fileContent);
        } catch (error) {
            // Handle case where the file does not exist yet (initialize with an empty array)
            console.log('No existing file found, starting fresh...');
        }

        try {
            let fileContent = [];

            try {
                const existingData = await readTextFile(userDownloadedGames);
                fileContent = JSON.parse(existingData); // Parse JSON content
            } catch (error) {
                console.warn('File does not exist or is empty. Creating a new one.');
            }

            // Ensure the content is an array
            if (!Array.isArray(fileContent)) {
                throw new Error('File content is not an array, cannot append.');
            }

            // Clean and append the new game data
            let cleanGameData = JSON.stringify(gameData, null, 2);  // Make sure it's a stringified JSON object
            fileContent.push(JSON.parse(cleanGameData)); // Push parsed JSON object, not string

            // Write the updated array back to the file
            await writeTextFile(userDownloadedGames, JSON.stringify(fileContent, null, 2)); // Write as pretty JSON array

            console.log('New data appended successfully!');
        } catch (error) {
            console.error('Error appending to file:', error);
        }
    }

    onMount(async () => {
        const intervals = new Map(); // Map to keep track of intervals for each torrentIdx

        // Iterate over downloading torrents
        downloadingTorrents().forEach((torrent) => {
            const { torrentIdx } = torrent;
            const { torrents } = globalTorrentsInfo;
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

                                try {
                                    await addGameToDownloadedGames(torrent)
                                } catch (error) {
                                    console.error('Error adding games to downloaded games :', error);
                                }


                                // Clear the interval for the finished torrent
                                clearInterval(intervalId);
                                intervals.delete(torrentIdx);

                                console.log("This torrent is done:", torrentIdx);


                                // Remove the finished torrent
                                setGlobalTorrentsInfo("torrents", (prevTorrents) =>
                                    prevTorrents.filter((torrent) => torrent.torrentIdx !== torrentIdx)
                                );
                                setDownloadingTorrents((prevTorrents) =>
                                    prevTorrents.filter((torrent) => torrent.torrentIdx !== torrentIdx)
                                );

                                let install_settings = await invoke('get_installation_settings');

                                if (install_settings.auto_install) {
                                    await invoke('run_automate_setup_install', { id: torrentIdx });
                                    await invoke('torrent_action_forget', { id: torrentIdx });
                                }

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

    createEffect(() => {
        console.warn(downloadingTorrents())
    })
    return (
        <div className="downloads-page content-page">
            <div className="downloads-page-action-bar">
                <button className="downloads-page-delete-all" onClick={handleDeleteTorrents}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-color)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trash-2"><path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2m-6 5v6m4-6v6" /></svg>
                </button>
            </div>
            {downloadingTorrents().length > 0 && Object.keys(torrentStats()).length > 0 ? (
                <For each={downloadingTorrents()}>
                    {(torrent) => (
                        <Dynamic component={DownloadingGameItem} torrent={torrent} stats={torrentStats} onCheckboxChange={handleCheckboxChange} />
                    )}
                </For>
            ) : (
                <div className="no-downloads">Nothing is currently downloading...</div>
            )}
        </div>
    );
}

function DownloadingGameItem({ torrent, stats, onCheckboxChange }) {
    const torrentStats = () => stats()[torrent.torrentIdx] || {};
    const [gamePercentage, setGamePercentage] = makePersisted(createSignal('0.5%'));
    const [torrentState, setTorrentState] = createSignal('initializing')
    const [numberPercentage, setNumberPercentage] = createSignal(1)

    createEffect(async () => {
        let percentage100 = (torrentStats().progress_bytes / torrentStats().total_bytes) * 100;

        setNumberPercentage(percentage100.toFixed(0))
        setGamePercentage(percentage100 + '%')
        setTorrentState(torrentStats().state)

        if (torrentStats().error) {
            await message(torrentStats().error, { title: 'FitLauncher', kind: 'error' })
        }
    }, torrentStats())

    return (
        <div className="downloading-game-item" key={torrent.torrentIdx}>
            <div className="downloading-main-info-game">
                <img
                    className="downloading-game-image"
                    src={torrent.torrentExternInfo.img}
                    alt={torrent.torrentExternInfo.title}
                />
                <div className="downloading-game-title">
                    <p style={`max-width: 30ch;`}>{torrent.torrentExternInfo.title}</p>
                </div>
            </div>
            <div className="downloading-secondary-info-game">
                <div className="downloading-download-info">
                    <div className="downloading-download-info-upload-speed">
                        <p style={`
                            color: var(--non-selected-text-color);
                            font-size: 14px
                            `}
                        >
                            UPLOAD
                        </p>
                        <p style={`font-size: 16px`}>
                            <b>{torrentStats()?.live?.upload_speed?.human_readable}</b>
                        </p>
                    </div>
                    <div className="downloading-download-info-download-speed">
                        <p style={`
                            color: var(--non-selected-text-color);
                            font-size: 14px
                            `}
                        >
                            DOWNLOAD
                        </p>
                        <p style={`font-size: 16px; margin: 0; padding:0;`}>
                            <b>{torrentStats()?.live?.download_speed?.human_readable}</b>
                        </p>
                    </div>

                </div>
                <div className="downloading-download-bar-container">
                    <div className="downloading-download-bar-info-container">
                        <p>
                            {torrentStats()?.finished ? (
                                'Done'
                            ) : torrentStats()?.live?.time_remaining ? (
                                <>
                                    <b>{torrentStats().live.time_remaining.human_readable}</b>
                                    <span style={{ color: 'var(--non-selected-text-color)' }}> remaining</span>
                                </>
                            ) : (
                                'Nothing'
                            )
                            }
                        </p>
                        <p className="downloading-download-bar-download-percentage">
                            {numberPercentage()}% DOWNLOADED
                        </p>
                    </div>
                    <div className="downloading-download-bar">
                        <div className="downloading-download-bar-active" style={{
                            'width': gamePercentage()
                        }}>

                        </div>
                    </div>
                </div>
                <Dynamic component={ActionButtonDownload} gameState={torrentState} torrentStats={torrentStats} torrentIdx={torrent.torrentIdx} />
                <label className="custom-checkbox-download">
                    <input type="checkbox" onChange={(e) => onCheckboxChange(torrent.torrentIdx, e.target.checked)} />
                    <span className="checkbox-mark-download"></span>
                </label>

            </div>
        </div>
    );
}

function ActionButtonDownload({ gameState, torrentStats, torrentIdx }) {
    const [buttonColor, setButtonColor] = createSignal('var(--secondary-color)');
    const [globalState, setGlobalState] = createSignal(gameState())
    const [gameDone, setGameDone] = createSignal(false);

    async function handleTorrentAction() {
        try {
            if (globalState() === 'live' && !gameDone()) {
                await invoke('torrent_action_pause', { id: torrentIdx })
            } else if (globalState() === 'paused' && !gameDone()) {
                await invoke('torrent_action_start', { id: torrentIdx })
            } else if (globalState() === 'initializing' && !gameDone()) {
                console.log("nothing")
            } else if (gameDone()) {
                console.log('already done')
            } else {
                await message(torrentStats()?.error, { title: 'FitLauncher', kind: 'error' })
            }
        } catch (error) {
            console.error(`Failed to pause/resume torrent ${torrentIdx()}:`, error);
        }
    }

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

    createEffect(() => {
        const gameStats = torrentStats();
        setGameDone(gameStats.finished)
        if (gameStats.finished) {
            console.log("done")
            setButtonColor('var(--primary-color)')
        }
    })


    return (
        <button
            className="downloading-action-button"
            onClick={() => handleTorrentAction()}
            style={{
                'background-color': buttonColor()
            }}
        >
            {globalState() === 'paused' && !gameDone() ? (
                <>
                    <svg width="21" xmlns="http://www.w3.org/2000/svg" height="21" viewBox="1874.318 773.464 24.364 24.364" style="-webkit-print-color-adjust::exact" fill="none"><g class="fills"><rect rx="0" ry="0" x="1874.5" y="773.646" width="24" height="24" transform="rotate(90.875 1886.5 785.646)" class="frame-background" /></g><g class="frame-children"><g class="fills"><rect rx="0" ry="0" x="1874.5" y="773.646" width="24" height="24" transform="rotate(90.875 1886.5 785.646)" class="frame-background" /></g><g class="frame-children"><path d="m1894.606 778.769-8.152 9.877-7.846-10.121z" style="fill:#ece0f0;fill-opacity:1" class="fills" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="m1894.606 778.769-8.152 9.877-7.846-10.121z" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:1" class="stroke-shape" /></g><path d="m1893.392 792.752-13.998-.214" style="fill:none" class="fills" /><g stroke-linejoin="round" stroke-linecap="round" class="strokes"><path d="m1893.392 792.752-13.998-.214" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:1" class="stroke-shape" /></g></g></g></svg>
                    <p>RESUME</p>
                </>
            ) : globalState() === 'live' && !gameDone() ? (
                <>
                    <svg width="21" xmlns="http://www.w3.org/2000/svg" height="21" viewBox="1885 553.52 24 24" style="-webkit-print-color-adjust::exact" fill="none"><g class="fills"><rect rx="0" ry="0" x="1885" y="553.52" width="24" height="24" class="frame-background" /></g><g class="frame-children"><rect rx="0" ry="0" x="1891" y="557.52" width="4" height="16" style="fill:#ece0f0;fill-opacity:1" class="fills" /><g stroke-linejoin="round" stroke-linecap="round" class="strokes"><rect rx="0" ry="0" x="1891" y="557.52" width="4" height="16" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:1" class="stroke-shape" /></g><rect rx="0" ry="0" x="1899" y="557.52" width="4" height="16" style="fill:#ece0f0;fill-opacity:1" class="fills" /><g stroke-linejoin="round" stroke-linecap="round" class="strokes"><rect rx="0" ry="0" x="1899" y="557.52" width="4" height="16" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:1" class="stroke-shape" /></g></g></svg>
                    <p>PAUSE</p>
                </>
            ) : globalState() === 'initializing' && !gameDone() ? (
                'INITIALIZING...'
            ) : gameDone() ? (
                'DONE'
            ) : (
                'ERROR'
            )}
        </button>
    );
}


export default DownloadPage;
