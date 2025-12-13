import { createSignal, onMount, Show } from "solid-js";
import type { JSX } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { confirm } from "@tauri-apps/plugin-dialog";
import { relaunch } from "@tauri-apps/plugin-process";
import CacheSettings from "./CacheSettings/CacheSettings";
import { showError } from "../../../../helpers/error";
import InstallSettingsPart from "./InstallSettings/InstallSettings";
import DNSPart from "./DNSSettings/DNSSettings";
import DisplayPart from "./DisplayPart/DisplayPart"
import { GlobalSettings, GlobalSettingsPart } from "../../../../types/settings/types";
import { GlobalSettingsApi } from "../../../../api/settings/api";
import LoadingPage from "../../../LoadingPage-01/LoadingPage";
import Button from "../../../../components/UI/Button/Button";
import AppInfoSettings from "./AppInfoSettings/AppInfo";

function GlobalSettingsPage(props: { settingsPart: GlobalSettingsPart }): JSX.Element {
  const [globalSettings, setGlobalSettings] = createSignal<GlobalSettings | null>(null);
  const [saveLabel, setSaveLabel] = createSignal("Save");
  const [dirtyPaths, setDirtyPaths] = createSignal<Set<string>>(new Set());
  const [pulsePaths, setPulsePaths] = createSignal<Set<string>>(new Set());


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
      setDirtyPaths(new Set<string>()); // Clear dirty tracking on load
    } catch (error: unknown) {
      await showError(error, "Error getting settings");
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
        await GlobalSettingsApi.setDnsSettings(settings.dns);
      }
      if (settings.installation_settings) {
        await GlobalSettingsApi.setInstallationSettings(settings.installation_settings);
      }
      if (settings.display) {
        await GlobalSettingsApi.setGamehubSettings(settings.display);
      }

      setSaveLabel("Saved");
      // Trigger pulse animation on dirty fields
      setPulsePaths(new Set<string>(dirtyPaths()));
      setTimeout(() => {
        setSaveLabel("Save");
        setPulsePaths(new Set<string>());
        setDirtyPaths(new Set<string>()); // Clear dirty after animation
      }, 1000);

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
    } catch (error: unknown) {
      await showError(error, "Error saving settings");
    }
  }

  function handleSwitchCheckChange(path: string) {
    setDirtyPaths(prev => new Set([...prev, path]));
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
    setDirtyPaths(prev => new Set([...prev, path]));
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

  // Get all paths for current section to pulse on reset
  function getPathsForSection(section: string): string[] {
    switch (section) {
      case "dns":
        return ["dns.system_conf", "dns.primary", "dns.secondary"];
      case "display":
        return ["display.show_nsfw", "display.show_overview"];
      case "install":
        return ["installation_settings.auto_install", "installation_settings.close_launcher_on_game_launch"];
      default:
        return [];
    }
  }

  async function handleResetSettings() {
    try {
      switch (selectedPart()) {
        case "display":
          await invoke("reset_gamehub_settings");
          break;
        case "dns":
          await invoke("reset_dns_settings");
          break;
        case "install":
          await invoke("reset_installation_settings");
          break;
      }

      // Re-fetch settings to update UI
      await getCurrentSettings();

      // Trigger pulse on all fields in this section
      const paths = getPathsForSection(selectedPart());
      setPulsePaths(new Set<string>(paths));
      setTimeout(() => {
        setPulsePaths(new Set<string>());
      }, 1000);
    } catch (error: unknown) {
      await showError(error, "Error resetting settings");
    }
  }

  // Helpers for field-level state
  const isDirty = (path: string) => dirtyPaths().has(path);
  const savePulse = (path: string) => pulsePaths().has(path);

  return (
    <Show when={globalSettings()} fallback={<LoadingPage />}>
      <div class="flex flex-col gap-6 h-full w-auto p-3 justify-between">
        {{
          display: (
            <DisplayPart
              settings={() => globalSettings()!.display}
              handleSwitchCheckChange={handleSwitchCheckChange}
              isDirty={isDirty}
              savePulse={savePulse}
            />
          ),
          dns: (
            <DNSPart
              settings={() => globalSettings()!.dns}
              handleSwitchCheckChange={handleSwitchCheckChange}
              handleTextCheckChange={handleTextCheckChange}
              isDirty={isDirty}
              savePulse={savePulse}
            />
          ),
          install: (
            <InstallSettingsPart
              settings={() => globalSettings()!.installation_settings}
              handleSwitchCheckChange={handleSwitchCheckChange}
              isDirty={isDirty}
              savePulse={savePulse}
            />
          ),
          cache: <CacheSettings />,
          appinfo: <AppInfoSettings />
        }[selectedPart()] || <p>Invalid or unsupported settings part.</p>}

        <div class="flex flex-row self-end gap-3 ">
          <Button onClick={handleResetSettings} label="Reset To Default" variant="bordered" />
          <Button onClick={handleOnSave} label={saveLabel()} variant="solid" />
        </div>
      </div>
    </Show>
  );
}

export default GlobalSettingsPage;
