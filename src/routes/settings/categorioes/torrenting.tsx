import { invoke } from "@tauri-apps/api/core";
import { message } from "@tauri-apps/plugin-dialog";
import { createSignal, onMount, Show } from "solid-js";
import "./torrenting.css";

function TorrentingPage(props) {
 const [globalTorrentConfig, setGlobalTorrentConfig] = createSignal(null); // Start with null to indicate loading
 const selectedPart = () => props.settingsPart || "dht"; // Provide a default fallback value

 onMount(async () => {
  try {
   const torrentConfig = await invoke("get_torrent_full_settings");
   setGlobalTorrentConfig(torrentConfig);
  } catch (error) {
   console.error("Error loading torrent settings:", error);
  }
  await message(
   "Please if you do not know what you are doing, go back to the Global Settings, you can break things here",
   { title: "FitLauncher", kind: "warning" },
  );
 });

 function handleSwitchCheckChange(path) {
  setGlobalTorrentConfig(prevConfig => {
   const newConfig = { ...prevConfig }; // Shallow copy of the object
   const keys = path.split("."); // Support nested keys, e.g., "dht.disable"
   let obj = newConfig;
   for (let i = 0; i < keys.length - 1; i++) {
    obj = obj[keys[i]];
   }
   obj[keys[keys.length - 1]] = !obj[keys[keys.length - 1]]; // Toggle the value
   return newConfig;
  });
 }

 function handleTextCheckChange(path, newValue) {
  setGlobalTorrentConfig(prevConfig => {
   const newConfig = { ...prevConfig }; // Shallow copy of the object
   const keys = path.split("."); // Support nested keys, e.g., "dht.disable"
   let obj = newConfig;
   for (let i = 0; i < keys.length - 1; i++) {
    obj = obj[keys[i]];
   }
   obj[keys[keys.length - 1]] = newValue;
   return newConfig;
  });
 }

 async function handleOnSave() {
  try {
   await invoke("change_torrent_config", { config: globalTorrentConfig() });
   await message("Settings Saved Successfully", {
    title: "FitLauncher",
    kind: "info",
   });
  } catch (error) {
   let messagecorrect = "Error saving settings" + error;
   await message(messagecorrect, { title: "FitLauncher", kind: "error" });
  }
 }

 return (
  <Show when={globalTorrentConfig()} fallback={<p>Loading...</p>}>
   <div class="torrenting-page">
    {selectedPart() === "dht" ? (
     <DHTPart
      config={globalTorrentConfig()}
      handleCheckChange={handleSwitchCheckChange}
     />
    ) : selectedPart() === "tcp" ? (
     <TCPPart
      config={globalTorrentConfig()}
      handleSwitchCheckChange={handleSwitchCheckChange}
      handleTextCheckChange={handleTextCheckChange}
     />
    ) : selectedPart() === "persistence" ? (
     <PersistencePart
      config={globalTorrentConfig()}
      handleSwitchCheckChange={handleSwitchCheckChange}
      handleTextCheckChange={handleTextCheckChange}
     />
    ) : selectedPart() === "peer-opts" ? (
     <PeerOptsParts
      config={globalTorrentConfig()}
      handleSwitchCheckChange={handleSwitchCheckChange}
      handleTextCheckChange={handleTextCheckChange}
     />
    ) : (
     <p>Invalid or Unsupported Part</p>
    )}
    <button
     class="save-settings-button"
     onclick={async () => {
      await handleOnSave();
     }}
    >
     <span>Save</span>
    </button>
   </div>
  </Show>
 );
}

