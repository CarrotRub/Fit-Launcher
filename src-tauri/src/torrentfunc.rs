use librqbit::Session;
use serde::Serialize;
use tokio::sync::{oneshot, Mutex};
use std::sync::{Arc, atomic::AtomicBool};
use lazy_static::lazy_static;
use librqbit::TorrentStatsState;

// Add a lazy_static to allow every function to write and use it through different threads at the same time.
// Struct could work but this is working for now.
lazy_static! {
    static ref SESSION: Mutex<Option<Arc<Session>>> = Mutex::new(None);
    static ref TORRENT_HANDLE: Mutex<Option<Arc<librqbit::ManagedTorrent>>> = Mutex::new(None);
}



// Define a shared boolean static flags.
static STOP_FLAG_TORRENT: AtomicBool = AtomicBool::new(false);
static PAUSE_FLAG: AtomicBool = AtomicBool::new(false);
static STOP_GET_STATS: AtomicBool = AtomicBool::new(false);



// Creation of a struct containing every useful infomartion that will be used later on in the FrontEnd.
#[derive(Debug, Clone, Serialize)]
pub struct TorrentStatsInformations{
    state: TorrentStatsState,
    file_progress: Vec<u64>,
    error: Option<String>,
    progress_bytes: u64,
    uploaded_bytes: u64,
    total_bytes: u64,
    finished: bool,
    download_speed: Option<f64>,
    upload_speed: Option<f64>,
    average_piece_download_time: Option<f64>,
    // * Not the best way to implement the time remaining, but for now this will do the job.
    time_remaining: Option<std::string::String>,
}
impl Default for TorrentStatsInformations {
    fn default() -> Self {
        Self {
            state: TorrentStatsState::Paused, // Starting as Paused if null just because it is the base state.
            file_progress: vec![], // The progress for every file that is downloading.
            error: None,
            progress_bytes: 0,
            uploaded_bytes: 0,
            total_bytes: 0,
            finished: false,
            download_speed: None,
            upload_speed: None,
            average_piece_download_time: None,
            time_remaining: None,
        }
    }
}


#[derive(Default)]
pub struct TorrentState {
    pub stats: Arc<Mutex<TorrentStatsInformations>>,
    pub file_selection_tx: Arc<Mutex<Option<oneshot::Sender<Vec<usize>>>>>,
}

impl TorrentState {
    pub fn new() -> Self {
        TorrentState {
            stats: Arc::new(Mutex::new(TorrentStatsInformations::default())),
            file_selection_tx: Arc::new(Mutex::new(None)), // Default to None
        }
    }
}

pub mod torrent_functions {
    use std::error::Error;
    use std::fmt;
    use std::thread;
    use std::time;
    use std::time::Duration;
    use serde::{Deserialize, Serialize};
    use tokio::sync::oneshot;
    use tokio::sync::Mutex;
    use anyhow::{Result, Context};
    use std::sync::{Arc, atomic::Ordering};
    use librqbit::{AddTorrent, AddTorrentOptions, AddTorrentResponse, Session, SessionOptions};
    use tracing::info;
    use crate::custom_ui_automation::windows_ui_automation;
    use crate::torrentfunc::TORRENT_HANDLE;

    use super::{ SESSION,STOP_FLAG_TORRENT, PAUSE_FLAG, STOP_GET_STATS};

    #[derive(Debug, Serialize, Deserialize)]
    struct CustomError {
        message: String,
    }

