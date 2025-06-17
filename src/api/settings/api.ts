import {
  commands,
  FitLauncherConfig,
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

export class TorrentSettingsApi {
  async getTorrentSettings(): Promise<
    Result<FitLauncherConfig, TorrentApiError>
  > {
    return await commands.getTorrentFullSettings();
  }
}
