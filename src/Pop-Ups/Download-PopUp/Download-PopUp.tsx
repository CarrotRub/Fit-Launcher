import { createSignal, onMount, Show, Component } from "solid-js";
import PopupModal from "../../components/Popup-Modal/PopupModal";
import PathInput from "../../components/UI/PathInput/PathInput";
import Checkbox from "../../components/UI/Checkbox/Checkbox";
import Button from "../../components/UI/Button/Button";
import "./Download-PopUp.css";
import { invoke } from "@tauri-apps/api/core";
import * as fs from "@tauri-apps/plugin-fs";
import { message } from "@tauri-apps/plugin-dialog";
import { addGlobalTorrentsInfo } from "../../components/functions/dataStoreGlobal";
import { useNavigate } from "@solidjs/router";
import { DownloadedGame } from "../../bindings";
import LabelCheckboxSettings from "../../pages/Settings-01/Settings-Categories/Components/UI/LabelCheckbox/LabelCheckbox";

interface DownloadPopupProps {
  badClosePopup: () => void;
  gameTitle: string;
  gameMagnet: string;
  externFullGameInfo: DownloadedGame;
}

interface InstallationSettings {
  twoGBLimit: boolean;
  directXInstall: boolean;
  microsoftCPPInstall: boolean;
}

const DownloadPopup: Component<DownloadPopupProps> = ({
  badClosePopup,
  gameTitle,
  gameMagnet,
  externFullGameInfo,
}) => {
  const [downloadPath, setDownloadPath] = createSignal<string | null>(null);
  const [isPathValid, setIsPathValid] = createSignal(false);
  const [isFinalStep, setIsFinalStep] = createSignal(false);
  const [isOpen, setIsOpen] = createSignal(true);
  const [isInitialized, setIsInitialized] = createSignal(false);

  const [installationSettings, setInstallationSettings] =
    createSignal<InstallationSettings>({
      twoGBLimit: false,
      directXInstall: false,
      microsoftCPPInstall: false,
    });

  const closePopup = () => {
    setIsOpen(false);
    badClosePopup();
  };

  const handleCheckboxChange = (key: keyof InstallationSettings, value: boolean) => {
    setInstallationSettings((prev) => ({ ...prev, [key]: value }));
  };

  onMount(async () => {
    try {
      const fullTorrentConfig = await invoke<{
        default_download_location: string;
      }>("get_torrent_full_settings");

      const defaultPath = fullTorrentConfig.default_download_location;
      const dirExists = await fs.exists(defaultPath);

      setDownloadPath(defaultPath);
      setIsPathValid(dirExists);
    } catch (error) {
      console.error("Error initializing settings:", error);
      setIsPathValid(false);
    } finally {
      setIsInitialized(true);
    }
  });

  const placePathIntoConfig = async () => {
    try {
      await invoke("config_change_only_path", { downloadPath: downloadPath() });
    } catch (error) {
      console.error("Error placing path into config:", error);
    }
  };

  const handlePathChange = (path: string, isValid: boolean) => {
    setDownloadPath(path);
    setIsPathValid(isValid);
  };

  return (
    <PopupModal isOpen={isOpen()} onClose={closePopup}>
      <div class="popup-content">
        <Show when={!isFinalStep()} fallback={
          <LastStep
            closePopup={closePopup}
            gameMagnet={gameMagnet}
            downloadGamePath={downloadPath()}
            externFullGameInfo={externFullGameInfo}
          />
        }>
          <>
            <div class="popup-text-title">
              <p class="popup-main-title">Download Game</p>
              <p class="popup-secondary-title">
                Do you really want to download {gameTitle}?
              </p>
            </div>
            <div class="popup-choose-path">
              <p class="popup-h2-title">Choose where you want to download the game:</p>
              <Show when={isInitialized()} fallback={<div>Loading path settings...</div>}>
                <PathInput
                  placeholder="Path for your game"
                  initialPath={downloadPath() || ""}
                  isDirectory={true}
                  onPathChange={handlePathChange}
                  isValidPath={isPathValid()}
                />
              </Show>
            </div>
            <div class="popup-choose-options">
              <p class="popup-h2-title">Choose the installation options:</p>
              <ul class="popup-list-options">
                <LabelCheckboxSettings
                  text="Limit to 2GB of RAM"
                  checked={installationSettings().twoGBLimit}
                  action={(value) => handleCheckboxChange("twoGBLimit", value)}
                />
                <LabelCheckboxSettings
                  text="Download and Install DirectX"
                  checked={installationSettings().directXInstall}
                  action={(value) => handleCheckboxChange("directXInstall", value)}
                />
                <LabelCheckboxSettings
                  text="Download and Install Microsoft C++ Redistributables"
                  checked={installationSettings().microsoftCPPInstall}
                  action={(value) => handleCheckboxChange("microsoftCPPInstall", value)}
                />
              </ul>
            </div>
            <div class="popup-buttons">
              <Button id="popup-cancel-button" onClick={closePopup} label="Cancel" />
              <Button
                id="popup-confirm-button"
                onClick={async () => {
                  setIsFinalStep(true);
                  await placePathIntoConfig();
                }}
                label="Next"
              />
            </div>
          </>
        </Show>
      </div>
    </PopupModal>
  );
};


