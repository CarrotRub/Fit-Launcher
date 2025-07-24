import { createSignal, onMount, Show } from "solid-js";
import type { JSX } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { message } from "@tauri-apps/plugin-dialog";
import CacheSettings from "./CacheSettings/CacheSettings";
import InstallSettingsPart from "./InstallSettings/InstallSettings";
import DNSPart from "./DNSSettings/DNSSettings";
import DisplayPart from "./DisplayPart/DisplayPart";

import type {
  FitLauncherDnsConfig,
  GamehubSettings,
  InstallationSettings
} from "../../../../bindings";
import { GlobalSettings, GlobalSettingsPart } from "../../../../types/settings/types";
import { GlobalSettingsApi } from "../../../../api/settings/api";
import LoadingPage from "../../../LoadingPage-01/LoadingPage";
import Button from "../../../../components/UI/Button/Button";
import AppInfoSettings from "./AppInfoSettings/AppInfo";

function GlobalSettingsPage(props: { settingsPart: GlobalSettingsPart }): JSX.Element {
  const [globalSettings, setGlobalSettings] = createSignal<GlobalSettings | null>(null);
  const settingsInst = new GlobalSettingsApi();

  const selectedPart = () =>
    (props.settingsPart.replace("global-", "") || "display") as
    | "display"
    | "dns"
    | "install"
    | "cache"
    | "appinfo";

  async function getCurrentSettings() {
    try {
      let glob_settings_inst = new GlobalSettingsApi();
      const dns = await glob_settings_inst.getDnsSettings();
      const installation_settings = await glob_settings_inst.getInstallationSettings();
      const display = await glob_settings_inst.getGamehubSettings();

      setGlobalSettings({ dns, installation_settings, display });
    } catch (error: unknown) {
      await message("Error getting settings: " + String(error), {
        title: "FitLauncher",
        kind: "error",
      });
    }
  }

  onMount(() => {
    getCurrentSettings();
  });



  async function handleOnSave() {
    const settings = globalSettings();
    if (!settings) return console.error("No settings to save");

    try {
      if (settings.dns) {
        await settingsInst.setDnsSettings(settings.dns);
      }
      if (settings.installation_settings) {
        await settingsInst.setInstallationSettings(settings.installation_settings);
      }
      if (settings.display) {
        await settingsInst.setGamehubSettings(settings.display);
      }

      await message("Settings saved successfully!", {
        title: "FitLauncher",
        kind: "info",
      });
    } catch (error: unknown) {
      await message("Error saving settings: " + String(error), {
        title: "FitLauncher",
        kind: "error",
      });
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
      await message("Error resetting settings: " + String(error), {
        title: "FitLauncher",
        kind: "error",
      });
    }
  }

  return (
    <Show when={globalSettings()} fallback={<LoadingPage />}>
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
          cache: <CacheSettings />,
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
