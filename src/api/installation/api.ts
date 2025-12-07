import { message } from "@tauri-apps/plugin-dialog";
import {
  commands,
  ExtractError,
  Job,
  Result,
  TorrentApiError,
} from "../../bindings";
import { GlobalSettingsApi } from "../settings/api";
import { handleInstallerError } from "../../helpers/installer-error";

export class InstallationApi {
  async startInstallation(job: Job): Promise<Result<string, TorrentApiError>> {
    const installationSettings =
      await GlobalSettingsApi.getInstallationSettings();

    if (installationSettings.auto_install) {
      const result = await commands.dmRunAutomateSetupInstall(job);

      if (result.status === "error") {
        await handleInstallerError(result.error);
      }

      return result;
    }

    return { status: "ok", data: "" };
  }

  async startExtractionDdl(job: Job): Promise<Result<string, ExtractError>> {
    const installationSettings =
      await GlobalSettingsApi.getInstallationSettings();

    if (installationSettings.auto_install) {
      const result = await commands.dmExtractAndInstall(
        job,
        installationSettings.auto_clean
      );

      if (result.status === "error") {
        await handleInstallerError(result.error);
      }

      return result;
    }

    return { status: "ok", data: "" };
  }
}
