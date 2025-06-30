import { message } from "@tauri-apps/plugin-dialog";
import { commands, Result, TorrentApiError } from "../../bindings";
import { GlobalSettingsApi } from "../settings/api";

export class InstallationApi {
  private settingsInstance = new GlobalSettingsApi();

  async startInstallation(
    path: string
  ): Promise<Result<null, TorrentApiError>> {
    const installationSettings =
      await this.settingsInstance.getInstallationSettings();

    if (installationSettings.auto_install) {
      const result = await commands.runAutomateSetupInstall(path);

      if (result.status === "error") {
        const err = result.error;
        if (err === "AdminModeError") {
          await message(
            "Installation requires administrator privileges.\nPlease restart FitLauncher as administrator.",
            {
              title: "Administrator Rights Required",
              kind: "error",
            }
          );
        }
      }

      return result;
    }

    return { status: "ok", data: null };
  }
}
