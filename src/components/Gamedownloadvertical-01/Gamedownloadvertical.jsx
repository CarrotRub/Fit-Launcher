import { createSignal, onCleanup, onMount } from "solid-js";

import Chart from "chart.js/auto";
import { invoke } from "@tauri-apps/api";
import './Gamedownloadvertical.css';

function Gameverticaldownloadslide({ isActive }) {
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
            setPercentage((gameInfo()?.progress_bytes / gameInfo()?.total_bytes * 100).toFixed(2));
            setLoading(false);
            updateCharts(stats);
        } catch (error) {
            console.error('Error fetching torrent stats:', error);
        }
    };
// Function to handle pause/resume button click
    const handleButtonClick = async () => {
        
        const currentState = gameInfo().state;
        try {
            if (currentState === 'paused') {
                await invoke('resume_torrent_command');
                setIsPaused(false); // The state was paused, now it is resumed
            } else if (currentState === 'live') {
                await invoke('pause_torrent_command');
                setIsPaused(true); // The state was live, now it is paused
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
                    <svg width="16" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M8 5l10 7-10 7V5z" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  );
                case 'live':
                  return (
                    <svg width="16" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M8 5v14m8-14v14" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  );
                default:
                    return (
                        <svg width="16" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M8 5v14m8-14v14" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                      );
              }
        }

        return (
            <span class="icon" onClick={handleButtonClick}>{iconCorr}</span> 
        )
}

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
            const mbDownloadSpeed = (stats.download_speed || 0) ;
            const mbUploadSpeed = (stats.upload_speed || 0) ;
            const downloadedMB = (stats.progress_bytes || 0) / (1024 * 1024);
            const uploadedMB = (stats.uploaded_bytes || 0) / (1024 * 1024);

            downloadUploadChart.data.datasets[0].data.push(mbDownloadSpeed.toFixed(2));
            downloadUploadChart.data.datasets[1].data.push(mbUploadSpeed.toFixed(2));
            bytesChart.data.datasets[0].data.push(downloadedMB.toFixed(2));
            bytesChart.data.datasets[1].data.push(uploadedMB.toFixed(2));

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
    
    const handleStopTorrent = () => {
        invoke('stop_torrent_command');
        localStorage.removeItem('CDG');
        window.dispatchEvent(new Event('storage'));
        console.log("donea")
    }

    return (
        
        <div class="sidebar-space" style={{ display: isActive ? 'block' : 'none' }}>
            
            <div class="stats-panel">
                <h2>Game Download Progress</h2>
                <div class="progress-container">
                    <div class="progress-bar">

                        <div class="progress" style={{ width: `${percentage()}%` }}></div>
                        <span class="progress-text">DOWNLOADING {percentage()}%</span>
                        <div class="icons">
                        <span class="icon" onClick={handleStopTorrent}><svg width="16" height="24" viewBox="-0.5 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg"><g stroke-width="0"/><g stroke-linecap="round" stroke-linejoin="round"/><path d="m3 21.32 18-18m-18 0 18 18" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
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