    impl fmt::Display for CustomError {
        fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
            write!(f, "{}", self.message)
        }
    }

    impl Error for CustomError {}

    impl From<Box<dyn Error>> for CustomError {
        fn from(error: Box<dyn Error>) -> Self {
            CustomError {
                message: error.to_string(),
            }
        }
    }

    #[derive(Debug, Serialize)]
    pub struct TorrentError {
        pub message: String,
    }

    impl fmt::Display for TorrentError {
        fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
            write!(f, "{}", self.message)
        }
    }

    impl Error for TorrentError {}

    impl From<anyhow::Error> for TorrentError {
        fn from(error: anyhow::Error) -> Self {
            TorrentError {
                message: error.to_string(),
            }
        }
    }

    // Starts the torrent thread to manage download
    pub async fn start_torrent_thread(
        magnet_link: String,
        torrent_stats: Arc<Mutex<super::TorrentStatsInformations>>,
        download_path: String,
        checkboxes_list: Vec<String>,
        file_list_tx: oneshot::Sender<Vec<String>>,
        file_selection_rx: oneshot::Receiver<Vec<usize>>,
        should_limit: bool,
    ) -> Result<(), anyhow::Error> {
        let output_dir = download_path.clone();
        let mut session = SESSION.lock().await;
        
        // Initialize session if it doesn't exist
        if session.is_none() {
            let mut custom_session_options = SessionOptions::default();

            // Quickest config based upon librqbit creator (I think) : 
            // `--disable-dht --disable-trackers`
            custom_session_options.disable_dht = false;
            custom_session_options.disable_dht_persistence = false;
            custom_session_options.persistence = false;
            custom_session_options.enable_upnp_port_forwarding = true;
    
            let new_session = Session::new_with_opts(
                output_dir.clone().into(),
                custom_session_options,
            )
            .await
            .context("Error creating torrent session")?;
    
            *session = Some(new_session);
        }
    
        let session = session.clone().unwrap();
    
        // Add torrent with list_only to get file list
        let response = session
            .add_torrent(
                AddTorrent::from_url(&magnet_link),
                Some(AddTorrentOptions {
                    list_only: true,
                    ..Default::default()
                }),
            )
            .await
            .context("Error adding torrent to session")?;

        let mut output_folder_path: String = String::new();

        let handle = match response {
            AddTorrentResponse::ListOnly(handle) => {
                let info = handle
                    .info
                    .iter_filenames_and_lengths()
                    .context("Error iterating over filenames and lengths")?;
    
                let mut file_list_names = Vec::new();
                for (filename, _len) in info {
                    file_list_names.push(filename.to_string().context("Error converting filename to string")?);
                }

                file_list_tx.send(file_list_names)
                    .map_err(|_| anyhow::anyhow!("Failed to send file list to the frontend"))?;
    
                // Receive selected files from frontend
                let selected_files = file_selection_rx.await
                    .map_err(|_| anyhow::anyhow!("Failed to receive selected files from the frontend"))?;
    
                let response = session
                    .add_torrent(
                        AddTorrent::from_url(&magnet_link),
                        Some(AddTorrentOptions {
                            list_only: false,
                            only_files: Some(selected_files),
                            overwrite: true,
                            disable_trackers: true,
                            ..Default::default()
                        }),
                    )
                    .await
                    .context("Error adding selected files torrent for download")?;
                let old_output_folder_path = handle.output_folder;
                output_folder_path = old_output_folder_path.join("setup.exe").to_str().unwrap().into();
                match response {
                    AddTorrentResponse::Added(_, handle) => handle,
                    _ => return Err(anyhow::anyhow!("Unexpected response when re-adding torrent for download")),
                }
            },
            _ => return Err(anyhow::anyhow!("Unexpected response when adding torrent")),
        };
    
        let handle_clone: Arc<librqbit::ManagedTorrent> = handle.clone();
        let game_folder_name = handle.info.info.name.clone();
        drop(handle); // Drop the original handle, only keep the clone
        let torrent_stats = Arc::clone(&torrent_stats);
        let session_clone = session.clone();  // Clone session for usage in the async task
        drop(session);
        
        tokio::spawn(async move {
            loop {
                tokio::time::sleep(Duration::from_secs(1)).await;
                
                let stats = handle_clone.stats();
                let mut torrent_stats = torrent_stats.lock().await;
                
                torrent_stats.state = stats.state.clone();
                torrent_stats.file_progress = stats.file_progress.clone();
                torrent_stats.error = stats.error.clone();
                torrent_stats.progress_bytes = stats.progress_bytes;
                torrent_stats.uploaded_bytes = stats.uploaded_bytes;
                torrent_stats.total_bytes = stats.total_bytes;
                torrent_stats.finished = stats.finished;

                let mut my_crec_handle = TORRENT_HANDLE.lock().await;
                *my_crec_handle = Some(handle_clone.clone());
                
                if let Some(live_stats) = stats.live {
                    torrent_stats.download_speed = Some(live_stats.download_speed.mbps as f64);
                    torrent_stats.upload_speed = Some(live_stats.upload_speed.mbps as f64);
                    torrent_stats.average_piece_download_time = live_stats.average_piece_download_time.map(|d| d.as_secs_f64());
                    torrent_stats.time_remaining = live_stats.time_remaining.map(|d| d.to_string());
                    
                    if torrent_stats.finished {
                        
                        // Get game path by combining the game name and its path and then removing [FitGirl Repack].
                        let mut necessary_game_path = format!("{}\\{}", &download_path, game_folder_name.unwrap());
                        necessary_game_path = necessary_game_path.replace(" [FitGirl Repack]", "");

                        session_clone.stop().await;
                        // Droping the session just in case it's hogging the path.
                        drop(session_clone);

                        // Stop the get stats.
                        STOP_GET_STATS.store(true, Ordering::Relaxed);




                        // Droping the handle just in case it's hogging the path.
                        drop(handle_clone);


                        // Assign None to the SESSION lazy_static to allow the start_executable function to run the executable setup.exe because lazy_statics cannot be dropped.
                        let mut lock = SESSION.lock().await;
                        *lock = None; 

                        windows_ui_automation::start_executable(output_folder_path);

                        println!("waiting...");
                        // Wait 3 seconds for the setup to run.
                        thread::sleep(time::Duration::from_millis(3000));
                        println!("continue !");

                        // Run the automatic download, should add a loop to wait for the executable to start.
                        windows_ui_automation::automate_until_download(checkboxes_list, &necessary_game_path, should_limit);
                        break;
                    }
                    
                    if STOP_FLAG_TORRENT.load(Ordering::Relaxed) {
                        session_clone.stop().await;
                        break;
                    }
                    
                    if PAUSE_FLAG.load(Ordering::Relaxed) {
                        // Don't use break to stop the loop.
                        handle_clone.pause();
                    }
                } else {
                    torrent_stats.download_speed = None;
                    torrent_stats.upload_speed = None;
                    torrent_stats.average_piece_download_time = None;
                    torrent_stats.time_remaining = None;
                }
                
                info!("{:?}", *torrent_stats);
               
            }
        });
        
        Ok(())
    }
}


