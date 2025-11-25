import { message } from "@tauri-apps/plugin-dialog";
import { GlobalSettingsApi } from "../settings/api";
import { commands, Job } from "../../bindings";
import { listen } from "@tauri-apps/api/event";

class InstallerService {
  private started = false;
  private installedGames = new Set<string>();

  start() {
    if (this.started) return;
    this.started = true;

    listen("download::job_completed", async (event) => {
      const job = event.payload as Job;
      if (!job.id || this.installedGames.has(job.id)) return;

      console.log("Installing game:", job.game.title);
      this.installedGames.add(job.id);
      await this.handle(job);
    });
  }

  async handle(job: Job) {
    const settings = await GlobalSettingsApi.getInstallationSettings();
    if (!settings.auto_install) return;

    const path = job.metadata.target_path;
    console.log("Starting installation for:", job.game.title);
    //todo: divide
    try {
      let result;
      if (job.source === "Torrent") {
        result = await commands.runAutomateSetupInstall(path);
        if (result.status === "error" && result.error === "AdminModeError") {
          await message(
            "Installation requires administrator privileges.\nPlease restart FitLauncher as administrator.",
            { title: "Administrator Rights Required", kind: "error" }
          );
        }
      } else {
        result = await commands.extractGame(path, job.game, settings.auto_clean);
        if (result.status === "error") {
          const err = result.error;
          if (typeof err === "object" && "InstallationError" in err) {
            const installErr = err.InstallationError;
            if (installErr === "AdminModeError") {
              await message(
                "Installation requires administrator privileges.\nPlease restart FitLauncher as administrator.",
                { title: "Administrator Rights Required", kind: "error" }
              );
            } else if (
              typeof installErr === "object" &&
              "IOError" in installErr
            ) {
              await message(
                `Installation failed due to an IO error:\n${installErr.IOError}`,
                {
                  title: "IO Error",
                  kind: "error",
                }
              );
            } else {
              await message("An unknown installation error occurred.", {
                title: "Installation Error",
                kind: "error",
              });
            }
          } else if (typeof err === "object" && "Io" in err) {
            await message(`A general IO error occurred:\n${err.Io}`, {
              title: "IO Error",
              kind: "error",
            });
          } else if (typeof err === "object" && "Unrar" in err) {
            await message(`Failed to extract archive:\n${err.Unrar}`, {
              title: "Extraction Error",
              kind: "error",
            });
          } else if (err === "NoParentDirectory") {
            await message(
              "Extraction failed because the parent directory doesn't exist.",
              {
                title: "Missing Directory",
                kind: "error",
              }
            );
          } else if (err === "NoRarFileFound") {
            await message("No RAR file found in the download directory.", {
              title: "Missing Archive File",
              kind: "error",
            });
          } else {
            await message("An unknown error occurred during extraction.", {
              title: "Unknown Error",
              kind: "error",
            });
          }
        }
      }

      if (result?.status === "ok") {
        console.log("Installation completed for:", job.game.title);
      }
    } catch (err) {
      console.error("INSTALL FAILED for", job.game?.title, err);
    }
  }
}

export const installerService = new InstallerService();
