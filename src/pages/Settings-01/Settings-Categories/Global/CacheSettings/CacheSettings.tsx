import { createSignal } from "solid-js";
import type { JSX } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { confirm, message } from "@tauri-apps/plugin-dialog";
import { getVersion } from "@tauri-apps/api/app";
import PageGroup from "../../Components/PageGroup";
import LabelButtonSettings from "../../Components/UI/LabelButton/LabelButton";
import { makePersisted } from "@solid-primitives/storage";
import { check } from "@tauri-apps/plugin-updater";

export default function CacheSettings(): JSX.Element {


  return (
    <PageGroup title="Cache & Logs Settings">
      <CacheContent />
    </PageGroup>
  );
}

function CacheContent() {
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

      <LabelButtonSettings text="Clear All Cache Files"
        typeText="This will remove image cache and all torrent-related cache, DHT, and session data"
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
    </>
  )
}