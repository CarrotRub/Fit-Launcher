import { createSignal } from "solid-js";
import PopupModal from "../../components/Popup-Modal/PopupModal";
import Searchbar from "../../components/Topbar-01/Topbar-Components-01/Searchbar-01/Searchbar";
import { mkdir, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { message } from "@tauri-apps/plugin-dialog";
import { appDataDir, join } from "@tauri-apps/api/path";
import { invoke } from "@tauri-apps/api/core";

const appDir = await appDataDir();

const AddLocalGamePopUp = ({ infoTitle, infoFooter, action }) => {
    const [isOpen, setIsOpen] = createSignal(true);
    const [searchValue, setSearchValue] = createSignal("");

    const closePopup = () => {
        console.log("Closing popup from AddLocalGamePopUp");
        setIsOpen(false); 
    };

    function transformGameData(input) {
      const transformedData = {
        torrentExternInfo: {
          title: input.title || "",
          img: input.img || "",
          desc: input.desc || "",
          magnetlink: input.magnetlink || "",
          href: input.href || "",
          tag: input.tag || "",
        },
        torrentIdx: extractTorrentIdx(input.magnetlink) || "",
        torrentOutputFolder: "",
        torrentDownloadFolder: "",
        torrentFileList: ["", ""],
        checkboxesList: true,
        executableInfo: {
          executable_path: "",
          executable_last_opened_date: null,
          executable_play_time: 0,
          executable_installed_date: null,
          executable_disk_size: 0,
        },
      };
    
      return transformedData;
    }
    
    // Utility function to extract `torrentIdx` from magnet link
    async function extractTorrentIdx(magnetlink) {
      if (!magnetlink) return "";
      let idx = await invoke('get_torrent_idx_from_url', {url: magnetlink})
      return idx;
    }

  async function addToLibrary(link) {
      const singularGameInfoPath = await join(appDir, 'tempGames', 'singular_game_temp.json')
      await invoke('get_singular_game_info', { gameLink: link });
      const singularFileContent = await readTextFile(singularGameInfoPath);
      const gameData = JSON.parse(singularFileContent);

      const userDownloadedGames = await join(appDir, 'library', 'downloadedGames', 'downloaded_games.json');

      try {
        let toDownloadDirPath = await join(appDir, 'library', 'downloadedGames');
        await mkdir(toDownloadDirPath, { recursive: true });
      } catch (error) {
        console.error('Error creating directory:', error);
      }

      let fileContent = [];
      try {
        const existingData = await readTextFile(userDownloadedGames);
        fileContent = JSON.parse(existingData) || [];
      } catch (error) {
        console.warn('File does not exist or is empty. Creating a new one.');
      }
    
      // Ensure the content is an array
      if (!Array.isArray(fileContent)) {
        throw new Error('File content is not an array, cannot append.');
      }
    
      let transformedData = transformGameData(gameData[0]);

      // CHECK FOR DUPLICATES HERE
      // Use a unique property to identify if the game is already in the file.
      const alreadyInIndex = fileContent.findIndex(
        (item) => item.torrentIdx === transformedData.torrentIdx
      );
    
      if (alreadyInIndex === -1) {
        // Only push to the array if it's not already there
        fileContent.push(transformedData);

        await writeTextFile(userDownloadedGames, JSON.stringify(fileContent, null, 2));
        console.log('New data appended successfully!');
        await message('Game added to Library successfully', {title: 'FitLauncher', kind: 'info'});
        window.location.reload();
      } else {
          await message('Game is already in Library', {title: 'FitLauncher', kind: 'warning'});
      }
  }


    const handleConfirm = () => {
        if (action) action();
        closePopup();
        addToLibrary(searchValue());
    };

    return (
        <PopupModal isOpen={isOpen} onClose={closePopup}>
            <div className="popup-content">
                <div className="popup-text-title">
                    <p className="popup-main-title">{infoTitle || "Please choose :)"}</p>
                </div>
                <div className="popup-text-container">
                    <Searchbar isTopBar={false} setSearchValue={setSearchValue} />
                </div>
                <div className="popup-footer-container">
                    {infoFooter ||
                        "If you have any issues with this, try to close and open the app. If it still persists, please contact us on Discord or GitHub."}
                </div>
                <div className="popup-buttons">
                    <button id="popup-cancel-button" onClick={() => closePopup()}>
                        Cancel
                    </button>
                    <button id="popup-confirm-button" onClick={handleConfirm}>
                        Confirm
                    </button>
                </div>
            </div>
        </PopupModal>
    );
};

export default AddLocalGamePopUp;