import { appDataDir, join } from "@tauri-apps/api/path";
import { mkdir, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { createSignal, onMount } from "solid-js";

import { invoke } from "@tauri-apps/api/core";
import { message } from "@tauri-apps/plugin-dialog";
import Searchbar from "../../components/Header-01/Header-Components-01/Searchbar-01/Searchbar";
import "../Download-PopUp/Download-PopUp.css";
import "./Add-Local-Game-PopUp.css";
const appDir = await appDataDir();

const AddLocalGamePopUp = ({ infoTitle, infoMessage, infoFooter, action }) => {
 const [searchValue, setSearchValue] = createSignal("");
 function closePopup() {
  const popup = document.querySelector(".popup-addlocalgame-overlay");
  if (popup) {
   popup.classList.remove("show");
   setTimeout(() => {
    popup.remove();
   }, 300); // Matches transition duration
  }
 }

 onMount(() => {
  const popup = document.querySelector(".popup-addlocalgame-overlay");
  if (popup) {
   setTimeout(() => {
    popup.classList.add("show");
   }, 10); // Small delay to trigger transition
  }
 });

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
  let idx = await invoke("get_torrent_idx_from_url", { url: magnetlink });
  return idx;
 }

 async function addToLibrary(link) {
  const singularGameInfoPath = await join(
   appDir,
   "tempGames",
   "singular_game_temp.json",
  );
  await invoke("get_singular_game_info", { gameLink: link });
  const singularFileContent = await readTextFile(singularGameInfoPath);
  const gameData = JSON.parse(singularFileContent);

  const userDownloadedGames = await join(
   appDir,
   "library",
   "downloadedGames",
   "downloaded_games.json",
  );

  try {
   let toDownloadDirPath = await join(appDir, "library", "downloadedGames");
   await mkdir(toDownloadDirPath, { recursive: true });
  } catch (error) {
   console.error("Error creating directory:", error);
  }

  let fileContent = [];
  try {
   const existingData = await readTextFile(userDownloadedGames);
   fileContent = JSON.parse(existingData) || [];
  } catch (error) {
   console.warn("File does not exist or is empty. Creating a new one.");
  }

  // Ensure the content is an array
  if (!Array.isArray(fileContent)) {
   throw new Error("File content is not an array, cannot append.");
  }

  let transformedData = transformGameData(gameData[0]);

  // CHECK FOR DUPLICATES HERE
  // Use a unique property to identify if the game is already in the file.
  const alreadyInIndex = fileContent.findIndex(
   item => item.torrentIdx === transformedData.torrentIdx,
  );

  if (alreadyInIndex === -1) {
   // Only push to the array if it's not already there
   fileContent.push(transformedData);

   await writeTextFile(
    userDownloadedGames,
    JSON.stringify(fileContent, null, 2),
   );
   console.log("New data appended successfully!");
   await message("Game added to Library successfully", {
    title: "FitLauncher",
    kind: "info",
   });
   window.location.reload();
  } else {
   await message("Game is already in Library", {
    title: "FitLauncher",
    kind: "warning",
   });
  }
 }

 return (
  <div class="popup-addlocalgame-overlay">
   <div class="basic-addlocalgame-popup">
    <div class="popup-content">
     <div class="popup-text-title">
      <p class="popup-main-title">
       {infoTitle ? infoTitle : "Please choose :)"}
      </p>
     </div>

     <div class="popup-text-container">
      <Searchbar isTopBar={false} setSearchValue={setSearchValue} />
     </div>

     <div class="popup-footer-container">
      {infoFooter
       ? infoFooter
       : "If you have any issues with this try to close and open the app, if it still persists, please contact us on Discord, link in the settings page or on github"}
     </div>
    </div>
    <div class="popup-buttons">
     <button id="popup-cancel-button" onclick={closePopup}>
      Cancel
     </button>
     <button
      id="popup-confirm-button"
      onclick={() => {
       if (action != null) {
        action();
       }

       closePopup();
       addToLibrary(searchValue());
      }}
     >
      Confirm
     </button>
    </div>
   </div>
  </div>
 );
};

export default AddLocalGamePopUp;
