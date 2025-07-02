use serde::Deserialize;
use specta::Type;

use crate::structs::{DownloadedGame, ExecutableInfo, InstallationInfo};

#[allow(non_snake_case)]
#[derive(Deserialize, Type)]
pub struct LegacyDownloadedGame {
    pub torrentExternInfo: TorrentExternInfo,
    #[allow(dead_code)]
    pub torrentIdx: String,
    pub torrentOutputFolder: String,
    pub torrentDownloadFolder: String,
    pub torrentFileList: Vec<String>,
    #[allow(dead_code)]
    pub checkboxesList: bool,
    pub executableInfo: ExecutableInfo,
}

#[derive(Deserialize, Type)]
pub struct TorrentExternInfo {
    pub title: String,
    pub img: String,
    pub desc: String,
    pub magnetlink: String,
    pub href: String,
    pub tag: String,
}

pub(crate) fn convert_legacy_downloads(
    legacy_items: impl IntoIterator<Item = LegacyDownloadedGame>,
) -> Vec<DownloadedGame> {
    legacy_items
        .into_iter()
        .map(|legacy| DownloadedGame {
            title: legacy.torrentExternInfo.title,
            img: legacy.torrentExternInfo.img,
            desc: legacy.torrentExternInfo.desc,
            magnetlink: legacy.torrentExternInfo.magnetlink,
            href: legacy.torrentExternInfo.href,
            tag: legacy.torrentExternInfo.tag,
            executable_info: legacy.executableInfo.clone(),
            installation_info: InstallationInfo {
                output_folder: legacy.torrentOutputFolder,
                download_folder: legacy.torrentDownloadFolder,
                file_list: legacy.torrentFileList,
            },
            pastebin: String::new(),
        })
        .collect()
}
