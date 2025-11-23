import {
  commands,
  RealDebridSettings,
  Result,
  SettingsConfigurationError,
} from "../../bindings";

export class RealDebridSettingsApi {
  static async getRealDebridSettings(): Promise<RealDebridSettings> {
    return await commands.getRealdebridSettings();
  }

  static async setRealDebridSettings(
    settings: RealDebridSettings
  ): Promise<Result<null, SettingsConfigurationError>> {
    return await commands.changeRealdebridSettings(settings);
  }
}

