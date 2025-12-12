import { createSignal } from "solid-js";
import type { JSX } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { confirm, message } from "@tauri-apps/plugin-dialog";
import PageGroup from "../../Components/PageGroup";
import LabelButtonSettings from "../../Components/UI/LabelButton/LabelButton";
import { check } from "@tauri-apps/plugin-updater";
import { showError } from "../../../../../helpers/error";
import LabelNumericalInput from "../../Components/UI/LabelNumericalInput/LabelNumericalInput";
import { CacheSettings, General } from "../../../../../bindings";
import { SettingsSectionProps } from "../../../../../types/settings/types";

export default function CachePart({ settings, handleTextCheckChange }: SettingsSectionProps<CacheSettings | null>): JSX.Element {


  return (
    <PageGroup title="Cache & Logs Settings">
      <CacheContent settings={settings} handleTextCheckChange={handleTextCheckChange} />
    </PageGroup>
  );
}

function CacheContent({ settings, handleTextCheckChange }: SettingsSectionProps<CacheSettings | null>) {
  const [updateClicked, setUpdateClicked] = createSignal<boolean>(false);

  async function handleClearCache() {
    const confirmation = await confirm(
      "This will reset game details and torrent session data. Search will still work. Are you sure?",
      { title: "FitLauncher", kind: "warning" }
    );

    if (confirmation) {
      try {
        // Clear torrent session and DHT data
        await invoke("clear_all_cache");
        // Clear scraped game data (keeps sitemap stubs for search)
        await invoke("clear_game_cache");
        await message("Cache cleared! Game details will be re-fetched when visited.", {
          title: "FitLauncher",
          kind: "info",
        });
      } catch (error: unknown) {
        await showError(error);
      }
    }
  }

  async function handleGoToLogs() {
    try {
      await invoke("open_logs_directory");
    } catch (error: unknown) {
      await showError(error);
    }
  }

  async function handleCheckUpdate() {
    if (updateClicked()) {
      await message("Can you please wait? That's quite not nice :(", {
        title: "FitLauncher",
        kind: "warning",
      });
      return;
    }

    setUpdateClicked(true);

    try {
      const update = await check();
      console.log("update : ", update);
      if (!update) {
        await message(`No update found. You are on the latest version!`, {
          title: "FitLauncher",
          kind: "info",
        });
        return;
      }

      const wantsUpdate = await confirm(
        `Update "${update.version}" is available.\nDo you want to download and install it?`,
        { title: "FitLauncher", kind: "info" }
      );

      if (!wantsUpdate) return;

      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case "Started":
            console.log("Started downloading");
            break;
          case "Progress":
            console.log(`Progress: ${event.data.chunkLength} bytes`);
            break;
          case "Finished":
            console.log("Download finished");
            break;
        }
      });

      await message("Update installed! Please restart the app.", {
        title: "FitLauncher",
        kind: "info",
      });
    } catch (err) {
      console.error("check() failed:", err);
    } finally {
      setUpdateClicked(false);
    }

  }

  return (
    <>
      <LabelButtonSettings text="Check for Updates"
        typeText="This might take some time so please be patient !"
        action={handleCheckUpdate}
        buttonLabel="Check!"
        disabled={updateClicked()}
      />

      <LabelButtonSettings text="Clear Cache"
        typeText="Clears game details and torrent data. Search index stays intact."
        action={handleClearCache}
        buttonLabel="Clear"
        disabled={false}
      />

      <LabelButtonSettings text="Go To Logs"
        typeText="Please do not share this with anyone except FitLauncher's moderation team!"
        action={handleGoToLogs}
        buttonLabel="Go!"
        disabled={false}
      />

      <LabelNumericalInput
        text="Cache Size"
        typeText="Max image cache size, in bytes"
        value={settings()?.cache_size ?? 0}
        onInput={(e) => handleTextCheckChange?.("cache_size", e)}
        defaultUnitType="MB"
        unit
      />
    </>
  )
}