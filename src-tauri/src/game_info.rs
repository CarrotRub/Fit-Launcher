pub mod games_informations {
    use chrono::{NaiveDate, NaiveDateTime};
    use serde::Serialize;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};
    use std::{fs, io};

    #[derive(Serialize)]
    pub struct ExecutableInfo {
        executable_path: PathBuf,
        executable_last_opened_date: NaiveDate,
        executable_play_time: String,
        executable_installed_date: NaiveDate,
        executable_disk_size: u64,
    }
    fn dir_size(path: impl Into<PathBuf>) -> io::Result<u64> {
        fn dir_size(mut dir: fs::ReadDir) -> io::Result<u64> {
            dir.try_fold(0, |acc, file| {
                let file = file?;
                let size = match file.metadata()? {
                    data if data.is_dir() => dir_size(fs::read_dir(file.path())?)?,
                    data => data.len(),
                };
                Ok(acc + size)
            })
        }

        dir_size(fs::read_dir(path.into())?)
    }
    #[tauri::command]
    pub fn executable_info_discovery(
        path_to_exe: PathBuf,
        path_to_folder: PathBuf,
    ) -> Option<ExecutableInfo> {
        let metadata = fs::metadata(&path_to_exe).ok()?;

        let mut total_size = dir_size(path_to_folder).unwrap();

        let executable_disk_size = total_size;

        // Helper function to convert SystemTime to NaiveDate
        fn system_time_to_naive_date(system_time: SystemTime) -> Option<NaiveDate> {
            let duration_since_epoch = system_time.duration_since(UNIX_EPOCH).ok()?;
            NaiveDateTime::from_timestamp_opt(duration_since_epoch.as_secs() as i64, 0)
                .map(|naive_date_time| naive_date_time.date())
        }

        // Get the installed date (creation time or fallback to modified time)
        let executable_installed_date = metadata
            .created()
            .ok()
            .and_then(system_time_to_naive_date)
            .or_else(|| metadata.modified().ok().and_then(system_time_to_naive_date))
            .unwrap_or_else(|| NaiveDate::from_ymd(1970, 1, 1));

        // Get the last opened date (accessed time)
        let executable_last_opened_date = metadata
            .accessed()
            .ok()
            .and_then(system_time_to_naive_date)
            .unwrap_or_else(|| NaiveDate::from_ymd(1970, 1, 1));

        // Set the executable play time (placeholder value as it can't be determined from metadata)
        let executable_play_time = "Coming Soon...".to_string();

        Some(ExecutableInfo {
            executable_path: path_to_exe,
            executable_last_opened_date,
            executable_play_time,
            executable_installed_date,
            executable_disk_size,
        })
    }
}
