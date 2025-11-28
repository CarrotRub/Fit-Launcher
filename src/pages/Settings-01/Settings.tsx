import { createSignal, onMount, type JSX } from "solid-js";
import DownloadConfigurationPage from "./Settings-Categories/Download/Download";
import GlobalSettingsPage from "./Settings-Categories/Global/GlobalSettingsPage";

import {
  Settings,
  Globe,
  Package2,
  Database,
  Network,
  Server,
  Save,
  Users,
  Gauge,
  Magnet,
  Cpu,
  Monitor,
  HardDriveDownload,
  Archive,
  Info,
  Zap
} from "lucide-solid";

import type {
  SettingsPart,
  GlobalSettingsPart,
  SettingsGroup,
  DownloadSettingsPart
} from "../../types/settings/types";
import { SettingsProvider, useSettingsContext } from "./SettingsContext";

function SettingsFull(): JSX.Element {
  return (
    <SettingsProvider>
      <div class="grid grid-cols-[20rem_1fr] h-screen w-screen bg-background">
        <SettingsSidebar />
        <div class="col-start-2 overflow-y-auto  bg-background-70">
          <SettingsContent />
        </div>
      </div>
    </SettingsProvider>
  );
}

function SettingsContent(): JSX.Element {
  const { activeCategory, activeGroup } = useSettingsContext();

  const contentMap: Record<SettingsGroup, () => JSX.Element> = {
    global: () => <GlobalSettingsPage settingsPart={activeCategory() as GlobalSettingsPart} />,
    torrent: () => <DownloadConfigurationPage settingsPart={activeCategory() as DownloadSettingsPart} />
  };

  return (
    <div class="bg-popup-background border-l border-secondary-20 p-6 min-h-full shadow-lg">
      {contentMap[activeGroup()]?.() ?? <p class="text-text">Invalid group</p>}
    </div>
  );
}

function SettingsSidebar(): JSX.Element {
  const { setActiveCategory, setActiveGroup } = useSettingsContext();

  onMount(() => {
    handleActivateElem("settings-display", "global-display");
  });

  function changeAllToDefault() {
    document.querySelectorAll(".settings-link").forEach(elem => {
      elem.classList.remove("bg-secondary-30", "text-text", "border-l-accent");
      elem.classList.add("text-muted", "hover:bg-secondary-20");
    });
  }

  function handleActivateElem(elemID: string, category: SettingsPart) {
    changeAllToDefault();

    const selectedElem = document.getElementById(elemID);
    if (selectedElem) {
      selectedElem.classList.remove("text-muted", "hover:bg-secondary-20");
      selectedElem.classList.add("bg-secondary-30", "text-text", "border-l-accent");
    }

    if (category.startsWith("global")) {
      setActiveGroup("global");
    } else {
      setActiveGroup("torrent");
    }

    setActiveCategory(category);
  }

  return (
    <div class="bg-popup-background border-r border-secondary-20 h-full w-fit flex flex-col overflow-y-auto">
      <div class="p-4 border-b border-secondary-20">
        <h1 class="text-2xl font-bold text-text">Settings</h1>
        <p class="text-sm text-muted mt-1">Configure your application preferences</p>
      </div>

      <div class="flex flex-col gap-1 pr-2 py-4">
        <div class="mb-4">
          <h2 class="text-xs font-semibold uppercase tracking-wider text-muted px-4 py-2">Global Configuration</h2>
          <ul class="space-y-1">
            <SidebarLink id="settings-display" label="App Settings" icon={Monitor} onClick={() => handleActivateElem("settings-display", "global-display")} />
            <SidebarLink id="settings-dns" label="DNS Settings" icon={Network} onClick={() => handleActivateElem("settings-dns", "global-dns")} />
            <SidebarLink id="settings-install" label="Install Settings" icon={HardDriveDownload} onClick={() => handleActivateElem("settings-install", "global-install")} />
            <SidebarLink id="settings-cache" label="Cache & Logs" icon={Archive} onClick={() => handleActivateElem("settings-cache", "global-cache")} />
            <SidebarLink id="settings-appinfo" label="App Info" icon={Info} onClick={() => handleActivateElem("settings-appinfo", "global-appinfo")} />
          </ul>
        </div>

        <div class="mb-4">
          <h2 class="text-xs font-semibold uppercase tracking-wider text-muted px-4 py-2">Download Configuration</h2>
          <ul class="space-y-1">
            <SidebarLink id="settings-general" label="General" icon={Settings} onClick={() => handleActivateElem("settings-general", "general")} />
            <SidebarLink id="settings-limits" label="Transfer Limits" icon={Gauge} onClick={() => handleActivateElem("settings-limits", "limits")} />
            <SidebarLink id="settings-network" label="Network" icon={Globe} onClick={() => handleActivateElem("settings-network", "network")} />
            <SidebarLink id="settings-bittorrent" label="Bittorrent" icon={Magnet} onClick={() => handleActivateElem("settings-bittorrent", "bittorrent")} />
            <SidebarLink id="settings-debrid" label="Debrid Services" icon={Zap} onClick={() => handleActivateElem("settings-debrid", "debrid")} />
            <SidebarLink id="settings-rpc" label="Aria2 RPC" icon={Cpu} onClick={() => handleActivateElem("settings-rpc", "rpc")} />
          </ul>
        </div>

      </div>
    </div>
  );
}

function SidebarLink(props: { id: string; label: string; icon: (props: any) => JSX.Element; onClick: () => void }) {
  const Icon = props.icon;
  return (
    <li>
      <a
        id={props.id}
        onClick={props.onClick}
        class="settings-link flex items-center gap-3 px-4 py-2.5 rounded-r-sm text-muted transition-colors duration-200 hover:bg-secondary-20 border-l-2 border-l-transparent"
      >
        <Icon size={18} class="opacity-80" />
        <span class="text-sm font-medium">{props.label}</span>
      </a>
    </li>
  );
}

export default SettingsFull;