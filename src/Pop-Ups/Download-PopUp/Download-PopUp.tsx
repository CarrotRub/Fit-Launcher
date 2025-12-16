import { createSignal, onMount, Show, Component, For } from "solid-js";
import { showError } from "../../helpers/error";
import { render } from "solid-js/web";
import {
  Loader2,
  AlertCircle,
  Settings,
} from "lucide-solid";
import { DownloadPopupProps } from "../../types/popup";
import { DownloadSettingsApi, GlobalSettingsApi } from "../../api/settings/api";
import PathInput from "../../components/UI/PathInput/PathInput";
import { InstallationSettings } from "../../bindings";
import { Modal } from "../Modal/Modal";
import createLastStepDownloadPopup from "./LastStep";
import Checkbox from "../../components/UI/Checkbox/Checkbox";



export default function createDownloadPopup(props: DownloadPopupProps) {
  const container = document.createElement("div");
  container.className = "fixed inset-0 z-50";
  document.body.appendChild(container);

  const destroy = () => {
    render(() => null, container);
    container.remove();
  };

  const DownloadPopupModal: Component = () => {
    const [pathInput, setPathInput] = createSignal<string>("");
    const [isPathValid, setIsPathValid] = createSignal(false);
    const [isInitialized, setIsInitialized] = createSignal(false);
    const [folderExclusion, setFolderExclusion] = createSignal<boolean>(true);

    const [installationSettings, setInstallationSettings] = createSignal<InstallationSettings>({
      auto_clean: false,
      auto_install: false,
      two_gb_limit: false,
      directx_install: false,
      microsoftcpp_install: false
    });
    const checkboxOptions = [
      ["Automatic Cleaning", "auto_clean"],
      ["Automatic Installation", "auto_install"],
      ["Limit to 2GB RAM", "two_gb_limit"],
      ["Install DirectX", "directx_install"],
      ["Install Microsoft C++", "microsoftcpp_install"]
    ] as const;

    async function handleCheckboxChange(key: keyof InstallationSettings) {
      const current = installationSettings();
      const newSettings = { ...current, [key]: !current[key] };

      setInstallationSettings(newSettings);

      const result = await GlobalSettingsApi.setInstallationSettings(newSettings);
      if (result.status === "error") {
        console.error("Failed to update installation settings:", result.error);
        await showError(result.error, "Could not save installation settings");
      }
    };



    onMount(async () => {
      try {
        const downloadSettings = await DownloadSettingsApi.getDownloadSettings();
        const settings = await GlobalSettingsApi.getInstallationSettings();
        if (downloadSettings.status === "ok") {
          console.log("settings: ", downloadSettings.data)
          setPathInput(downloadSettings.data.general.download_dir);
          setIsPathValid(true);
        } else {
          setPathInput("");
          setIsPathValid(false);
        }

        setInstallationSettings(settings)

      } catch (error) {
        console.error("Error initializing settings:", error);
        await showError(error, "Failed to load download settings");
      } finally {
        setIsInitialized(true);
      }
    });

    function handleConfirm() {
      destroy()
      createLastStepDownloadPopup({
        ...props,
        folderExclusion: folderExclusion(),
      });
    }

    return (
      <Modal {...props} onClose={destroy} onConfirm={handleConfirm}>
        <div class="p-4">
          <Show when={isInitialized()} fallback={
            <div class="flex flex-col items-center justify-center py-8">
              <Loader2 class="w-8 h-8 text-accent animate-spin mb-4" />

              <p class="text-muted">Loading download settings...</p>
            </div>
          }>
            <div class="space-y-6">
              {/* Download Path */}
              <div>
                <label class="block text-sm font-medium text-muted mb-2 items-center gap-2">
                  Download Location
                </label>
                <PathInput
                  value={pathInput()}
                  isDirectory={true}
                  onPathChange={async (path, valid) => {
                    setPathInput(path);
                    setIsPathValid(valid);
                    if (valid) {
                      try {
                        const currentSettings = await DownloadSettingsApi.getDownloadSettings();

                        if (currentSettings.status !== "ok") {
                          throw new Error("Failed to load current download settings");
                        }

                        const updatedSettings = {
                          ...currentSettings.data,
                          general: {
                            ...currentSettings.data.general,
                            download_dir: path
                          }
                        };

                        await DownloadSettingsApi.changeDownloadSettings(updatedSettings);
                      } catch (err) {
                        console.error("Failed to update path setting:", err);
                        await showError("Failed to save download path", "Error");
                      }
                    }
                  }}
                  class="w-full"
                />
                <Show when={!isPathValid() && pathInput()}>
                  <p class="text-xs text-red-400 mt-1 flex items-center gap-1">
                    <AlertCircle class="size-3" />
                    Directory doesn't exist or isn't accessible
                  </p>
                </Show>

                {/* Defender Exclusion Checkbox */}
                <div class="mt-3 flex flex-col">
                  <label class="flex items-center gap-2 cursor-pointer select-none">
                    <Checkbox
                      checked={folderExclusion()}
                      action={() => { setFolderExclusion(!folderExclusion()) }}
                    />
                    <span class="text-sm text-text">
                      Exclude this folder from Windows Defender (recommended to prevent installation issues)
                    </span>
                  </label>
                  <p class="text-xs text-muted ml-6 mt-0.5">
                    Needed so Windows Defender doesn’t block or remove installation files.
                  </p>
                </div>
              </div>


              {/* Installation Options */}
              <div class="space-y-3">
                <h3 class="text-sm font-medium text-muted flex items-center gap-2">
                  <Settings class="w-4 h-4 text-accent" />
                  Installation Options
                </h3>
                <div class="space-y-2 bg-popup/50  px-4 py-3 rounded-lg border border-secondary-20 backdrop-blur-sm shadow-sm">
                  <For each={checkboxOptions}>
                    {([labelText, key]) => (
                      <label
                        class="flex items-center justify-between gap-3 cursor-pointer w-full py-2 px-3 rounded-md transition-all  hover:bg-secondary-20/30 border border-transparent hover:border-accent"
                      >
                        <span class="text-sm text-text group-hover:text-primary transition-colors">
                          {labelText}
                        </span>
                        <Checkbox
                          checked={installationSettings()[key]}
                          action={() =>
                            handleCheckboxChange(key)
                          }
                        />
                      </label>
                    )}
                  </For>
                </div>
              </div>
            </div>
          </Show>
        </div>

      </Modal>
    );
  };

  render(() => <DownloadPopupModal />, container);
}
