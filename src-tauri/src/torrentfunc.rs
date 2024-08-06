use librqbit::Session;
use serde::Serialize;
use tokio::sync::Mutex;
use std::sync::{Arc, atomic::AtomicBool};
use lazy_static::lazy_static;
use librqbit::TorrentStatsState;

lazy_static! {
    static ref SESSION: Mutex<Option<Arc<Session>>> = Mutex::new(None);
}

// Define a shared boolean flag
static STOP_FLAG: AtomicBool = AtomicBool::new(false);
static STOP_FLAG_TORRENT: AtomicBool = AtomicBool::new(false);
static PAUSE_FLAG: AtomicBool = AtomicBool::new(false);

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
}



pub mod torrent_functions {

    use std::error::Error;
    use serde::{Deserialize, Serialize};
    use std::fmt;
    use std::time::Duration;
    use tokio::sync::Mutex;
    use anyhow::{Result, Context};
    use std::sync::{Arc, atomic::Ordering};
    use librqbit::{AddTorrent, AddTorrentOptions, AddTorrentResponse, Session, TorrentStatsState, SessionOptions};
    use tracing::info;

    use super::SESSION;
    use super::STOP_FLAG_TORRENT;
    use super::PAUSE_FLAG;

    
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




    // * Creating a special TorrentError that will just be an impl of anyhow basic string error.
    #[derive(Debug, Serialize)]
    pub struct TorrentError {
        pub message: String,
    }

    impl fmt::Display for TorrentError {
        fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
            write!(f, "{}", self.message)
        }
    }

    impl std::error::Error for TorrentError {}

    impl From<anyhow::Error> for TorrentError {
        fn from(error: anyhow::Error) -> Self {
            TorrentError {
                message: error.to_string(),
            }
        }
    }



    pub async fn start_torrent_thread(
        magnet_link: String,
        torrent_stats: Arc<Mutex<super::TorrentStatsInformations>>,
        download_path: String
    ) -> Result<(), anyhow::Error> {
        let output_dir: String = download_path;
        // let persistence_filename = format!("{}/.session_persistence.json", output_dir);
        let mut session = SESSION.lock().await;



        // Check if a session already exists by looking at the lazy_static
        if session.is_none() {
            // Define and initialize the SessionOptions struct
            let mut custom_session_options = SessionOptions::default();

            // Customize the options you want to change
            custom_session_options.disable_dht = false;
            custom_session_options.disable_dht_persistence = false;
            custom_session_options.persistence = false;
            // custom_session_options.persistence_filename = Some(PathBuf::from(persistence_filename.clone()));
            custom_session_options.enable_upnp_port_forwarding = true;

            // Create a new session with the specified options
            let new_session: Arc<Session> = Session::new_with_opts(
                output_dir.into(),
                custom_session_options
            )
            .await
            .context("error creating session")?;

            *session = Some(new_session);
        }

        let session = session.clone().unwrap();


        // let managed_torrents_list = session.with_torrents( callback);

        let handle = match session
        .add_torrent(
            AddTorrent::from_url(&magnet_link),
            Some(AddTorrentOptions {
                overwrite: true,
                disable_trackers: false, // * Not sure about this one, not the best but better for greater optimization. Prevent useless dead trackers.

                ..Default::default()
            }),
        )
        .await
        .context("error adding torrent")?
        {
            AddTorrentResponse::Added(_, handle) => handle,
            _ => unreachable!(),
        };
        info!("Details: {:?}", &handle.info().info);



        {
            let handle = handle.clone();
            let torrent_stats = Arc::clone(&torrent_stats);
            tokio::spawn(async move {
                loop {
                    tokio::time::sleep(Duration::from_secs(1)).await;
                    let stats = handle.stats();
                    let mut torrent_stats = torrent_stats.lock().await;

                    // Just copying stats from the handler to the Structure.
                    torrent_stats.state = stats.state.clone();
                    torrent_stats.file_progress = stats.file_progress.clone();
                    torrent_stats.error = stats.error.clone();
                    torrent_stats.progress_bytes = stats.progress_bytes;
                    torrent_stats.uploaded_bytes = stats.uploaded_bytes;
                    torrent_stats.total_bytes = stats.total_bytes;
                    torrent_stats.finished = stats.finished;


                    if let Some(live_stats) = stats.live {

                        torrent_stats.download_speed = Some(live_stats.download_speed.mbps as f64);
                        torrent_stats.upload_speed = Some(live_stats.upload_speed.mbps as f64);

                        torrent_stats.average_piece_download_time = live_stats
                            .average_piece_download_time
                            .map(|d| d.as_secs_f64());

                        // Gets it directly as a string because I stupidly decided to not use the API.
                        // I also actually forgot why exactly I couldn't use the impl/struct, probably because it was private though.
                        torrent_stats.time_remaining = live_stats
                        .time_remaining
                        .map(|d|d.to_string() );

                        if torrent_stats.finished {
                            stop_torrent_function(session.clone()).await;
                            break; // Exit the loop if finished
                        }

                        if STOP_FLAG_TORRENT.load(Ordering::Relaxed) {
                            stop_torrent_function(session.clone()).await;
                            break; // Exit the loop if finished
                        }

                        if PAUSE_FLAG.load(Ordering::Relaxed) {
                            pause_torrent_function(torrent_stats.to_owned()).await;
                            break; // Exit the loop if finished
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
        }

        handle.wait_until_completed().await?;
        info!("torrent downloaded");

        Ok(())
    }


    async fn stop_torrent_function(session_id: Arc<Session>){
        session_id.stop().await;
    }



    // New pause_torrent_function
    async fn pause_torrent_function(torrent_stats: super::TorrentStatsInformations) {
        // let torrent_stats: Arc<Mutex<TorrentStatsInformations>> = Arc::clone(&torrent_state.stats);
        let mut stats = torrent_stats;

        // Update the state to paused
        stats.state = TorrentStatsState::Paused;


    }



}


pub mod torrent_commands {

    use serde::{Deserialize, Serialize};
    use std::error::Error;
    use tauri::State;
    use std::fmt;
    use tauri::async_runtime::spawn;
    use tokio::sync::Mutex;
    use anyhow::Result;
    use std::sync::{Arc, atomic::Ordering};

    use super::torrent_functions;

    use super::PAUSE_FLAG;
    use super::STOP_FLAG;

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
    ) -> Result<(), String> {
        let torrent_stats: Arc<Mutex<super::TorrentStatsInformations>> = Arc::clone(&torrent_state.stats);
        spawn(async move {
            println!("{} , {}",magnet_link, download_path);
            if let Err(e) = torrent_functions::start_torrent_thread(magnet_link, torrent_stats, download_path).await {
                eprintln!("Error in torrent thread: {:?}", e);
            }
        });
        Ok(())
    }

    #[tauri::command]
    pub async fn get_torrent_stats(torrent_state: State<'_, super::TorrentState>) -> Result<super::TorrentStatsInformations, torrent_functions::TorrentError> {
        let torrent_stats: tokio::sync::MutexGuard<super::TorrentStatsInformations> = torrent_state.stats.lock().await;
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
        Ok(())
    }

    #[tauri::command]
    pub async fn stop_torrent_command() -> Result<(), CustomError> {
        // Set the global stop flag
        STOP_FLAG.store(true, Ordering::Relaxed);
        Ok(())
    }
}