interface LastStepProps {
  closePopup: () => void;
  gameMagnet: string;
  downloadGamePath: string | null;
  externFullGameInfo: DownloadedGame;
}

const LastStep: Component<LastStepProps> = ({
  closePopup,
  gameMagnet,
  downloadGamePath,
  externFullGameInfo,
}) => {
  const [isLoading, setLoading] = createSignal(true);
  const [gameStartedDownload, setGameStartedDownload] = createSignal(false);
  const navigate = useNavigate();

  // Dummy placeholder signals for file state, can be implemented similar to original
  const [completeIDFileList, setCompleteIDFileList] = createSignal<number[]>([]);
  const [checkboxesListComponents, setCheckboxesListComponents] = createSignal<string[]>([]);
  const [mainTorrentDetails, setMainTorrentDetails] = createSignal<any>(null);

  async function deleteUselessFiles(): Promise<void> {
    // Dummy function if needed for cleanup later
  }

  async function handleStartDownloadingTorrent() {
    setLoading(true);

    await invoke("torrent_create_from_url", {
      url: gameMagnet,
      opts: { only_files: completeIDFileList(), overwrite: true },
    });

    const installationSettings = await invoke<{
      directx_install: boolean;
      microsoftcpp_install: boolean;
      two_gb_limit: boolean;
    }>("get_installation_settings");

    const options: string[] = [];
    if (installationSettings.directx_install) options.push("directx");
    if (installationSettings.microsoftcpp_install) options.push("microsoft");
    setCheckboxesListComponents(options);

    deleteUselessFiles();

    addGlobalTorrentsInfo(
      externFullGameInfo,
      mainTorrentDetails()?.details?.info_hash || "",
      mainTorrentDetails()?.output_folder || "",
      downloadGamePath,
      options,
      installationSettings.two_gb_limit
    );

    setGameStartedDownload(true);
    setLoading(false);

    document.querySelector(".popup-main-title")!.textContent = "Download Started !";
    document.querySelector(".popup-secondary-title")!.textContent =
      "Your download started, go check the download page !";
    (document.querySelector(".torrent-additional-files-details") as HTMLElement).style.display = "none";

    navigate("/downloads-page");
  }

  return (
    <>
      <div class="popup-content">
        <div class="popup-text-title">
          <p class="popup-main-title">One Last Step !</p>
          <p class="popup-secondary-title">
            Yup this is really the last step before downloading. <br />
            If it takes some time it's normal, just wait, this is how a Torrent
            works, you can learn about it if you want. {":)"}
          </p>
        </div>

        {isLoading() ? (
          <div class="loading-icon-popup">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="72"
              height="72"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--secondary-color)"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          </div>
        ) : (
          <div class="torrent-additional-files-details">
            <p class="popup-h2-title">Choose what additional files to download :</p>
            {/* Render files & options */}
          </div>
        )}
      </div>

      <div class="popup-buttons">
        <Button id="popup-cancel-button" onClick={closePopup} label="Cancel" />
        <Button
          id="popup-confirm-button"
          onClick={() => {
            if (!gameStartedDownload()) {
              handleStartDownloadingTorrent();
            } else {
              closePopup();
            }
          }}
          label={!gameStartedDownload() ? "Next" : "Done"}
        />
      </div>
    </>
  );
};



export default DownloadPopup;
