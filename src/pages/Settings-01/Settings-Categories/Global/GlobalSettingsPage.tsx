import { createSignal, onMount, Show } from "solid-js";
import type { JSX } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { confirm, message } from "@tauri-apps/plugin-dialog";
import { relaunch } from "@tauri-apps/plugin-process";
import CachePart from "./CacheSettings/CacheSettings";
import { showError } from "../../../../helpers/error";
import InstallSettingsPart from "./InstallSettings/InstallSettings";
import DNSPart from "./DNSSettings/DNSSettings";
import DisplayPart from "./DisplayPart/DisplayPart";

import {
  commands,
  type CacheSettings,
  type FitLauncherDnsConfig,
  type GamehubSettings,
  type InstallationSettings
} from "../../../../bindings";
import { GlobalSettings, GlobalSettingsPart } from "../../../../types/settings/types";
import { DownloadSettingsApi, GlobalSettingsApi } from "../../../../api/settings/api";
import LoadingPage from "../../../LoadingPage-01/LoadingPage";
import Button from "../../../../components/UI/Button/Button";
import AppInfoSettings from "./AppInfoSettings/AppInfo";

function GlobalSettingsPage(props: { settingsPart: GlobalSettingsPart }): JSX.Element {
  const [globalSettings, setGlobalSettings] = createSignal<GlobalSettings | null>(null);
  const [cacheSettings, setCacheSettings] = createSignal<CacheSettings | null>(null);

  const selectedPart = () =>
    (props.settingsPart.replace("global-", "") || "display") as
    | "display"
    | "dns"
    | "install"
    | "cache"
    | "appinfo";

  async function getCurrentSettings() {
    try {
      const dns = await GlobalSettingsApi.getDnsSettings();
      const installation_settings = await GlobalSettingsApi.getInstallationSettings();
      const display = await GlobalSettingsApi.getGamehubSettings();


      setGlobalSettings({ dns, installation_settings, display });

    } catch (error: unknown) {
      await showError(error, "Error getting settings");
    }
  }

  onMount(async () => {
    getCurrentSettings();

    const download = await DownloadSettingsApi.getDownloadSettings();

    if (download.status === "ok") {
      setCacheSettings(download.data.cache)
    } else {
      showError("Error getting download settings");
    }
  });



  async function handleSaveGlobal(settings: GlobalSettings) {
    if (settings.dns) {
      await GlobalSettingsApi.setDnsSettings(settings.dns);
    }
    if (settings.installation_settings) {
      await GlobalSettingsApi.setInstallationSettings(settings.installation_settings);
    }
    if (settings.display) {
      await GlobalSettingsApi.setGamehubSettings(settings.display);
    }

    // DNS changes require a restart to take effect
    if (selectedPart() === "dns") {
      const shouldRestart = await confirm(
        "DNS settings require a restart to take effect.\nWould you like to restart FitLauncher now?",
        { title: "FitLauncher", kind: "info" }
      );
      if (shouldRestart) {
        await relaunch();
      }
    }
  }

  async function handleSaveCache(settings: CacheSettings) {
    if (settings.cache_size) {
      console.debug("New cache capacity is: ", settings.cache_size)
      const res = await commands.setCapacity(settings.cache_size);
      if (res.status === "error") {
        showError("Error setting cache size" + res.error)
      }
    }
  }

  async function handleOnSave() {
    const global = globalSettings();
    const cache = cacheSettings();
    if (!global || !cache) return console.warn("No settings to save");

    try {
      await handleSaveGlobal(global);

      await handleSaveCache(cache)

      await message("Settings saved successfully!", {
        title: "FitLauncher",
        kind: "info",
      });
    } catch (error: unknown) {
      await showError(error, "Error saving settings");
    }
  }

  function handleSwitchCheckChange(path: string) {
    setGlobalSettings(prev => {
      if (!prev) return prev;
      const newConfig = structuredClone(prev);
      const keys = path.split(".");
      let obj: any = newConfig;
      for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
      obj[keys[keys.length - 1]] = !obj[keys[keys.length - 1]];
      return newConfig;
    });
  }

  function handleTextCheckChange(path: string, newValue: any) {
    setGlobalSettings(prev => {
      if (!prev) return prev;
      const newConfig = structuredClone(prev);
      const keys = path.split(".");
      let obj: any = newConfig;
      for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
      obj[keys[keys.length - 1]] = newValue;
      return newConfig;
    });
  }

  function handleCacheChange(path: string, newValue: any) {
    setCacheSettings(prev => {
      if (!prev) return prev;
      const newConfig = structuredClone(prev);
      const keys = path.split(".");
      let obj: any = newConfig;
      for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
      obj[keys[keys.length - 1]] = newValue;
      return newConfig;
    });
  }


  async function handleResetSettings() {
    try {
      switch (selectedPart()) {
        case "display":
          await invoke("reset_gamehub_settings");
          await message("Display settings reset to default.", {
            title: "FitLauncher",
            kind: "info",
          });
          break;
        case "dns":
          await invoke("reset_dns_settings");
          await message("DNS settings reset to default.", {
            title: "FitLauncher",
            kind: "info",
          });
          break;
        case "install":
          await invoke("reset_installation_settings");
          await message("Installation settings reset to default.", {
            title: "FitLauncher",
            kind: "info",
          });
          break;
      }

      window.location.reload();
    } catch (error: unknown) {
      await showError(error, "Error resetting settings");
    }
  }

  return (
    <Show when={globalSettings() && cacheSettings} fallback={<LoadingPage />}>
      <div class="flex flex-col gap-6 h-full w-auto p-3 justify-between">
        {{
          display: (
            <DisplayPart
              settings={() => globalSettings()!.display}
              handleSwitchCheckChange={handleSwitchCheckChange}
            />
          ),
          dns: (
            <DNSPart
              settings={() => globalSettings()!.dns}
              handleSwitchCheckChange={handleSwitchCheckChange}
              handleTextCheckChange={handleTextCheckChange}
            />
          ),
          install: (
            <InstallSettingsPart
              settings={() => globalSettings()!.installation_settings}
              handleSwitchCheckChange={handleSwitchCheckChange}
            />
          ),
          cache: <CachePart settings={cacheSettings} handleTextCheckChange={handleCacheChange} />,
          appinfo: <AppInfoSettings />
        }[selectedPart()] || <p>Invalid or unsupported settings part.</p>}

        <div class="flex flex-row self-end gap-3 ">
          <Button onClick={handleResetSettings} label="Reset To Default" variant="bordered" />
          <Button onClick={handleOnSave} label="Save" variant="solid" />
        </div>
      </div>
    </Show>
  );
}

export default GlobalSettingsPage;
