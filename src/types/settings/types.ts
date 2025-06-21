import { Accessor, Setter } from "solid-js";
import {
  Bittorrent,
  Connection,
  FitLauncherConfigAria2,
  FitLauncherConfigV2,
  FitLauncherDnsConfig,
  GamehubSettings,
  General,
  InstallationSettings,
  TransferLimits,
} from "../../bindings";

export type SettingsHandlers = {
  handleSwitchCheckChange?: (key: string) => void | Promise<void>;
  handleTextCheckChange?: (...args: any[]) => void | Promise<void>;
};

export type SettingsSectionProps<T> = SettingsHandlers & {
  settings: Accessor<T>;
};

export type GlobalSettings = {
  dns: FitLauncherDnsConfig;
  installation_settings: InstallationSettings;
  display: GamehubSettings;
};

export type DownloadSettings = Pick<
  FitLauncherConfigV2,
  "general" | "limits" | "network" | "bittorrent" | "rpc"
> & {
  general: General;
  limits: TransferLimits;
  network: Connection;
  bittorrent: Bittorrent;
  rpc: FitLauncherConfigAria2;
};

export type GlobalSettingsPart =
  | "global-display"
  | "global-dns"
  | "global-install"
  | "global-cache";

export type DownloadSettingsPart =
  | "general"
  | "limits"
  | "network"
  | "bittorrent"
  | "rpc";

export type SettingsPart = GlobalSettingsPart | DownloadSettingsPart;

export type SettingsGroup = "global" | "torrent";
export type SettingsContextType = {
  activeCategory: Accessor<SettingsPart>;
  setActiveCategory: Setter<SettingsPart>;
  activeGroup: Accessor<SettingsGroup>;
  setActiveGroup: Setter<SettingsGroup>;
};

export type SettingsTypes =
  | GlobalSettings[keyof GlobalSettings]
  | DownloadSettings[keyof DownloadSettings];
