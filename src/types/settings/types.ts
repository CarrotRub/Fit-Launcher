import { Accessor, Setter } from "solid-js";
import {
  FitLauncherConfig,
  FitLauncherConfigDht,
  FitLauncherConfigPeerOpts,
  FitLauncherConfigPersistence,
  FitLauncherConfigTcpListen,
  FitLauncherDnsConfig,
  GamehubSettings,
  InstallationSettings,
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

export type TorrentSettings = Pick<
  FitLauncherConfig,
  "dht" | "tcp_listen" | "persistence" | "peer_opts"
> & {
  dht: FitLauncherConfigDht;
  tcp_listen: FitLauncherConfigTcpListen;
  persistence: FitLauncherConfigPersistence;
  peer_opts: FitLauncherConfigPeerOpts;
};

export type GlobalSettingsPart =
  | "global-display"
  | "global-dns"
  | "global-install"
  | "global-cache";

export type TorrentSettingsPart = "dht" | "tcp" | "persistence" | "peer-opts";

export type SettingsPart = GlobalSettingsPart | TorrentSettingsPart;

export type SettingsGroup = "global" | "torrent";
export type SettingsContextType = {
  activeCategory: Accessor<SettingsPart>;
  setActiveCategory: Setter<SettingsPart>;
  activeGroup: Accessor<SettingsGroup>;
  setActiveGroup: Setter<SettingsGroup>;
};

export type SettingsTypes =
  | GlobalSettings[keyof GlobalSettings]
  | TorrentSettings[keyof TorrentSettings];
