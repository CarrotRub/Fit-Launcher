use std::{
    fs::Metadata,
    path::{Path, PathBuf},
};

pub use kanal;

use kanal::Sender;
use lru_cache_adaptor::{FileInfo, LRUResult, LruCache, disklru::Store};

pub type IOResult<T> = Result<T, std::io::Error>;
pub type ReclaimSpace = LRUResult<Vec<FileInfo<String>>>;
pub type InsertItem = LRUResult<Option<PathBuf>>;

pub enum Command {
    ReclaimSpace(isize, Option<Sender<ReclaimSpace>>),
    InsertItem(String, PathBuf, Option<Sender<InsertItem>>),
}

pub fn spawn_cache_manager() -> kanal::AsyncSender<Command> {
    let (tx, rx) = kanal::unbounded::<Command>();
    std::thread::spawn(move || {
        let max_files = 1024 * 1024;
        let Ok(store) = Store::open_with_path(cache_db_path(), max_files) else {
            return;
        };
        let mut lru: LruCache<String, PathBuf> = LruCache::new(store);
        while let Ok(command) = rx.recv() {
            command.exec(&mut lru);
        }
    });
    tx.to_async()
}

pub async fn initialize_used_cache_size() -> IOResult<u64> {
    let metadata = tauri::async_runtime::spawn_blocking(|| {
        let mut metadata = vec![];
        let cache_dir = cache_directory();
        visit_dirs(cache_dir, &mut metadata)?;
        IOResult::Ok(metadata)
    })
    .await
    .expect("failed to spawn thread")?;

    // TODO: handle accident user delete immediately?
    // reclaim_space will handle deleted record though

    let used_cache_size: u64 = metadata.iter().map(|(meta, _path)| meta.len()).sum();
    Ok(used_cache_size)
}

fn visit_dirs(dir_path: impl AsRef<Path>, out: &mut Vec<(Metadata, PathBuf)>) -> IOResult<()> {
    let dir_path = dir_path.as_ref();
    for entry in std::fs::read_dir(dir_path)?.flatten() {
        let Ok(metadata) = entry.metadata() else {
            continue;
        };
        let path = entry.path();

        if metadata.is_file() {
            out.push((metadata, path));
        } else {
            _ = visit_dirs(path, out);
        }
    }

    Ok(())
}

fn cache_db_path() -> PathBuf {
    cache_directory().join("cache.sled")
}

fn cache_directory() -> PathBuf {
    directories::BaseDirs::new()
        .expect("Could not determine base directories")
        .data_local_dir()
        .join("com.fitlauncher.carrotrub")
        .join("image_cache")
}

impl Command {
    fn exec(self, lru: &mut LruCache<String, PathBuf>) {
        match self {
            Command::ReclaimSpace(exceed, sender) => {
                let result = lru.retain_size(exceed);
                if let Some(sender) = sender {
                    _ = sender.send(result);
                }
            }
            Command::InsertItem(key, value, sendback) => {
                let result = lru.insert(&key, &value);
                if let Some(sendback) = sendback {
                    _ = sendback.send(result);
                }
            }
        }
    }
}
