import {
  createSignal,
  onMount,
  Show,
  type JSX
} from "solid-js";

import { invoke } from "@tauri-apps/api/core";
import { message } from "@tauri-apps/plugin-dialog";
import { SettingsSectionProps, TorrentSettings, TorrentSettingsPart } from "../../../../types/settings/types";
import DHTPart from "./DHTPart/DHTPart";
import Button from "../../../../components/UI/Button/Button";
import TCPPart from "./TCPPart/TCPPart";
import PersistencePart from "./PersistencePart/PersistencePart";
import PeerOptsPart from "./PeerOptsPart/PeerOptsPart";


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
      <div class="flex flex-col gap-6 h-full w-auto p-3 justify-between">
        {{
          dht: (
            <DHTPart
              settings={() => globalTorrentConfig()?.dht!}
              handleSwitchCheckChange={handleSwitchCheckChange}
            />
          ),
          tcp: (
            <TCPPart
              settings={() => globalTorrentConfig()?.tcp_listen!}
              handleSwitchCheckChange={handleSwitchCheckChange}
              handleTextCheckChange={handleTextCheckChange}
            />
          ),
          persistence: (
            <PersistencePart
              settings={() => globalTorrentConfig()?.persistence!}
              handleSwitchCheckChange={handleSwitchCheckChange}
              handleTextCheckChange={handleTextCheckChange}
            />
          ),
          "peer-opts": (
            <PeerOptsPart
              settings={() => globalTorrentConfig()?.peer_opts!}
              handleSwitchCheckChange={handleSwitchCheckChange}
              handleTextCheckChange={handleTextCheckChange}
            />
          )
        }[selectedPart()] ?? <p>Invalid or Unsupported Part</p>}

        <div class="flex flex-row self-end gap-3 ">
          <Button onClick={handleOnSave} label="Save" variant="solid" />
        </div>
      </div>
    </Show>
  );
}

export default TorrentingPage;
