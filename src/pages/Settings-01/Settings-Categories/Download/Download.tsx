import {
  createSignal,
  onMount,
  Show,
  type JSX
} from "solid-js";

import { invoke } from "@tauri-apps/api/core";
import { message } from "@tauri-apps/plugin-dialog";
import { SettingsSectionProps, DownloadSettings, DownloadSettingsPart } from "../../../../types/settings/types";
import GeneralSettingsPart from "./General/GeneralPart";
import Button from "../../../../components/UI/Button/Button";
import LoadingPage from "../../../LoadingPage-01/LoadingPage";
import { DownloadSettingsApi } from "../../../../api/settings/api";
import TransferLimitsPart from "./TransferLimits/TransferLimits";

const downloadConfigAPI = new DownloadSettingsApi();

function DownloadConfigurationPage(props: { settingsPart: DownloadSettingsPart }): JSX.Element {
  const [globalTorrentConfig, setGlobalTorrentConfig] = createSignal<DownloadSettings | null>(null);
  console.log()
  const selectedPart = () => props.settingsPart || "general";
  console.log("Selected part:", props);

  onMount(async () => {
    let settings = await downloadConfigAPI.getDownloadSettings();
    if (settings.status === "ok") {
      setGlobalTorrentConfig(settings.data);
    } else {
      await message(`Error getting the download settings: ${settings.error}`, {
        title: "FitLauncher",
        kind: "error",
      });
    }
  });

  const handleSwitchCheckChange = (path: string) => {
    setGlobalTorrentConfig((prevConfig) => {
      if (!prevConfig) return prevConfig;
      const newConfig = structuredClone(prevConfig); // safer than shallow copy
      const keys = path.split(".");
      let obj: any = newConfig;
      for (let i = 0; i < keys.length - 1; i++) {
        obj = obj[keys[i]];
      }
      obj[keys.at(-1)!] = !obj[keys.at(-1)!];
      return newConfig;
    });
  };

  const handleTextCheckChange = (path: string, newValue: string | number) => {
    setGlobalTorrentConfig((prevConfig) => {
      if (!prevConfig) return prevConfig;
      const newConfig = structuredClone(prevConfig);
      const keys = path.split(".");
      let obj: any = newConfig;
      for (let i = 0; i < keys.length - 1; i++) {
        obj = obj[keys[i]];
      }
      obj[keys.at(-1)!] = newValue;
      return newConfig;
    });
  };

  const handleOnSave = async () => {
    const config = globalTorrentConfig();
    if (!config) return;

    const result = await downloadConfigAPI.changeDownloadSettings(config);
    if (result.status === "ok") {
      await message("Settings Saved Successfully", {
        title: "FitLauncher",
        kind: "info",
      });
    } else {
      await message("Error saving settings: " + result.error, {
        title: "FitLauncher",
        kind: "error",
      });
    }
  };


  return (
    <Show when={globalTorrentConfig()} fallback={<LoadingPage />}>
      <div class="flex flex-col gap-6 h-full w-auto p-3 justify-between">
        {{
          general: (
            <GeneralSettingsPart
              settings={() => globalTorrentConfig()?.general!}
              handleTextCheckChange={handleTextCheckChange}
            />
          ),
          limits: (
            <TransferLimitsPart
              settings={() => globalTorrentConfig()?.limits!}
              handleTextCheckChange={handleTextCheckChange}
            />
          ),
          network: (
            <GeneralSettingsPart
              settings={() => globalTorrentConfig()?.general!}
              handleSwitchCheckChange={handleSwitchCheckChange}
            />
          ),
          bittorrent: (
            <GeneralSettingsPart
              settings={() => globalTorrentConfig()?.general!}
              handleSwitchCheckChange={handleSwitchCheckChange}
            />
          ),
          rpc: (
            <GeneralSettingsPart
              settings={() => globalTorrentConfig()?.general!}
              handleSwitchCheckChange={handleSwitchCheckChange}
            />
          )
        }[selectedPart()] ?? <p>Invalid or Unsupported Part</p>}

        <div class="flex flex-row self-end gap-3 ">
          <Button onClick={handleOnSave} label="Save" variant="solid" />
        </div>
      </div>
    </Show>
  );
}

export default DownloadConfigurationPage;
