import { message } from "@tauri-apps/plugin-dialog";
import {
  commands,
  ExtractError,
  Result,
  TorrentApiError,
} from "../../bindings";
import { GlobalSettingsApi } from "../settings/api";

export class InstallationApi {
  async startInstallation(
    path: string
  ): Promise<Result<null, TorrentApiError>> {
    const installationSettings =
      await GlobalSettingsApi.getInstallationSettings();

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

  async startExtractionDdl(path: string): Promise<Result<null, ExtractError>> {
    const installationSettings =
      await GlobalSettingsApi.getInstallationSettings();

    if (installationSettings.auto_install) {
      const result = await commands.extractGame(path);

      if (result.status === "error") {
        const err = result.error;

        if (typeof err === "object" && "InstallationError" in err) {
          const installErr = err.InstallationError;

          if (installErr === "AdminModeError") {
            await message(
              "Installation requires administrator privileges.\nPlease restart FitLauncher as administrator.",
              {
                title: "Administrator Rights Required",
                kind: "error",
              }
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

      return result;
    }

    return { status: "ok", data: null };
  }
}
