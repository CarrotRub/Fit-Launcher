import {
  createSignal,
  createEffect,
  on,
  Show,
  type JSX
} from "solid-js";

import { showError } from "../../../../helpers/error";
import { DownloadSettings, DownloadSettingsPart } from "../../../../types/settings/types";
import GeneralSettingsPart from "./General/GeneralPart";
import Button from "../../../../components/UI/Button/Button";
import LoadingPage from "../../../LoadingPage-01/LoadingPage";
import { DownloadSettingsApi } from "../../../../api/settings/api";
import TransferLimitsPart from "./TransferLimits/TransferLimits";
import NetworkPart from "./Network/NetworkPart";
import BittorrentPart from "./Bittorrent/BittorrentPart";
import AriaPart from "./AriaPart/AriaPart";
import CachePart from "../Global/CacheSettings/CacheSettings";


function DownloadConfigurationPage(props: { settingsPart: DownloadSettingsPart }): JSX.Element {
  const [globalTorrentConfig, setGlobalTorrentConfig] = createSignal<DownloadSettings | null>(null);
  const [saveLabel, setSaveLabel] = createSignal("Save");
  const [dirtyPaths, setDirtyPaths] = createSignal<Set<string>>(new Set());
  const [pulsePaths, setPulsePaths] = createSignal<Set<string>>(new Set());
  const selectedPart = () => props.settingsPart || "general";

  async function loadSettings() {
    const settings = await DownloadSettingsApi.getDownloadSettings();
    if (settings.status === "ok") {
      setGlobalTorrentConfig(settings.data);
      setDirtyPaths(new Set<string>()); // Clear dirty tracking on load
    } else {
      await showError(settings.error, "Error getting the download settings");
    }
  }

  // Re-fetch settings when switching sub-pages (discards unsaved changes)
  createEffect(on(
    selectedPart,
    () => { loadSettings(); },
    { defer: false }
  ));

  const handleSwitchCheckChange = (path: string) => {
    setDirtyPaths(prev => new Set([...prev, path]));
    setGlobalTorrentConfig((prevConfig) => {
      if (!prevConfig) return prevConfig;
      const newConfig = structuredClone(prevConfig);
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
    setDirtyPaths(prev => new Set([...prev, path]));
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

    const result = await DownloadSettingsApi.changeDownloadSettings(config);
    if (result.status === "ok") {
      setSaveLabel("Saved");
      // Trigger pulse animation on dirty fields
      setPulsePaths(new Set<string>(dirtyPaths()));
      setTimeout(() => {
        setSaveLabel("Save");
        setPulsePaths(new Set<string>());
        setDirtyPaths(new Set<string>()); // Clear dirty after animation
      }, 1000);
    } else {
      console.error(result.error);
      await showError(result.error, "Error saving settings");
    }
  };

  // Helpers for field-level state
  const isDirty = (path: string) => dirtyPaths().has(path);
  const savePulse = (path: string) => pulsePaths().has(path);

  return (
    <Show when={globalTorrentConfig()} fallback={<LoadingPage />}>
      <div class="flex flex-col gap-6 h-full w-auto p-3 justify-between">
        {{
          general: (
            <GeneralSettingsPart
              settings={() => globalTorrentConfig()!.general}
              handleTextCheckChange={handleTextCheckChange}
              handleSwitchCheckChange={handleSwitchCheckChange}
              isDirty={isDirty}
              savePulse={savePulse}
            />
          ),
          limits: (
            <TransferLimitsPart
              settings={() => globalTorrentConfig()!.limits}
              handleTextCheckChange={handleTextCheckChange}
              isDirty={isDirty}
              savePulse={savePulse}
            />
          ),
          network: (
            <NetworkPart
              settings={() => globalTorrentConfig()!.network}
              handleTextCheckChange={handleTextCheckChange}
              isDirty={isDirty}
              savePulse={savePulse}
            />
          ),
          bittorrent: (
            <BittorrentPart
              settings={() => globalTorrentConfig()!.bittorrent}
              handleSwitchCheckChange={handleSwitchCheckChange}
              handleTextCheckChange={handleTextCheckChange}
              isDirty={isDirty}
              savePulse={savePulse}
            />
          ),
          rpc: (
            <AriaPart
              settings={() => globalTorrentConfig()!.rpc}
              handleSwitchCheckChange={handleSwitchCheckChange}
              handleTextCheckChange={handleTextCheckChange}
              isDirty={isDirty}
              savePulse={savePulse}
            />
          )
        }[selectedPart()] ?? <p>Invalid or Unsupported Part</p>}

        <div class="flex flex-row self-end gap-3 ">
          <Button onClick={handleOnSave} label={saveLabel()} variant="solid" />
        </div>
      </div>
    </Show>
  );
}

export default DownloadConfigurationPage;
