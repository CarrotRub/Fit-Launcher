import { createSignal } from "solid-js";
import type { JSX } from "solid-js";
import "../GlobalSettingsPage.css";
import { invoke } from "@tauri-apps/api/core";
import { confirm, message } from "@tauri-apps/plugin-dialog";
import { check } from "@tauri-apps/plugin-updater";
import { getVersion } from "@tauri-apps/api/app";

function CacheSettings(): JSX.Element {
  const [updateClicked, setUpdateClicked] = createSignal<boolean>(false);

  async function handleClearCache() {
    const confirmation = await confirm(
      "This will delete every cache file. This action cannot be reverted. Are you sure?",
      { title: "FitLauncher", kind: "warning" }
    );

    if (confirmation) {
      try {
        await invoke("clear_all_cache");
        await message("Cache cleared successfully!", {
          title: "FitLauncher",
          kind: "info",
        });
      } catch (error: unknown) {
        await message(String(error), {
          title: "FitLauncher",
          kind: "error",
        });
      }
    }
  }

  async function handleGoToLogs() {
    try {
      await invoke("open_logs_directory");
    } catch (error: unknown) {
      await message(String(error), {
        title: "FitLauncher",
        kind: "error",
      });
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
      await message("Checking for updates...", {
        title: "FitLauncher",
        kind: "info",
      });

      const update = await check();

      if (update) {
        console.log(
          `Found update ${update.version} from ${update.date} with notes:\n${update.body}`
        );

        const confirmUpdate = await confirm(
          `Update "${update.version}" was found. Do you want to download it?`,
          { title: "FitLauncher", kind: "info" }
        );

        if (confirmUpdate) {
          let downloaded = 0;
          let contentLength = 0;

          await update.downloadAndInstall((event) => {
            switch (event.event) {
              case "Started":
                contentLength = event.data.contentLength || 0;
                console.log(`Started downloading ${contentLength} bytes`);
                break;
              case "Progress":
                downloaded += event.data.chunkLength;
                console.log(`Downloaded ${downloaded} / ${contentLength}`);
                break;
              case "Finished":
                console.log("Download finished");
                break;
            }
          });

          await message("Update installed! Please close and reopen the app.", {
            title: "FitLauncher",
            kind: "info",
          });
        }
      } else {
        const currentVer = await getVersion();
        await message(`No update found. You are on the latest version: ${currentVer}`, {
          title: "FitLauncher",
          kind: "info",
        });
      }
    } catch (error: unknown) {
      console.error("Update check failed:", error);
      await message(`Error while checking for updates: ${String(error)}`, {
        title: "FitLauncher",
        kind: "error",
      });
    } finally {
      setUpdateClicked(false);
    }
  }

  return (
    <div class="global-page-group" id="global-display">
      <p class="global-page-group-title">Cache & Logs Settings</p>
      <ul class="global-page-group-list">
        <li>
          <span>
            Clear All Cache Files{" "}
            <small>
              <i>
                (This will remove image cache and all torrent-related cache, DHT, and session data.)
              </i>
            </small>
            :
          </span>
          <button class="clear-cache-settings-button" onClick={handleClearCache}>
            <span>Clear</span>
          </button>
        </li>
        <li>
          <span>
            Go To Logs{" "}
            <small>
              <i>
                (Please do not share this with anyone except FitLauncher's moderation team!)
              </i>
            </small>
            :
          </span>
          <button class="go-to-logs-settings-button" onClick={handleGoToLogs}>
            <span>Go!</span>
          </button>
        </li>
        <li>
          <span>Check for Updates:</span>
          <button class="go-to-logs-settings-button" onClick={handleCheckUpdate}>
            <span>Check!</span>
          </button>
        </li>
      </ul>
    </div>
  );
}

export default CacheSettings;
