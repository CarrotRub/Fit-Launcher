import { createSignal, onMount, type JSX, type Setter } from "solid-js";
import "./Settings.css";
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
      <div class="settings content-page">
        <SettingsSidebar />
        <div class="settings-content">
          <SettingsContent />
        </div>
      </div>
    </SettingsProvider>
  );
}

function SettingsContent(): JSX.Element {
  const { activeCategory, activeGroup } = useSettingsContext();
  console.log("Active category:", activeCategory())
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
    const allDivs = document.querySelectorAll(".settings-sidebar-group-list-category a");
    allDivs.forEach((elem) => {
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
    <div class="settings-sidebar">
      <div class="settings-sidebar-group">
        <ul class="settings-sidebar-group-list-category">
          <p class="settings-sidebar-group-title">Global</p>
          <a id="settings-display" onClick={() => handleActivateElem("settings-display", "global-display")}>
            <Settings size={18} />
            <span>App Settings</span>
          </a>
          <a id="settings-dns" onClick={() => handleActivateElem("settings-dns", "global-dns")}>
            <Globe size={18} />
            <span>DNS Settings</span>
          </a>
          <a id="settings-install" onClick={() => handleActivateElem("settings-install", "global-install")}>
            <Package2 size={18} />
            <span>Install Settings</span>
          </a>
          <a id="settings-cache" onClick={() => handleActivateElem("settings-cache", "global-cache")}>
            <Database size={18} />
            <span>Cache & Logs Settings</span>
          </a>
        </ul>

        <ul class="settings-sidebar-group-list-category">
          <p class="settings-sidebar-group-title">Torrenting</p>
          <a id="settings-dht" onClick={() => handleActivateElem("settings-dht", "dht")}>
            <Network size={18} />
            <span>DHT</span>
          </a>
          <a id="settings-tcp" onClick={() => handleActivateElem("settings-tcp", "tcp")}>
            <Server size={18} />
            <span>TCP</span>
          </a>
          <a id="settings-persistence" onClick={() => handleActivateElem("settings-persistence", "persistence")}>
            <Save size={18} />
            <span>Persistence</span>
          </a>
          <a id="settings-peers-opts" onClick={() => handleActivateElem("settings-peers-opts", "peer-opts")}>
            <Users size={18} />
            <span>Peers Options</span>
          </a>
        </ul>
      </div>
    </div>
  );
}

export default SettingsFull;
