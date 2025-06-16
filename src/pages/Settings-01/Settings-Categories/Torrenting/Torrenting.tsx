import {
  createSignal,
  onMount,
  Show,
  type JSX
} from "solid-js";
import "./Torrenting.css";
import { invoke } from "@tauri-apps/api/core";
import { message } from "@tauri-apps/plugin-dialog";
import { TorrentSettings, TorrentSettingsPart } from "../../../../types/settings/types";


function TorrentingPage(props: { settingsPart: TorrentSettingsPart }): JSX.Element {
  const [globalTorrentConfig, setGlobalTorrentConfig] = createSignal<TorrentSettings | null>(null);
  console.log()
  const selectedPart = () => props.settingsPart || "dht";
  console.log("Selected part:", props);

  onMount(async () => {
    try {
      const torrentConfig = await invoke<TorrentSettings>("get_torrent_full_settings");
      setGlobalTorrentConfig(torrentConfig);
    } catch (error) {
      console.error("Error loading torrent settings:", error);
    }

    await message(
      "Please if you do not know what you are doing, go back to the Global Settings, you can break things here",
      { title: "FitLauncher", kind: "warning" }
    );
  });

  const handleSwitchCheckChange = (path: string) => {
    setGlobalTorrentConfig((prevConfig) => {
      if (!prevConfig) return prevConfig;
      const newConfig = structuredClone(prevConfig); // safer than shallow copy
      const keys = path.split(".");
      let obj: any = newConfig;
      for (let i = 0; i < keys.length - 1; i++) {
        obj = obj[keys[i]];
      }
      obj[keys.at(-1)!] = !obj[keys.at(-1)!];
      return newConfig;
    });
  };

  const handleTextCheckChange = (path: string, newValue: string | number) => {
    setGlobalTorrentConfig((prevConfig) => {
      if (!prevConfig) return prevConfig;
      const newConfig = structuredClone(prevConfig);
      const keys = path.split(".");
      let obj: any = newConfig;
      for (let i = 0; i < keys.length - 1; i++) {
        obj = obj[keys[i]];
      }
      obj[keys.at(-1)!] = newValue;
      return newConfig;
    });
  };

  const handleOnSave = async () => {
    if (!globalTorrentConfig()) return;
    try {
      await invoke("change_torrent_config", { config: globalTorrentConfig() });
      await message("Settings Saved Successfully", {
        title: "FitLauncher",
        kind: "info"
      });
    } catch (error) {
      await message("Error saving settings: " + error, {
        title: "FitLauncher",
        kind: "error"
      });
    }
  };

  return (
    <Show when={globalTorrentConfig()} fallback={<p>Loading...</p>}>
      <div class="torrenting-page">
        {{
          dht: (
            <DHTPart
              config={globalTorrentConfig()!}
              handleCheckChange={handleSwitchCheckChange}
            />
          ),
          tcp: (
            <TCPPart
              config={globalTorrentConfig()!}
              handleSwitchCheckChange={handleSwitchCheckChange}
              handleTextCheckChange={handleTextCheckChange}
            />
          ),
          persistence: (
            <PersistencePart
              config={globalTorrentConfig()!}
              handleSwitchCheckChange={handleSwitchCheckChange}
              handleTextCheckChange={handleTextCheckChange}
            />
          ),
          "peer-opts": (
            <PeerOptsParts
              config={globalTorrentConfig()!}
              handleSwitchCheckChange={handleSwitchCheckChange}
              handleTextCheckChange={handleTextCheckChange}
            />
          )
        }[selectedPart()] ?? <p>Invalid or Unsupported Part</p>}
        <button class="save-settings-button" onClick={handleOnSave}>
          <span>Save</span>
        </button>
      </div>
    </Show>
  );
}


// ============================= COMPONENTS ============================= //

type SectionProps = {
  config: TorrentSettings;
  handleCheckChange?: (path: string) => void;
  handleSwitchCheckChange?: (path: string) => void;
  handleTextCheckChange?: (path: string, val: string | number) => void;
};