function DHTPart({ config, handleCheckChange }) {
 return (
  <div class="torrenting-page-group" id="torrenting-dht">
   <p class="torrenting-page-group-title">DHT</p>
   <ul class="torrenting-page-group-list">
    <li>
     <span>Disable DHT :</span>
     <label class="switch">
      <input
       type="checkbox"
       checked={config.dht.disable}
       onchange={() => handleCheckChange("dht.disable")}
      />
      <span class="switch-slider round"></span>
     </label>
    </li>
    <li>
     <span>Disable DHT Persistence :</span>
     <label class="switch">
      <input
       type="checkbox"
       checked={config.dht.disable_persistence}
       onchange={() => handleCheckChange("dht.disable_persistence")}
      />
      <span class="switch-slider round"></span>
     </label>
    </li>
    <li>
     <span>DHT Persistence File Path :</span>
     <div class="settings-path-container">
      <span class="settings-path-text">{config.dht.persistence_filename}</span>
     </div>
    </li>
   </ul>
  </div>
 );
}

function TCPPart({ config, handleSwitchCheckChange, handleTextCheckChange }) {
 return (
  <div class="torrenting-page-group" id="torrenting-dht">
   <p class="torrenting-page-group-title">TCP</p>
   <ul class="torrenting-page-group-list">
    <li>
     <span>Disable TCP :</span>
     <label class="switch">
      <input
       type="checkbox"
       checked={config.tcp_listen.disable}
       onchange={() => handleSwitchCheckChange("dht.disable")}
      />
      <span class="switch-slider round"></span>
     </label>
    </li>
    <li>
     <span>TCP Minimum Port: </span>
     <div class="settings-path-container">
      <input
       type="number"
       class="settings-path-input"
       value={config.tcp_listen.min_port}
       oninput={e =>
        handleTextCheckChange(`tcp_listen.min_port`, Number(e.target.value))
       }
      />
     </div>
    </li>
    <li>
     <span>TCP Maximum Port: </span>
     <div class="settings-path-container">
      <input
       type="number"
       class="settings-path-input"
       value={config.tcp_listen.max_port}
       oninput={e =>
        handleTextCheckChange(`tcp_listen.max_port`, Number(e.target.value))
       }
      />
     </div>
    </li>
   </ul>
  </div>
 );
}

function PersistencePart({
 config,
 handleSwitchCheckChange,
 handleTextCheckChange,
}) {
 return (
  <div class="torrenting-page-group" id="torrenting-dht">
   <p class="torrenting-page-group-title">TCP</p>
   <ul class="torrenting-page-group-list">
    <li>
     <span>Disable Session Persistence :</span>
     <label class="switch">
      <input
       type="checkbox"
       checked={config.persistence.disable}
       onchange={() => handleSwitchCheckChange("persistence.disable")}
      />
      <span class="switch-slider round"></span>
     </label>
    </li>
    <li>
     <span>
      Enable FastResume (Resume the torrents faster but can sometimes cause
      issues) :
     </span>
     <label class="switch">
      <input
       type="checkbox"
       checked={config.persistence.fastresume}
       onchange={() => handleSwitchCheckChange("persistence.fastresume")}
      />
      <span class="switch-slider round"></span>
     </label>
    </li>
    <li>
     <span>Session Persistence Path: </span>
     <div class="settings-path-container">
      <span class="settings-path-text">{config.persistence.folder}</span>
     </div>
    </li>
   </ul>
  </div>
 );
}

function PeerOptsParts({
 config,
 handleSwitchCheckChange,
 handleTextCheckChange,
}) {
 return (
  <div class="torrenting-page-group" id="torrenting-dht">
   <p class="torrenting-page-group-title">TCP</p>
   <ul class="torrenting-page-group-list">
    <li>
     <span>Peers Connect TimeOut: </span>
     <div class="settings-path-container">
      <input
       type="number"
       class="settings-path-input"
       value={config.peer_opts.connect_timeout}
       oninput={e =>
        handleTextCheckChange(
         `peer_opts.connect_timeout`,
         Number(e.target.value),
        )
       }
      />
     </div>
    </li>
    <li>
     <span>Peers Read Write TimeOut: </span>
     <div class="settings-path-container">
      <input
       type="number"
       class="settings-path-input"
       value={config.peer_opts.read_write_timeout}
       oninput={e =>
        handleTextCheckChange(
         `peer_opts.read_write_timeout`,
         Number(e.target.value),
        )
       }
      />
     </div>
    </li>
   </ul>
  </div>
 );
}

export default TorrentingPage;
