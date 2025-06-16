import { createSignal, onMount, type JSX } from "solid-js";
import TorrentingPage from "./Settings-Categories/Torrenting/Torrenting";
import GlobalSettingsPage from "./Settings-Categories/Global/GlobalSettingsPage";

import {
  Settings,
  Globe,
  Package2,
  Database,
  Network,
  Server,
  Save,
  Users
} from "lucide-solid";

import type {
  SettingsPart,
  GlobalSettingsPart,
  TorrentSettingsPart,
  SettingsGroup
} from "../../types/settings/types";
import { SettingsProvider, useSettingsContext } from "./SettingsContext";

function SettingsFull(): JSX.Element {
  return (
    <SettingsProvider>
      <div class="grid grid-cols-[18vw_1fr] grid-rows-[1fr] h-full overflow-hidden">
        <SettingsSidebar />
        <div class="col-start-2">
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
    torrent: () => <TorrentingPage settingsPart={activeCategory() as TorrentSettingsPart} />
  };

  return <>{contentMap[activeGroup()]?.() ?? <p>Invalid group</p>}</>;
}

function SettingsSidebar(): JSX.Element {
  const { setActiveCategory, setActiveGroup } = useSettingsContext();

  onMount(() => {
    handleActivateElem("settings-display", "global-display");
  });

  function changeAllToDefault() {
    document.querySelectorAll(".settings-link").forEach(elem => {
      (elem as HTMLElement).style.backgroundColor = "transparent";
    });
  }

  function handleActivateElem(elemID: string, category: SettingsPart) {
    changeAllToDefault();

    const selectedElem = document.getElementById(elemID);
    if (selectedElem) {
      selectedElem.style.backgroundColor = "var(--secondary-30-selected-color)";
    }

    if (category.startsWith("global")) {
      setActiveGroup("global");
    } else {
      setActiveGroup("torrent");
    }

    setActiveCategory(category);
  }

  return (
    <div class="flex flex-col flex-nowrap border-r-2 border-[var(--accent-color)] px-0 pb-6 pl-6 w-[18vw] h-full overflow-y-auto scrollbar-hide">
      <div class="flex flex-col gap-3">
        <ul class="flex flex-col mt-3">
          <p class="text-[32px] font-semibold font-mulish pb-3">Global</p>
          <SidebarLink id="settings-display" label="App Settings" icon={Settings} onClick={() => handleActivateElem("settings-display", "global-display")} />
          <SidebarLink id="settings-dns" label="DNS Settings" icon={Globe} onClick={() => handleActivateElem("settings-dns", "global-dns")} />
          <SidebarLink id="settings-install" label="Install Settings" icon={Package2} onClick={() => handleActivateElem("settings-install", "global-install")} />
          <SidebarLink id="settings-cache" label="Cache & Logs Settings" icon={Database} onClick={() => handleActivateElem("settings-cache", "global-cache")} />
        </ul>

        <ul class="flex flex-col mt-3">
          <p class="text-[32px] font-semibold font-mulish pb-3">Torrenting</p>
          <SidebarLink id="settings-dht" label="DHT" icon={Network} onClick={() => handleActivateElem("settings-dht", "dht")} />
          <SidebarLink id="settings-tcp" label="TCP" icon={Server} onClick={() => handleActivateElem("settings-tcp", "tcp")} />
          <SidebarLink id="settings-persistence" label="Persistence" icon={Save} onClick={() => handleActivateElem("settings-persistence", "persistence")} />
          <SidebarLink id="settings-peers-opts" label="Peers Options" icon={Users} onClick={() => handleActivateElem("settings-peers-opts", "peer-opts")} />
        </ul>
      </div>
    </div>
  );
}

function SidebarLink(props: { id: string; label: string; icon: (props: any) => JSX.Element; onClick: () => void }) {
  const Icon = props.icon;
  return (
    <a
      id={props.id}
      onClick={props.onClick}
      class="settings-link flex items-center gap-3 p-6 rounded-md cursor-pointer transition duration-300 ease-in-out hover:bg-[var(--secondary-30-selected-color)] hover:scale-95 text-[16px] font-semibold font-mulish"
    >
      <Icon size={18} />
      <span>{props.label}</span>
    </a>
  );
}

export default SettingsFull;