function DHTPart({ config, handleCheckChange }: SectionProps): JSX.Element {
  return (
    <div class="torrenting-page-group" id="torrenting-dht">
      <p class="torrenting-page-group-title">DHT</p>
      <ul class="torrenting-page-group-list">
        <li>
          <span>Disable DHT:</span>
          <label class="switch">
            <input
              type="checkbox"
              checked={config.dht.disable}
              onChange={() => handleCheckChange?.("dht.disable")}
            />
            <span class="switch-slider round" />
          </label>
        </li>
        <li>
          <span>Disable DHT Persistence:</span>
          <label class="switch">
            <input
              type="checkbox"
              checked={config.dht.disable_persistence}
              onChange={() => handleCheckChange?.("dht.disable_persistence")}
            />
            <span class="switch-slider round" />
          </label>
        </li>
        <li>
          <span>DHT Persistence File Path:</span>
          <div class="settings-path-container">
            <span class="settings-path-text">{config.dht.persistence_filename}</span>
          </div>
        </li>
      </ul>
    </div>
  );
}

function TCPPart({ config, handleSwitchCheckChange, handleTextCheckChange }: SectionProps): JSX.Element {
  return (
    <div class="torrenting-page-group">
      <p class="torrenting-page-group-title">TCP</p>
      <ul class="torrenting-page-group-list">
        <li>
          <span>Disable TCP:</span>
          <label class="switch">
            <input
              type="checkbox"
              checked={config.tcp_listen.disable}
              onChange={() => handleSwitchCheckChange?.("tcp_listen.disable")}
            />
            <span class="switch-slider round" />
          </label>
        </li>
        <li>
          <span>TCP Minimum Port:</span>
          <div class="settings-path-container">
            <input
              type="number"
              class="settings-path-input"
              value={config.tcp_listen.min_port}
              onInput={(e) => handleTextCheckChange?.("tcp_listen.min_port", Number(e.currentTarget.value))}
            />
          </div>
        </li>
        <li>
          <span>TCP Maximum Port:</span>
          <div class="settings-path-container">
            <input
              type="number"
              class="settings-path-input"
              value={config.tcp_listen.max_port}
              onInput={(e) => handleTextCheckChange?.("tcp_listen.max_port", Number(e.currentTarget.value))}
            />
          </div>
        </li>
      </ul>
    </div>
  );
}

function PersistencePart({ config, handleSwitchCheckChange }: SectionProps): JSX.Element {
  return (
    <div class="torrenting-page-group">
      <p class="torrenting-page-group-title">Persistence</p>
      <ul class="torrenting-page-group-list">
        <li>
          <span>Disable Session Persistence:</span>
          <label class="switch">
            <input
              type="checkbox"
              checked={config.persistence.disable}
              onChange={() => handleSwitchCheckChange?.("persistence.disable")}
            />
            <span class="switch-slider round" />
          </label>
        </li>
        <li>
          <span>Enable FastResume:</span>
          <label class="switch">
            <input
              type="checkbox"
              checked={config.persistence.fastresume}
              onChange={() => handleSwitchCheckChange?.("persistence.fastresume")}
            />
            <span class="switch-slider round" />
          </label>
        </li>
        <li>
          <span>Session Persistence Path:</span>
          <div class="settings-path-container">
            <span class="settings-path-text">{config.persistence.folder}</span>
          </div>
        </li>
      </ul>
    </div>
  );
}

function PeerOptsParts({ config, handleTextCheckChange }: SectionProps): JSX.Element {
  return (
    <div class="torrenting-page-group">
      <p class="torrenting-page-group-title">Peers Options</p>
      <ul class="torrenting-page-group-list">
        <li>
          <span>Connect Timeout:</span>
          <div class="settings-path-container">
            <input
              type="number"
              class="settings-path-input"
              value={config.peer_opts.connect_timeout.secs}
              onInput={(e) => handleTextCheckChange?.("peer_opts.connect_timeout", Number(e.currentTarget.value))}
            />
          </div>
        </li>
        <li>
          <span>Read/Write Timeout:</span>
          <div class="settings-path-container">
            <input
              type="number"
              class="settings-path-input"
              value={config.peer_opts.read_write_timeout.secs}
              onInput={(e) => handleTextCheckChange?.("peer_opts.read_write_timeout", Number(e.currentTarget.value))}
            />
          </div>
        </li>
      </ul>
    </div>
  );
}

export default TorrentingPage;
