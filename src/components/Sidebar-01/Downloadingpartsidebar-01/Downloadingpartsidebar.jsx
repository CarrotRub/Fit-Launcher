import { createSignal, onCleanup, onMount, createEffect, from } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { invoke } from '@tauri-apps/api';
import { appConfigDir} from '@tauri-apps/api/path';
import { writeFile, createDir, readTextFile } from '@tauri-apps/api/fs';
import './Downloadingpartsidebar.css';
import Gameverticaldownloadslide from '../../Gamedownloadvertical-01/Gamedownloadvertical'
import { globalTorrentInfo, setTorrentTrigger, torrentTrigger } from '../../functions/dataStoreGlobal';

function Downloadingpartsidebar() {

    const [cdgObject, setCdgObject] = createSignal([])
    const [isActiveDownload, setIsActiveDownload] = createSignal(false)
    const [torrentInfo, setTorrentInfo] = createSignal(null)
    const [isSidebarActive, setIsSidebarActive] = createSignal(JSON.parse(localStorage.getItem('isSidebarActive')) || false)
    const [currentImage, setCurrentImage] = createSignal(null)
    const [currentTitle, setCurrentTitle] = createSignal(null)
    const [downloadingSpeed, setDownloadingSpeed] = createSignal('0 MB/s')
    const [remainingTime, setRemainingTime] = createSignal('0H 0M')
    const [oldPercentage, setOldPercentage] = createSignal(0)
    const [oldDownloadingSpeed, setOldDownloadingSpeed] = createSignal(null)
    const [oldRemainingTime, setOldRemainingTime] = createSignal(null)
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
            setCdgObject(null);
            setOldDownloadingSpeed(null);
            setOldRemainingTime(null);
            setCurrentImage(null);
            setCurrentTitle(null);
            window.location.reload();
    
        } catch (error) {
            console.error('Error stopping torrent:', error);
        }
    };
    
    let shouldStopFetching = false; // Flag to control the loop
    let intervalId;

    const fetchTorrentStats = async () => {
        if (shouldStopFetching) return; // Exit if the loop should stop
    
        try {
            console.log("fetching");
    
            const CTG = localStorage.getItem('CTG');
            let hash = JSON.parse(CTG).torrent_idx;
            const state = await invoke('api_get_torrent_stats', { torrentIdx: hash });
            
            const SoloCDG = JSON.parse(localStorage.getItem('CDG'));
            setTorrentInfo(state);
            setCdgObject(SoloCDG)
            localStorage.setItem('CDG_Stats', JSON.stringify(state));
            setIsActiveDownload(true);
    
            if (state.finished) {
                setIsTorrentDone(true);
                clearInterval(intervalId); // Stop fetching when torrent is done
                console.log('Torrent completed, stopping interval.');
                console.log("Starting the Automated Process Setup Install");
                await invoke('api_automate_setup_install', globalTorrentInfo)
                console.log("Started the Automated Process Setup Install");
            }
        } catch (error) {
            console.error('Error fetching torrent state:', error);
            
            if (error.message === 'Fetching of torrent stats has been stopped.') {
                shouldStopFetching = true;
                clearInterval(intervalId); // Stop interval in case of error
            }
        }
    };
    
    const startDownloadListener = () => {
        fetchTorrentStats();
        intervalId = setInterval(fetchTorrentStats, 500);
        onCleanup(() => clearInterval(intervalId));
    };
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
        }

        const statsFirstCDG = JSON.parse(localStorage.getItem('CDG_Stats'));
        if (statsFirstCDG) {

            let isTorrentFinished = statsFirstCDG.finished;

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
            
            setOldDownloadingSpeed(
                `${
                    statsFirstCDG.live?.download_speed.human_readable === null
                        ? 0
                        : statsFirstCDG.live?.download_speed.human_readable || '0 MiB/s'
                }`
            )

            setOldRemainingTime(
                `${
                    statsFirstCDG.live?.time_remaining.human_readable === null || statsFirstCDG.live?.time_remaining.human_readable === ''
                        ? (statsFirstCDG?.finished !== true ? 'Infinity' : 'Done')
                        : statsFirstCDG.live?.time_remaining.human_readable || 'Infinity'
                }`
            );
            

        }

        const hihiChut = JSON.parse(localStorage.getItem('CDG_Stats'));
        

        console.log(isActiveDownload(), torrentInfo())
        if (torrentInfo() && isActiveDownload()) {
            console.log("donwl")

            if (actTorrentInfo.state === 'initializing') {
                setIsInitializing(true);
                setDownloadingSpeed('Initializing...');
                setRemainingTime('');
            } else {
                setIsInitializing(false)
            }

            const progress = (actTorrentInfo.progress_bytes / actTorrentInfo.total_bytes) * 100;

            setOldPercentage(progress);
            const element = document.querySelector(
                '.currently-downloading-game'
            )
            if (element) {
                element.style.setProperty(
                    '--bg-length',
                    `${isNaN(progress) ? 0 : progress + 10}%`
                )
                element.style.setProperty('border-radius', '20px')
            }


            setIsTorrentDone(actTorrentInfo.finished);
            
            console.log("actotrentnngo :", actTorrentInfo.state)

            const liveStats = actTorrentInfo.live || {};
            setDownloadingSpeed(liveStats?.download_speed?.human_readable || '0 MB/s');
            setRemainingTime(liveStats?.time_remaining?.human_readable || '0H 0M');
            setIsTorrentDone(actTorrentInfo?.finished);
            



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


    let gameObjectProduced = from(objectProducer);

    createEffect(() => {
        console.log(torrentTrigger());
        if(torrentTrigger()) {
            console.log("Setting data")
            setTorrentTrigger(false)
            gameObjectProduced = from(objectProducer);
            let CDG_Info = JSON.parse(localStorage.getItem('CDG'));
            setCdgObject(CDG_Info);
        }
    })

    createEffect(() => {
        console.log(`Is Initializing: ${isInitializing()}`);
    });

    return (
        <>
                <div 
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
            ) : currentImage() || cdgObject()?.length > 0 ? (
                <>
                    <div className="current-image-container">

                        <img className="current-image" src={currentImage()} alt="Game Image"></img>
                        
                        {/* My heart told me to write weird-circle but my brain force me to write action-circle :( */}
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