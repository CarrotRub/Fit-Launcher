import { InstallationApi } from "../api/installation/api";
import { LibraryApi } from "../api/library/api";
import { DownloadJob, GlobalDownloadManager } from "../api/manager/api";
import { GlobalSettingsApi } from "../api/settings/api";

class Installer {
  private installationApi = new InstallationApi();
  private libraryApi = new LibraryApi();
  private settingsApi = new GlobalSettingsApi();
  private processing = new Set<string>();

  constructor() {
    GlobalDownloadManager.onCompleted((job) => this.handle(job));
  }

  async handle(job: DownloadJob) {
    if (this.processing.has(job.id)) return;
    this.processing.add(job.id);

    try {
      const settings = await this.settingsApi.getInstallationSettings();
      if (!settings.auto_install) return;

      await this.libraryApi.addDownloadedGame(job.game);

      // torrent or ddl-specific logic
      if (job.source === "torrent") {
        await this.installationApi.startInstallation(job.folderPath);
      } else {
        await this.installationApi.startExtractionDdl(job.targetPath);
        await this.installationApi.startInstallation(job.targetPath);
      }

      // cleanup job from disk/global manager/etc
      GlobalDownloadManager.remove(job.id);
    } catch (e) {
      console.error("Install failed", e);
    } finally {
      this.processing.delete(job.id);
    }
  }
}

export const installer = new Installer();
