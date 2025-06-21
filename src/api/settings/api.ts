import {
  commands,
  FitLauncherConfigV2,
  FitLauncherDnsConfig,
  GamehubSettings,
  InstallationSettings,
  Result,
  TorrentApiError,
} from "../../bindings";

export class GlobalSettingsApi {
  async getGamehubSettings(): Promise<GamehubSettings> {
    return await commands.getGamehubSettings();
  }
  async getDnsSettings(): Promise<FitLauncherDnsConfig> {
    return await commands.getDnsSettings();
  }
  async getInstallationSettings(): Promise<InstallationSettings> {
    return await commands.getInstallationSettings();
  }
}

export class DownloadSettingsApi {
  async getDownloadSettings(): Promise<
    Result<FitLauncherConfigV2, TorrentApiError>
  > {
    return await commands.getDownloadSettings();
  }
  async changeDownloadSettings(
    config: FitLauncherConfigV2
  ): Promise<Result<null, TorrentApiError>> {
    return await commands.changeDownloadSettings(config);
  }
}
