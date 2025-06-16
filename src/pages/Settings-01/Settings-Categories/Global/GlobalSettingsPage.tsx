import { createSignal, onMount, Show } from "solid-js";
import type { JSX } from "solid-js";
import "./GlobalSettingsPage.css";
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
import { GlobalSettings, GlobalSettingsPart, SettingsPart } from "../../../../types/settings/types";


function GlobalSettingsPage(props: { settingsPart: GlobalSettingsPart }): JSX.Element {
  const [globalSettings, setGlobalSettings] = createSignal<GlobalSettings | null>(null);
  const selectedPart = () =>
    (props.settingsPart.replace("global-", "") || "display") as
      | "display"
      | "dns"
      | "install"
      | "cache";

  async function getCurrentSettings() {
    try {
      const dns = await invoke<FitLauncherDnsConfig>("get_dns_settings");
      const installation_settings = await invoke<InstallationSettings>("get_installation_settings");
      const display = await invoke<GamehubSettings>("get_gamehub_settings");

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
        await invoke("change_dns_settings", { settings: settings.dns });
      }
      if (settings.installation_settings) {
        await invoke("change_installation_settings", { settings: settings.installation_settings });
      }
      if (settings.display) {
        await invoke("change_gamehub_settings", { settings: settings.display });
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

      // Re-fetch settings (optional: replace with better reactivity if needed)
      window.location.reload();
    } catch (error: unknown) {
      await message("Error resetting settings: " + String(error), {
        title: "FitLauncher",
        kind: "error",
      });
    }
  }

  return (
    <Show when={globalSettings()} fallback={<p>Loading...</p>}>
      <div class="torrenting-page">
        {{
          display: (
            <DisplayPart
              settings={globalSettings()!.display}
              handleSwitchCheckChange={handleSwitchCheckChange}
            />
          ),
          dns: (
            <DNSPart
              settings={globalSettings()!.dns}
              handleSwitchCheckChange={handleSwitchCheckChange}
              handleTextCheckChange={handleTextCheckChange}
            />
          ),
          install: (
            <InstallSettingsPart
              settings={globalSettings()!.installation_settings}
              handleSwitchCheckChange={handleSwitchCheckChange}
            />
          ),
          cache: <CacheSettings />,
        }[selectedPart()] || <p>Invalid or unsupported settings part.</p>}

        <div class="global-settings-buttons-container">
          <button class="reset-settings-button" onClick={handleResetSettings}>
            <span>Reset To Default</span>
          </button>
          <button class="save-settings-button" onClick={handleOnSave}>
            <span>Save</span>
          </button>
        </div>
      </div>
    </Show>
  );
}

export default GlobalSettingsPage;
