import { message } from "@tauri-apps/plugin-dialog";
import { GlobalSettingsApi } from "../settings/api";
import { commands, Job } from "../../bindings";
import { listen, emit } from "@tauri-apps/api/event";
import { LibraryApi } from "../library/api";

/**
 * Event-driven installer service using WinEvents hooks.
 * Flow: setup::hook::started -> setup::hook::stopped (success: true/false)
 */
class InstallerService {
  private started = false;
  private installedGames = new Set<string>();
  private activeInstalls = new Map<string, Job>();
  private pendingJobs = new Map<string, Job>();
  private failedInstalls = new Set<string>();
  private installingJobs = new Set<string>();

  start() {
    if (this.started) return;
    this.started = true;

    listen("setup::hook::started", (event) => {
      const payload = event.payload as { id: string; success: boolean };

      for (const [jobId, job] of this.pendingJobs.entries()) {
        this.activeInstalls.set(payload.id, job);
        this.installingJobs.add(job.id);
        this.pendingJobs.delete(jobId);
        console.log(`[Installer] Hook started: ${job.game.title}`);
        emit("installer::state::changed", { jobId: job.id, state: "installing" });
        break;
      }
    });

    listen("download::job_completed", async (event) => {
      const job = event.payload as Job;
      if (
        !job.id ||
        this.installedGames.has(job.id) ||
        job.status!.total_length <= 0 ||
        job.status!.completed_length <= 0
      )
        return;

      this.installedGames.add(job.id);
      await this.handle(job);
    });

    listen("setup::hook::stopped", async (event) => {
      const payload = event.payload as { id: string; success: boolean; install_path?: string };

      const job = this.activeInstalls.get(payload.id);
      if (!job) return;

      console.log(`[Installer] Hook stopped: ${job.game.title}, success=${payload.success}`);
      this.installingJobs.delete(job.id);

      if (payload.success) {
        try {
          console.log("[Installer] Processing successful installation:", job.game.title);

          const settings = await GlobalSettingsApi.getInstallationSettings();
          const lib_api = new LibraryApi();
          const dwlnd_game = lib_api.gameToDownloadedGame(job.game);

          if (payload.install_path) {
            try {
              const exePath = await commands.findGameExecutable(payload.install_path);
              if (exePath) {
                const execInfo = await commands.executableInfoDiscovery(exePath, payload.install_path);
                if (execInfo) {
                  dwlnd_game.executable_info = execInfo;
                  dwlnd_game.installation_info = {
                    output_folder: payload.install_path,
                    download_folder: job.job_path,
                    file_list: [],
                  };
                }
              }
            } catch (err) {
              console.error("[Installer] Error finding game executable:", err);
            }
          }

          await lib_api.addDownloadedGame(dwlnd_game);

          if (settings.auto_clean) {
            await commands.dmRemove(job.id);
          }
          await commands.dmCleanJob(job.id, payload.id);

          console.log("[Installer] Complete:", job.game.title);
          emit("installer::state::changed", { jobId: job.id, state: "success" });
        } catch (err) {
          console.error("[Installer] Error in success handler:", err);
        }
      } else {
        this.failedInstalls.add(job.id);
        emit("installer::state::changed", { jobId: job.id, state: "failed" });
      }

      this.activeInstalls.delete(payload.id);
    });
  }

  async handle(job: Job) {
    const settings = await GlobalSettingsApi.getInstallationSettings();
    if (!settings.auto_install) return;

    this.pendingJobs.set(job.id, job);

    try {
      let result;

      if (job.source === "Torrent") {
        result = await commands.dmRunAutomateSetupInstall(job);

        if (result.status === "error") {
          this.pendingJobs.delete(job.id);
          if (result.error === "AdminModeError") {
            await message(
              "Installation requires administrator privileges.\nPlease restart FitLauncher as administrator.",
              { title: "Administrator Rights Required", kind: "error" }
            );
          }
          return;
        }
      } else {
        result = await commands.dmExtractAndInstall(job, settings.auto_clean);

        if (result.status === "error") {
          this.pendingJobs.delete(job.id);
          await this.handleExtractError(result.error);
          return;
        }
      }
    } catch (err) {
      this.pendingJobs.delete(job.id);
    }
  }

  private async handleExtractError(err: unknown) {
    if (typeof err === "object" && err !== null) {
      if ("InstallationError" in err) {
        const installErr = (err as { InstallationError: unknown }).InstallationError;
        if (installErr === "AdminModeError") {
          await message(
            "Installation requires administrator privileges.\nPlease restart FitLauncher as administrator.",
            { title: "Administrator Rights Required", kind: "error" }
          );
        } else if (typeof installErr === "object" && installErr !== null && "IOError" in installErr) {
          await message(
            `Installation failed due to an IO error:\n${(installErr as { IOError: string }).IOError}`,
            { title: "IO Error", kind: "error" }
          );
        } else {
          await message("An unknown installation error occurred.", {
            title: "Installation Error",
            kind: "error",
          });
        }
      } else if ("Io" in err) {
        await message(`A general IO error occurred:\n${(err as { Io: string }).Io}`, {
          title: "IO Error",
          kind: "error",
        });
      } else if ("Unrar" in err) {
        await message(`Failed to extract archive:\n${(err as { Unrar: string }).Unrar}`, {
          title: "Extraction Error",
          kind: "error",
        });
      }
    } else if (err === "NoParentDirectory") {
      await message(
        "Extraction failed because the parent directory doesn't exist.",
        { title: "Missing Directory", kind: "error" }
      );
    } else if (err === "NoRarFileFound") {
      await message("No RAR file found in the download directory.", {
        title: "Missing Archive File",
        kind: "error"
      }
      );
    } else {
      await message("An unknown error occurred during extraction.", {
        title: "Unknown Error",
        kind: "error",
      });
    }
  }

  isInstallFailed(jobId: string): boolean {
    return this.failedInstalls.has(jobId);
  }

  isInstalling(jobId: string): boolean {
    return this.installingJobs.has(jobId);
  }

  clearFailedState(jobId: string): void {
    this.failedInstalls.delete(jobId);
    emit("installer::state::changed", { jobId, state: "cleared" });
  }

  async retryInstall(job: Job): Promise<void> {
    this.clearFailedState(job.id);
    this.installedGames.delete(job.id);
    await this.handle(job);
  }
}

export const installerService = new InstallerService();
