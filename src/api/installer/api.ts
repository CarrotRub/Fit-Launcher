import { message } from "@tauri-apps/plugin-dialog";
import { GlobalSettingsApi } from "../settings/api";
import { commands, Job } from "../../bindings";
import { listen } from "@tauri-apps/api/event";

class InstallerService {
  private started = false;
  private installedGames = new Set<string>();

  // setupId -> jobId
  private jobSetupMap = new Map<string, string>();

  private progressCallbacks: Map<string, (percentage: number) => void> =
    new Map();

  findSetupIdByJobId(jobId: string): string | undefined {
    for (const [setupId, jId] of this.jobSetupMap.entries()) {
      if (jId === jobId) return setupId;
    }
    return undefined;
  }

  start() {
    if (this.started) return;
    this.started = true;

    listen("download::job_completed", async (event) => {
      const job = event.payload as Job;
      if (
        !job.id ||
        this.installedGames.has(job.id) ||
        job.status!.total_length <= 0 ||
        job.status!.completed_length <= 0
      )
        return;

      console.log("Installing game:", job.game.title);
      this.installedGames.add(job.id);
      await this.handle(job);
    });

    listen("setup::progress::updated", (event) => {
      const payload = event.payload as { id: string; percentage: number };
      this.progressCallbacks.get(payload.id)?.(payload.percentage);
    });

    listen("setup::progress::finished", async (event) => {
      const payload = event.payload as { id: string; percentage: number };

      console.log(`Installation finished for ${payload.id}`);
      this.progressCallbacks.delete(payload.id);

      // Cleanup: setupId -> jobId
      const jobId = this.jobSetupMap.get(payload.id);
      if (jobId) {
        await commands.dmCleanJob(jobId, payload.id);
        this.jobSetupMap.delete(payload.id);
      }
    });

    listen("setup::progress::cancelled", (event) => {
      const payload = event.payload as { id: string; percentage: number };
      console.warn(
        `Installation cancelled for ${payload.id} at ${payload.percentage}%`
      );

      this.progressCallbacks.delete(payload.id);
    });
  }

  onProgress(jobId: string, callback: (percentage: number) => void) {
    this.progressCallbacks.set(jobId, callback);
  }

  async handle(job: Job) {
    const settings = await GlobalSettingsApi.getInstallationSettings();
    if (!settings.auto_install) return;

    try {
      let result;

      if (job.source === "Torrent") {
        result = await commands.dmRunAutomateSetupInstall(job);
        console.log("Starting installation for:", job.game.title);

        if (result.status === "error" && result.error === "AdminModeError") {
          await message(
            "Installation requires administrator privileges.\nPlease restart FitLauncher as administrator.",
            { title: "Administrator Rights Required", kind: "error" }
          );
        }

        if (result.status === "ok") {
          // result.data = setupId
          this.jobSetupMap.set(result.data, job.id);
        }
      } else {
        result = await commands.dmExtractAndInstall(job, settings.auto_clean);

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
                { title: "IO Error", kind: "error" }
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
              { title: "Missing Directory", kind: "error" }
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
        } else {
          // result.data = setupId
          this.jobSetupMap.set(result.data, job.id);
        }
      }

      this.onProgress(job.id, (percent) => {
        console.log(`Job ${job.id} progress: ${percent.toFixed(2)}%`);
      });

      if (result?.status === "ok") {
        console.log("Installation completed for:", job.game.title);
        if (settings.auto_clean) {
          const setupId = this.findSetupIdByJobId(job.id);

          if (setupId) {
            await commands.dmRemove(job.id);
            await commands.dmCleanJob(job.id, setupId);
            this.jobSetupMap.delete(setupId);
          }
        }
      }
    } catch (err) {
      console.error("INSTALL FAILED for", job.game?.title, err);
    }
  }
}

export const installerService = new InstallerService();
