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
  static async getGamehubSettings(): Promise<GamehubSettings> {
    return await commands.getGamehubSettings();
  }

  static async getDnsSettings(): Promise<FitLauncherDnsConfig> {
    return await commands.getDnsSettings();
  }

  static async getInstallationSettings(): Promise<InstallationSettings> {
    return await commands.getInstallationSettings();
  }

  static async setGamehubSettings(
    settings: GamehubSettings
  ): Promise<Result<null, SettingsConfigurationError>> {
    return await commands.changeGamehubSettings(settings);
  }

  static async setDnsSettings(
    settings: FitLauncherDnsConfig
  ): Promise<Result<null, SettingsConfigurationError>> {
    return await commands.changeDnsSettings(settings);
  }

  static async setInstallationSettings(
    settings: InstallationSettings
  ): Promise<Result<null, SettingsConfigurationError>> {
    return await commands.changeInstallationSettings(settings);
  }
}

export class DownloadSettingsApi {
  static async getDownloadSettings(): Promise<
    Result<FitLauncherConfigV2, TorrentApiError>
  > {
    return await commands.getDownloadSettings();
  }

  static async changeDownloadSettings(
    config: FitLauncherConfigV2
  ): Promise<Result<null, TorrentApiError>> {
    return await commands.changeDownloadSettings(config);
  }
}
