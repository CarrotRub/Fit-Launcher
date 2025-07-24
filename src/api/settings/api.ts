import {
  commands,
  FitLauncherConfigV2,
  FitLauncherDnsConfig,
  GamehubSettings,
  InstallationSettings,
  Result,
  SettingsConfigurationError,
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
  async setGamehubSettings(
    settings: GamehubSettings
  ): Promise<Result<null, SettingsConfigurationError>> {
    return await commands.changeGamehubSettings(settings);
  }
  async setDnsSettings(
    settings: FitLauncherDnsConfig
  ): Promise<Result<null, SettingsConfigurationError>> {
    return await commands.changeDnsSettings(settings);
  }
  async setInstallationSettings(
    settings: InstallationSettings
  ): Promise<Result<null, SettingsConfigurationError>> {
    return await commands.changeInstallationSettings(settings);
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
