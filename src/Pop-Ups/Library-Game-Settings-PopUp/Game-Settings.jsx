import { appDataDir, join } from "@tauri-apps/api/path";
import { confirm, message, open } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { createEffect, createSignal, onMount } from "solid-js";
import "../Download-PopUp/Download-PopUp.css";
import "./Game-Settings.css";
const appDir = await appDataDir();

async function userDownloadedGamesPath() {
 return await join(appDir, "library", "downloadedGames");
}

const GameSettingsLibraryPopUp = ({
 infoTitle,
 infoMessage,
 infoPlaceholder,
 defaultPath,
 fileType,
 multipleFiles,
 isDirectory,
 infoFooter,
 userGame,
}) => {
 const [textInputValue, setTextInputValue] = createSignal("");
 const [isDialogOpen, setIsDialogOpen] = createSignal(false); // Lock for dialog state
 const [currentPath, setCurrentPath] = createSignal("");
 const [currentFolderPath, setCurrentFolderPath] = createSignal("");
 function closePopup() {
  const fullPopup = document.querySelector(".popup-gamesettings-overlay");
  if (fullPopup) {
   fullPopup.remove();
  }
 }

 function clearExeTextInput() {
  setCurrentPath("");
 }

 function clearFolderTextInput() {
  setCurrentFolderPath("");
 }

 onMount(() => {
  let path_exe = userGame?.executableInfo?.executable_path || defaultPath;
  setCurrentPath(path_exe);
  setCurrentFolderPath(
   userGame?.torrentOutputFolder?.replace(" [FitGirl Repacks]", ""),
  );
 });

 createEffect(() => {
  const labelElement = document.querySelector(".popup-input-label");

  if (labelElement) {
   const handleClick = async event => {
    if (isDialogOpen()) {
     console.log("Dialog already open. Wait for it to close.");
     return; // Prevent opening another dialog
    }

    const rect = labelElement.getBoundingClientRect();
    const clickPosition = event.clientX;
    const iconBoundary = rect.right - 30;
    console.warn(defaultPath);

    if (clickPosition >= iconBoundary) {
     setIsDialogOpen(true);
     try {
      let chosenPath = await open({
       directory: isDirectory,
       multiple: multipleFiles,
       extensions: fileType,
       defaultPath: currentPath(),
      });
      if (chosenPath) {
       setCurrentPath(chosenPath);
      }
     } catch (error) {
      await message(error, { title: "FitLauncher", kind: "error" });
     } finally {
      setIsDialogOpen(false); // Unlock the dialog state
     }
    }
   };

   labelElement.addEventListener("click", handleClick);

   // Cleanup the listener to prevent duplication
   return () => {
    labelElement.removeEventListener("click", handleClick);
   };
  }
 });

 createEffect(() => {
  console.log(currentPath());
 });

 async function handleDeleteGame() {
  let user_downloaded_game_path = await userDownloadedGamesPath();
  const fullPath = await join(
   user_downloaded_game_path,
   "downloaded_games.json",
  );
  const fileContent = await readTextFile(fullPath);
  const downloadedGames = JSON.parse(fileContent);

  const confirmation = await confirm(
   "This will only delete the files from the library, not the games files, you will need to do that manually. Are you sure?",
   { title: "Tauri", kind: "warning" },
  );

  if (confirmation) {
   const updatedGames = downloadedGames.filter(
    game =>
     game?.torrentExternInfo?.title !== userGame.torrentExternInfo?.title,
   );

   try {
    await writeTextFile(fullPath, JSON.stringify(updatedGames, null, 2));
    await message("Deleted game from library successfully!", {
     title: "FitLauncher",
     kind: "info",
    });
    closePopup();
    window.location.reload();
   } catch (error) {
    await message(error, { title: "FitLauncher", kind: "error" });
   }
  }
 }
 return (
  <div class="popup-gamesettings-overlay">
   <div class="basic-gamesettings-popup">
    <div class="popup-content" style={{ justifyContent: "space-between" }}>
     <div class="popup-text-title">
      <p class="popup-main-title">
       {infoTitle ? infoTitle : "Fill the input :)"}
      </p>
     </div>

     <div class="popup-text-container">
      <p innerHTML={infoMessage}></p>
     </div>

     <div class="popup-game-settings-container">
      <p>Path to Executable :</p>
      <label class="popup-input-label">
       <input
        class="popup-game-settings"
        placeholder={infoPlaceholder}
        style={{ fontSize: "14px" }}
        value={currentPath()}
        oninput={e => setCurrentPath(e.target.value)}
       />
      </label>
      <svg
       onclick={clearExeTextInput}
       style={{ cursor: "pointer" }}
       xmlns="http://www.w3.org/2000/svg"
       width="24"
       height="24"
       viewBox="0 0 24 24"
       fill="none"
       stroke="currentColor"
       stroke-width="2"
       stroke-linecap="round"
       stroke-linejoin="round"
       class="lucide lucide-eraser"
      >
       <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21m9 0H7M5 11l9 9" />
      </svg>
     </div>

     <div class="popup-game-settings-container">
      <p>
       Path to Folder :{" "}
       <small>
        <i>
         Sadly for now there is no way to get game's size when adding local game
         :(
        </i>
       </small>
      </p>
      {/* TODO: IMPORTANT, I NEED NOT TO FORGET TO ADD A NEW WAY AND ALSO TO FCKNG ADD THE OBJ TO RUST STRUCT CUZ RUST IS JUST THAT GUY AND IS WAY BETTER IN EVERYTHING I SHOULD HAVE USED MY STUPID BRAIN TO THINK THAT WHILE REMAKING EVERYTHING BUT IM TOO SLOW IN THE HEAD SO NOW I'LL HAVE TO REDO EVERYTHING AGAIN I'M GONNA REMOVE MYSELF FROM LIFE. */}
     </div>

     <div class="popup-footer-container">
      {infoFooter
       ? infoFooter
       : "If you have any issues with this, try to close and open the app. If it still persists, please contact us on Discord (link in the settings page) or on GitHub."}
     </div>

     <div class="popup-buttons">
      <button id="popup-delete-button" onclick={handleDeleteGame}>
       Delete
      </button>
      <button id="popup-cancel-button" onclick={closePopup}>
       Cancel
      </button>
      <button
       id="popup-confirm-button"
       onclick={async () => {
        closePopup();
       }}
      >
       Confirm
      </button>
     </div>
    </div>
   </div>
  </div>
 );
};

export default GameSettingsLibraryPopUp;
