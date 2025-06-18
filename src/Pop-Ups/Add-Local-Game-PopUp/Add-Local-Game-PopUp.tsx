import { createSignal } from "solid-js";
import PopupModal from "../../components/Popup-Modal/PopupModal";
import Searchbar from "../../components/Topbar-01/Topbar-Components-01/Searchbar-01/Searchbar";
import { mkdir, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { message } from "@tauri-apps/plugin-dialog";
import { appDataDir, join } from "@tauri-apps/api/path";
import { invoke } from "@tauri-apps/api/core";
import Button from "../../components/UI/Button/Button";
import { AddLocalGamePopUpProps } from "../../types/popup";
import { LibraryAPI } from "../../api/library/api";
import { DownloadedGame, ExecutableInfo } from "../../bindings";

const AddLocalGamePopUp = (props: AddLocalGamePopUpProps) => {
  const [isOpen, setIsOpen] = createSignal(true);
  const [searchValue, setSearchValue] = createSignal("");
  const api = new LibraryAPI();

  const closePopup = () => {
    console.log("Closing popup from AddLocalGamePopUp");
    setIsOpen(false);
  };

  const handleConfirm = async () => {
    if (props.action) await props.action();
    await addToLibrary(searchValue());
    closePopup();
  };

  async function transformGameData(input: any): Promise<DownloadedGame> {
    const defaultExecutableInfo: ExecutableInfo = {
      executable_path: "",
      executable_last_opened_date: null,
      executable_play_time: 0,
      executable_installed_date: null,
      executable_disk_size: 0,
    };

    return {
      title: input.title || "",
      img: input.img || "",
      desc: input.desc || "",
      magnetlink: input.magnetlink || "",
      href: input.href || "",
      tag: input.tag || "",
      executable_info: defaultExecutableInfo,
      installation_info: {
        output_folder: "",
        download_folder: "",
        file_list: ["", ""],
        executable_info: defaultExecutableInfo,
      },
    };
  }

  async function addToLibrary(link: string) {
    const appDir = await appDataDir();
    const singularGameInfoPath = await join(appDir, "tempGames", "singular_game_temp.json");
    await invoke("get_singular_game_info", { gameLink: link });

    const singularFileContent = await readTextFile(singularGameInfoPath);
    const gameData = JSON.parse(singularFileContent);

    const downloadedGamesPath = await join(appDir, "library", "downloadedGames", "downloaded_games.json");
    const downloadFolder = await join(appDir, "library", "downloadedGames");

    try {
      await mkdir(downloadFolder, { recursive: true });
    } catch (error) {
      console.error("Error creating directory:", error);
    }

    let fileContent: DownloadedGame[] = [];

    try {
      const existingData = await readTextFile(downloadedGamesPath);
      fileContent = JSON.parse(existingData) || [];
    } catch (error) {
      console.warn("File does not exist or is empty. Creating a new one.");
    }

    const transformedData = await transformGameData(gameData[0]);

    const alreadyExists = fileContent.find(
      (item) => item.title === transformedData.title
    );

    if (!alreadyExists) {
      fileContent.push(transformedData);
      await writeTextFile(downloadedGamesPath, JSON.stringify(fileContent, null, 2));
      await message("Game added to Library successfully", { title: "FitLauncher", kind: "info" });
      window.location.reload();
    } else {
      await message("Game is already in Library", { title: "FitLauncher", kind: "warning" });
    }
  }

  return (
    <PopupModal isOpen={isOpen()} onClose={closePopup}>
      <div class="popup-content">
        <div class="popup-text-title">
          <p class="popup-main-title">{props.infoTitle || "Please choose :)"}</p>
        </div>
        <div class="popup-text-container">
          <Searchbar isTopBar={false} setSearchValue={setSearchValue} />
        </div>
        <div class="popup-footer-container">
          {props.infoFooter ||
            "If you have any issues with this, try to close and open the app. If it still persists, please contact us on Discord or GitHub."}
        </div>
        <div class="popup-buttons">
          <Button id="popup-cancel-button" onClick={closePopup} label="Cancel" />
          <Button id="popup-confirm-button" onClick={handleConfirm} label="Confirm" />
        </div>
      </div>
    </PopupModal>
  );
};

export default AddLocalGamePopUp;
