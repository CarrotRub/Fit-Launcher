import { createSignal, onCleanup, onMount, createEffect, from } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { invoke } from '@tauri-apps/api';
import { appConfigDir} from '@tauri-apps/api/path';
import { writeFile, createDir, readTextFile } from '@tauri-apps/api/fs';
import './Downloadingpartsidebar.css';
import Gameverticaldownloadslide from '../../Gamedownloadvertical-01/Gamedownloadvertical'


function Downloadingpartsidebar() {

    const [cdgObject, setCdgObject] = createSignal([])
    const [isActiveDownload, setIsActiveDownload] = createSignal(false)
    const [torrentInfo, setTorrentInfo] = createSignal(null)
    const [isSidebarActive, setIsSidebarActive] = createSignal(JSON.parse(localStorage.getItem('isSidebarActive')) || false)
    const [currentImage, setCurrentImage] = createSignal(null)
    const [currentTitle, setCurrentTitle] = createSignal('')
    const [downloadingSpeed, setDownloadingSpeed] = createSignal('0 MB/s')
    const [remainingTime, setRemainingTime] = createSignal('0H 0M')
    const [oldPercentage, setOldPercentage] = createSignal(0)
    const [oldDownloadingSpeed, setOldDownloadingSpeed] = createSignal('0 MB/s')
    const [oldRemainingTime, setOldRemainingTime] = createSignal('0H 0M')
    const [isInitializing, setIsInitializing] = createSignal(false);
    const [isTorrentDone, setIsTorrentDone] = createSignal(false);

    onMount(() => {
        window.addEventListener('start-download', startDownloadListener)
        const cdg = localStorage.getItem('CDG') || '[]'
        window.addEventListener('storage', stopTorrent)
        setCdgObject(JSON.parse(cdg))

    })

    const stopTorrent = async () => {
        try {
            // Clear CDG and DownloadSidePart from localStorage
            localStorage.removeItem('CDG');
            localStorage.removeItem('CDG_Stats');
    
            // Update state to reflect no active download
            setCdgObject([]);

                window.location.reload();
    
        } catch (error) {
            console.error('Error stopping torrent:', error);
        }
    };
    
    let shouldStopFetching = false; // Flag to control the loop

    const fetchTorrentStats = async () => {
        if (shouldStopFetching) return; // Exit if the loop should stop
    
        try {
            console.log("fetching");
            const state = await invoke('get_torrent_stats');
            setTorrentInfo(state);
            localStorage.setItem('CDG_Stats', JSON.stringify(state));
            setIsActiveDownload(true);
        } catch (error) {
            console.error('Error fetching torrent state:', error);
            
            if (error.message === 'Fetching of torrent stats has been stopped.') {
                shouldStopFetching = true; // Stop the loop if the specific error is encountered
            }
        }
    };

    const startDownloadListener = () => {
        fetchTorrentStats()
        const intervalId = setInterval(fetchTorrentStats, 500)
        onCleanup(() => clearInterval(intervalId))
    }
    
    window.addEventListener('start-download', startDownloadListener)

    onCleanup(() => {
        window.removeEventListener('start-download', startDownloadListener)
    })

    createEffect(async () => {
        
        const actTorrentInfo = torrentInfo();

        window.addEventListener('start-download', startDownloadListener)
        const firstCdg = cdgObject()[0]
        if (firstCdg) {
            setCurrentImage(firstCdg.gameImage)
            setCurrentTitle(firstCdg.gameTitle)
            
            setIsInitializing(
                firstCdg.state === "initializing" || firstCdg.state === "Initializing"
            );
            
        }

        const statsFirstCDG = JSON.parse(localStorage.getItem('CDG_Stats'));
        if (statsFirstCDG) {
            setOldDownloadingSpeed(
                `${
                    statsFirstCDG.download_speed === null
                        ? 0
                        : statsFirstCDG.download_speed.toFixed(2)
                } MB/s`
            )

            setOldRemainingTime(
                `${
                    statsFirstCDG.time_remaining === null || statsFirstCDG.time_remaining === ''
                        ? (statsFirstCDG.finished !== true ? 'Infinity' : 'Done')
                        : statsFirstCDG.time_remaining
                }`
            );
            

        }

        const hihiChut = JSON.parse(localStorage.getItem('CDG_Stats'));
        let isTorrentFinished = hihiChut.finished;
        
        if (isTorrentFinished) {
            console.log("finishedddddd");
            const current_game = JSON.parse(localStorage.getItem('CDG'))[0];
            console.log(isTorrentFinished);
        
            const gameData = {
                title: current_game.gameTitle,
                img: current_game.gameImage,
                desc: current_game.desc,
                magnetlink: current_game.gameMagnet,
                timestamp: Date.now(),
                game_path: "",
            };
        
            try {
                const appDir = await appConfigDir();
                const dirPath = `${appDir}data\\`;
                const filePath = `${dirPath}downloaded_games.json`;
        
                console.log('Creating directory:', dirPath);
                await createDir(dirPath, { recursive: true });
        
                let existingData = [];
        
                try {
                    const fileContent = await readTextFile(filePath);
                    existingData = JSON.parse(fileContent);
                } catch (readError) {
                    // If file doesn't exist, create it with an empty array
                    console.log('File does not exist, creating a new one.');
                    await writeFile(filePath, JSON.stringify([]));
                    existingData = [];
                }
        
                if (!Array.isArray(existingData)) {
                    existingData = [];
                }
        
                console.log(existingData);
        
                // Check if the game already exists
                const gameExists = existingData.some(game => game.title === gameData.title);
        
                console.log("checked and it is: ", gameExists);
                if (!gameExists) {
                    existingData.push(gameData);
                    console.log('Writing updated data to path:', filePath);
                    await writeFile(filePath, JSON.stringify(existingData, null, 2)); // Beautify JSON with 2 spaces indentation
                    console.log('Game data saved successfully:', gameData);
                } else {
                    console.log('Game already exists in the file, not adding again:', gameData);
                }
            } catch (error) {
                console.error('Error saving game data:', error);
            }
        }
        
        console.log(isActiveDownload(), torrentInfo())
        if (torrentInfo() && isActiveDownload()) {
            console.log("donwl")

            const progress =
                (actTorrentInfo.progress_bytes / actTorrentInfo.total_bytes) * 100
            const element = document.querySelector(
                '.currently-downloading-game'
            )
            if (element) {
                element.style.setProperty(
                    '--bg-length',
                    `${isNaN(progress) ? 0 : progress + 3}%`
                )
                element.style.setProperty('border-radius', '20px')
            }


            setIsTorrentDone(actTorrentInfo.finished);
            
            setIsInitializing(
                actTorrentInfo.state === "initializing" ? true : false
            )

 
                setDownloadingSpeed(
                    `${
                        actTorrentInfo.download_speed === null
                            ? 0
                            : actTorrentInfo.download_speed.toFixed(2)
                    } MB/s`
                )
                setRemainingTime(
                    `${
                        actTorrentInfo.time_remaining === null
                        ? (actTorrentInfo.finished !== true ? 'Infinity' : 'Done')
                        : actTorrentInfo.time_remaining
                    }`
                );



        }
    })





    const toggleSidebar = () => {
        const newSidebarState = !isSidebarActive()
        setIsSidebarActive(newSidebarState)
        localStorage.setItem('isSidebarActive', JSON.stringify(newSidebarState))
    }

    const cdgStatsGlobal = JSON.parse(localStorage.getItem('CDG_Stats') || '{}')
    const progressGlobal = cdgStatsGlobal.progress_bytes || 0
    const totalBytesGlobal = cdgStatsGlobal.total_bytes || 1
    const initialProgress = (progressGlobal / totalBytesGlobal) * 100
    setOldPercentage(initialProgress)

    function objectProducer(set) {
        if (!window) return () => {};
    
        let handler = () => {
            const raw = window.localStorage.getItem('CDG');
            if (!raw) return;
            const data = JSON.parse(raw);
            
            const cdgArray = data[0]

            // * Set the whole Object.
            set(cdgArray);
            setCurrentImage('')
        };
    
        window.addEventListener('start-download', handler)
    
    
        return () => {
            if (!handler) return;
    
            window.removeEventListener('start-download', handler)
            handler = undefined;
        };
    }


    const gameObjectProduced = from(objectProducer);
    
    return (
        <>
                <div 
                    style={`--bg-length: ${
                        isNaN(oldPercentage()) ? 0 : oldPercentage()
                        }%`}
                    className="currently-downloading-game"
                    onClick={toggleSidebar}>
                { gameObjectProduced() ? (
                <>
                <div className="current-image-container">

                    <img className="current-image" src={gameObjectProduced().gameImage} alt="Game Image"></img>
                    
                    {/* My heart told me to write weird-circle but my brain force me to write action-circle :( */}
                    <div className="action-circle">
                        <div className="action-circle-logo">
                            { isInitializing() ? (

                                <svg className="action-circle-loading" width="10" height="11" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <g stroke-width="0"/>
                                    <g stroke-linecap="round" stroke-linejoin="round"/>
                                    <path d="M20 12a8 8 0 0 1-11.76 7.061" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>
                                </svg>

                            ) : (

                                <svg width="10" height="11" viewBox="0 0 10 11" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <rect width="3.92857" height="11" rx="0.785714" fill="white"/>
                                    <rect x="5.92857" width="3.92857" height="11" rx="0.785714" fill="white"/>
                                </svg>

                            )}

                        </div>
                    </div>
                </div>
 
                    <div className="current-text-container">
                            <p className="currently-downloading-game-title">
                                {gameObjectProduced().gameTitle}
                            </p>
                        
                        <p className="currently-downloading-game-info">
                            <span id="downloading-speed">
                                {downloadingSpeed()}
                            </span>
                            <span id="remaining-time">
                                {remainingTime()}
                            </span>
                        </p>
                    </div>
                </>
            ) : currentImage() || cdgObject().length > 0 ? (
                <>
                    <div className="current-image-container">

                        <img className="current-image" src={currentImage()} alt="Game Image"></img>
                        
                        {/* My heart told me to write weird-circle but my brain force me to write action-circle :( */}
                        <div className="action-circle">
                            <div className="action-circle-logo">
                                <svg width="10" height="11" viewBox="0 0 10 11" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <rect width="3.92857" height="11" rx="0.785714" fill="white"/>
                                    <rect x="5.92857" width="3.92857" height="11" rx="0.785714" fill="white"/>
                                </svg>
                            </div>
                        </div>
                        
                    </div>
                    <div className="current-text-container">

                            <p className="currently-downloading-game-title">
                            {currentTitle()}
                            </p>

                        <p className="currently-downloading-game-info">
                            <span id="downloading-speed">
                                {oldDownloadingSpeed()}
                            </span>
                            <span id="remaining-time">
                                {oldRemainingTime()}
                            </span>
                        </p>
                    </div>
                </>
            ) : (
                <p>No active downloads</p>
            )
                }

            </div>
            {isSidebarActive() && (
                <Gameverticaldownloadslide isActive={isSidebarActive()} />
            )}
        </>
    )
}

export default Downloadingpartsidebar
