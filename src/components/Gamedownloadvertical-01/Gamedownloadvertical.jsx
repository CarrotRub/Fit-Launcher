import { createSignal, onCleanup, onMount } from "solid-js";
import { appCacheDir } from '@tauri-apps/api/path';
import Swal from 'sweetalert2';
import Chart from "chart.js/auto";
import { invoke } from "@tauri-apps/api";
import './Gamedownloadvertical.css';
import { restartTorrentInfo } from "../functions/dataStoreGlobal";


const cacheDir = await appCacheDir();
const cacheDirPath = cacheDir;

function Gameverticaldownloadslide({ isActive, setIsActive }) {
    const [gameInfo, setGameInfo] = createSignal(null);
    const [loading, setLoading] = createSignal(true);
    const [percentage, setPercentage] = createSignal(0);
    const [isPaused, setIsPaused] = createSignal(false);
    let downloadUploadChart;
    let bytesChart;



    const fetchStats = async () => {
        try {
            const stats = JSON.parse(localStorage.getItem('CDG_Stats'));
            
            setGameInfo(stats);
            const progressPercentage = (gameInfo()?.progress_bytes / gameInfo()?.total_bytes * 100).toFixed(2);
            setPercentage(isNaN(progressPercentage) ? 0 : progressPercentage);
            setLoading(false);
            updateCharts(stats);

        } catch (error) {
            console.error('Error fetching torrent stats:', error);
        }
    };

    const finishedGamePopup = () => {
        Swal.fire({
            title: "Game is Done",
            text: "This game is already done downloading, please check your folder and/or check if the game setup is installing, if yes, let it install.",
            icon: "info"
        });
    }

    const unexpectedGameResumeError = () => {
        Swal.fire({
            title: "Unexpected Error",
            text: "An unexpected error happened while resuming the game, please try to continue the download by searching the game and clicking on the Download button again, this will resume it, if not please contact us on Discord available in the Settings page.",
            icon: "error"
        });
    }

    const handleButtonClick = async () => {
        const currentState = gameInfo().state;
        const isFinishedState = gameInfo().finished;
        const CTG = localStorage.getItem('CTG');
        let hash = JSON.parse(CTG).torrent_idx
        try {
            if ( currentState === 'paused' && !isFinishedState ) {
                try {
                    await invoke('api_resume_torrent', {torrentIdx:hash });
                } catch (err) {
                    console.error('Error Resuming Torrent :', err)
                    if (err.AnyhowError === "TorrentManager is not initialized.") {
                        const lastInputPath = localStorage.getItem('LUP');
                        console.log("TorrentManager is not initialized. Initializing it...");
    
                        // Initialize Torrent.
                        try {
                            console.log("Initializing")
                            await invoke('api_initialize_torrent_manager', {downloadPath: lastInputPath, appCachePath: cacheDirPath});
                            console.log("Done Init")
                            try {
                                console.log("Resuming");


                                //! ERROR :  Read Below.
                                //TODO: Due to an issue in the librqbit v7.1.0-beta.1 that we are using,we cannot just restart a game by unpausing it, we have to "start" it, we can't do anything but wait for a fix in librqbit.
                                await invoke('api_download_with_args', {
                                    magnetLink: restartTorrentInfo.magnetLink,
                                    downloadFileList: restartTorrentInfo.fileList
                                })

                                window.dispatchEvent(new Event('start-download'));
                            } catch (error) {
                                console.error('Error Toggling Torrent State Again:', error);
                                unexpectedGameResumeError();
                            }
                        } catch (error) {
                            console.error('Error Initializing Torrent Session:', error);
                        }
                        
                    } else {
                        
                        console.error("An error occurred while resuming torrent:", err);
                    }
                }
                setIsPaused(false);
            } else if (isFinishedState) {
                finishedGamePopup();
            } else if (currentState === 'live') {
                await invoke('api_pause_torrent', {torrentIdx:hash });
                setIsPaused(true);
            }
        } catch (error) {
            console.error('Error toggling torrent state:', error);
        }
    };

    const PauseResumeSvg = () => {
        const iconCorr = () => {
            const state = gameInfo()?.state;

            switch (state) {
                case 'paused':
                    return (
                        <svg width="24" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M8 5l10 7-10 7V5z" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    );
                case 'live':
                    return (
                        <svg width="24" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M8 5v14m8-14v14" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    );
                default:
                    return (
                        <svg width="24" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M8 5v14m8-14v14" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    );
            }
        }

        return (
            <span class="icon" onClick={handleButtonClick}>{iconCorr}</span> 
        );
    };

    const PauseResumeButton = () => {
        const buttonText = () => {
            try {
                const state = gameInfo()?.state;
                if (state === null || state === undefined) {
                    return 'Inactive';
                }
                switch (state) {
                    case 'paused':
                        return 'Resume';
                    case 'live':
                        return 'Pause';
                    case 'initializing':
                        return 'Loading...';
                    default:
                        return 'Unknown State';
                }
            } catch (error) {
                console.error('Error determining button text:', error);
                return 'Error';
            }
        };

        return (
            <button onClick={handleButtonClick}>
                {buttonText()}
            </button>
        );
    };

    const updateCharts = (stats) => {
        if (downloadUploadChart && bytesChart) {
            const mbDownloadSpeed = (stats.live?.download_speed?.human_readable);
            const mbUploadSpeed = (stats.live?.upload_speed.human_readable);
            const downloadedMB = (stats.progress_bytes || 0) / (1024 * 1024);
            const uploadedMB = (stats.uploaded_bytes || 0) / (1024 * 1024);

            downloadUploadChart.data.datasets[0].data.push(parseFloat(mbDownloadSpeed).toFixed(2));
            downloadUploadChart.data.datasets[1].data.push(parseFloat(mbUploadSpeed).toFixed(2));
            bytesChart.data.datasets[0].data.push(downloadedMB);
            bytesChart.data.datasets[1].data.push(uploadedMB);

            const currentTime = new Date().toLocaleTimeString();
            downloadUploadChart.data.labels.push("");
            bytesChart.data.labels.push("");

            downloadUploadChart.update();
            bytesChart.update();
        }
    };

    onMount(() => {
        fetchStats();
        const intervalId = setInterval(fetchStats, 500);
        
        if (gameInfo()?.finished) {
            clearInterval(intervalId);
        }
        onCleanup(() => clearInterval(intervalId));

        // Initialize charts
        const ctx1 = document.getElementById('downloadUploadChart').getContext('2d');
        downloadUploadChart = new Chart(ctx1, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Download Speed (MB/s)',
                        data: [],
                        borderColor: 'rgba(75, 192, 192, 1)',
                        backgroundColor: 'rgba(75, 192, 192, 0.2)',
                        fill: false,
                        pointStyle: false
                    },
                    {
                        label: 'Upload Speed (MB/s)',
                        data: [],
                        borderColor: 'rgba(255, 99, 132, 1)',
                        backgroundColor: 'rgba(255, 99, 132, 0.2)',
                        fill: false,
                        pointStyle: false
                    }
                ]
            },
            options: {
                scales: {
                    x: {
                        title: {
                            display: false,
                            text: 'Time'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Speed (MB/s)'
                        }
                    }
                }
            }
        });

        const ctx2 = document.getElementById('bytesChart').getContext('2d');
        bytesChart = new Chart(ctx2, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Downloaded MB',
                        data: [],
                        borderColor: 'rgba(144, 238, 144, 1)',
                        backgroundColor: 'rgba(144, 238, 144, 0.2)',
                        fill: false,
                        pointStyle: false
                    },
                    {
                        label: 'Uploaded MB',
                        data: [],
                        borderColor: 'rgba(221, 160, 221, 1)',
                        backgroundColor: 'rgba(221, 160, 221, 0.2)',
                        fill: false,
                        pointStyle: false
                    }
                ]
            },
            options: {
                scales: {
                    x: {
                        title: {
                            display: false,
                            text: 'Time'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Megabytes (MB)'
                        }
                    }
                }
            }
        });
    });

    const handleStopTorrent = async () => {
        const CTG = localStorage.getItem('CTG');
        let hash = JSON.parse(CTG).torrent_idx
        await invoke('api_stop_torrent', {torrentIdx: hash});
        localStorage.removeItem('CDG');
        window.dispatchEvent(new Event('storage'));
    }

    const slideLeft = () => {
        localStorage.setItem('isSidebarActive', false);
        setIsActive = false;
        const verdiv = document.querySelector('.sidebar-space')
        verdiv.style = 'display: none'
    }

    // Ensure that the percentage is valid before rendering the component
    if (isNaN(percentage()) || percentage() === null) {
        return null;
    }

    return (
        <div class="sidebar-space" style={{ display: isActive ? 'block' : 'none' }}>
            <div class="arrow-container left" onClick={slideLeft}>
                <div class="arrow-down"></div>
            </div>
            <div class="stats-panel">
                <h2>Game Download Progress</h2>
                <div class="progress-container">
                    <div class="progress-bar">
                        <div class="progress" style={{ width: `${percentage()}%` }}></div>
                        <span class="progress-text">DOWNLOADING {percentage()}%</span>
                        <div class="icons">
                            <span class="icon" onClick={handleStopTorrent}>
                                <svg width="24" height="32" viewBox="-0.5 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <g stroke-width="0"/>
                                    <g stroke-linecap="round" stroke-linejoin="round"/>
                                    <path d="m3 21.32 18-18m-18 0 18 18" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                            </span>
                            <div class="icon-divider"></div>
                            <PauseResumeSvg/>
                        </div>
                    </div>
                </div>
                <canvas id="downloadUploadChart"></canvas>
                <canvas id="bytesChart"></canvas>
            </div>
        </div>
    );
}

export default Gameverticaldownloadslide;