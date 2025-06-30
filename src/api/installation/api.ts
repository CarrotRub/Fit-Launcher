import { commands, Result, TorrentApiError } from "../../bindings";
import { GlobalSettingsApi } from "../settings/api";

export class InstallationApi {
  private settingsInstance = new GlobalSettingsApi();

  async startInstallation(
    path: string
  ): Promise<Result<null, TorrentApiError>> {
    let installationSettings =
      await this.settingsInstance.getInstallationSettings();
    if (installationSettings.auto_install) {
      return await commands.runAutomateSetupInstall(path);
    } else {
      return { status: "ok", data: null };
    }
  }
}