pub mod torrent_commands {

    use serde::{Deserialize, Serialize};
    use tokio::sync::oneshot;
    use std::error::Error;
    use tauri::State;
    use std::fmt;
    use tauri::async_runtime::spawn;
    use tokio::sync::Mutex;
    use anyhow::Result;
    use std::sync::{Arc, atomic::Ordering};
    use tokio::time::{timeout, Duration};
    
    use super::SESSION;

    use super::torrent_functions;

    use super::PAUSE_FLAG;
 
    use super::STOP_FLAG_TORRENT;
    use super::TORRENT_HANDLE;

    #[derive(Debug, Serialize, Deserialize)]
    pub struct CustomError {
        pub message: String,
    }

    impl fmt::Display for CustomError {
        fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
            write!(f, "{}", self.message)
        }
    }

    impl Error for CustomError {}

    impl From<Box<dyn Error>> for CustomError {
        fn from(error: Box<dyn Error>) -> Self {
            CustomError {
                message: error.to_string(),
            }
        }
    }



    #[tauri::command]
    pub async fn start_torrent_command(
        magnet_link: String,
        download_path: String,
        torrent_state: State<'_, super::TorrentState>,
        list_checkbox: Vec<String>,
        should_two_gb_limit: bool
    ) -> Result<Vec<String>, String> {
        
        let torrent_stats: Arc<Mutex<super::TorrentStatsInformations>> = Arc::clone(&torrent_state.stats);
    
        // Create oneshot channels for file list and user selection
        let (file_list_tx, file_list_rx) = oneshot::channel();
        let (file_selection_tx, file_selection_rx) = oneshot::channel();
    
        // Store the file_selection_tx in the TorrentState
        {
            let mut selection_tx_lock = torrent_state.file_selection_tx.lock().await;
            *selection_tx_lock = Some(file_selection_tx);
        }
    
        // Spawn the torrent thread
        spawn(async move {
            println!("{} , {}", magnet_link, download_path);
            if let Err(e) = torrent_functions::start_torrent_thread(
                magnet_link,
                torrent_stats,
                download_path,
                list_checkbox,
                file_list_tx,
                file_selection_rx,
                should_two_gb_limit
            )
            .await
            {
                eprintln!("Error in torrent thread: {:?}", e);
            }
        });
    
        // Wait for the file list from the spawned thread with a timeout of 5 seconds
        match timeout(Duration::from_secs(5), file_list_rx).await {
            Ok(file_list) => file_list.map_err(|e| format!("Failed to receive file list: {:?}", e)),
            Err(_) => Err("Timeout waiting for file list".into()),
        }
    }
    
    #[tauri::command]
    pub async fn select_files_to_download(
        selected_files: Vec<usize>,
        torrent_state: State<'_, super::TorrentState>,
    ) -> Result<(), String> {


        // Take the file_selection_tx from the TorrentState
        let mut file_selection_tx_lock = torrent_state.file_selection_tx.lock().await;
        if let Some(file_selection_tx) = file_selection_tx_lock.take() {
            file_selection_tx
                .send(selected_files)
                .map_err(|e| format!("Failed to send file selection: {:?}", e))?;
            Ok(())
        } else {
            Err("No file selection channel available".into())
        }


    }

    #[tauri::command]
    pub async fn get_torrent_stats(
        torrent_state: State<'_, super::TorrentState>,
    ) -> Result<super::TorrentStatsInformations, torrent_functions::TorrentError> {


        // Check the stop flag before fetching stats
        if super::STOP_GET_STATS.load(Ordering::Relaxed) {
            return Err(torrent_functions::TorrentError {
                message: "Fetching of torrent stats has been stopped.".into(),
            });
        }
    
        let torrent_stats: tokio::sync::MutexGuard<super::TorrentStatsInformations> =
            torrent_state.stats.lock().await;
        println!("Current torrent stats: {:?}", *torrent_stats);
        Ok(torrent_stats.clone())


    }

    #[tauri::command]
    pub async fn pause_torrent_command() -> Result<(), CustomError> {
        // Set the global pause flag
        PAUSE_FLAG.store(true, Ordering::Relaxed);
        Ok(())
    }

    #[tauri::command]
    pub async fn resume_torrent_command() -> Result<(), CustomError> {
        // Set the global pause flag
        PAUSE_FLAG.store(false, Ordering::Relaxed);
        let session =  SESSION.lock().await;
        let cus_session = session.as_ref().unwrap();
        let my_handle = TORRENT_HANDLE.lock().await;
        let _ = cus_session.unpause(&my_handle.as_ref().unwrap());
        Ok(())
    }

    #[tauri::command]
    pub async fn stop_torrent_command() -> Result<(), CustomError> {
        // Set the global stop flag
        STOP_FLAG_TORRENT.store(true, Ordering::Relaxed);
        Ok(())
    }
}