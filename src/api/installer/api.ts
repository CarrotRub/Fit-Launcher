import { listen } from "@tauri-apps/api/event";
import { commands } from "../../bindings";
import { DownloadJob } from "../manager/api";
import { GlobalSettingsApi } from "../settings/api";

class InstallerService {
  private started = false;

  start() {
    if (this.started) return;
    this.started = true;

    listen("download::completed", async (event) => {
      const job = event.payload as DownloadJob;
      this.handle(job);
    });
  }

  async handle(job: DownloadJob) {
    let settings = await GlobalSettingsApi.getInstallationSettings();
    if (!settings.auto_install) return;

    try {
      await commands.runAutomateSetupInstall(job.id);
    } catch (err) {
      console.error("INSTALL FAILED", err);
    }
  }
}

export const installerService = new InstallerService();
