import { createEffect, createSignal, onMount, Show } from "solid-js"
import './Torrenting.css'
import { invoke } from "@tauri-apps/api/core";
import { message } from "@tauri-apps/plugin-dialog";

function TorrentingPage(props) {
    const [globalTorrentConfig, setGlobalTorrentConfig] = createSignal(null); // Start with null to indicate loading
    const selectedPart = () => props.settingsPart || 'dht'; // Provide a default fallback value

    onMount(async () => {
        try {
            const torrentConfig = await invoke('get_torrent_full_settings');
            setGlobalTorrentConfig(torrentConfig);
        } catch (error) {
            console.error("Error loading torrent settings:", error);
        }
        await message('Please if you do not know what you are doing, go back to the Global Settings, you can break things here', { title: 'FitLauncher', kind: 'warning' })
    });


    function handleSwitchCheckChange(path) {
        setGlobalTorrentConfig((prevConfig) => {
            const newConfig = { ...prevConfig }; // Shallow copy of the object
            const keys = path.split('.'); // Support nested keys, e.g., "dht.disable"
            let obj = newConfig;
            for (let i = 0; i < keys.length - 1; i++) {
                obj = obj[keys[i]];
            }
            obj[keys[keys.length - 1]] = !obj[keys[keys.length - 1]]; // Toggle the value
            return newConfig;
        });
    }

    function handleTextCheckChange(path, newValue) {
        setGlobalTorrentConfig((prevConfig) => {
            const newConfig = { ...prevConfig }; // Shallow copy of the object
            const keys = path.split('.'); // Support nested keys, e.g., "dht.disable"
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
            await invoke('change_torrent_config', { config: globalTorrentConfig() })
            await message('Settings Saved Successfully', { title: 'FitLauncher', kind: 'info' })
        } catch (error) {
            let messagecorrect = 'Error saving settings' + error;
            await message(messagecorrect, { title: 'FitLauncher', kind: 'error' })
        }
    }

    return (
        <Show when={globalTorrentConfig()} fallback={<p>Loading...</p>}>
            <div className="torrenting-page">
                {selectedPart() === 'dht' ? (
                    <DHTPart
                        config={globalTorrentConfig()}
                        handleCheckChange={handleSwitchCheckChange}
                    />
                ) : selectedPart() === 'tcp' ? (
                    <TCPPart
                        config={globalTorrentConfig()}
                        handleSwitchCheckChange={handleSwitchCheckChange}
                        handleTextCheckChange={handleTextCheckChange}
                    />
                ) : selectedPart() === 'persistence' ? (
                    <PersistencePart
                        config={globalTorrentConfig()}
                        handleSwitchCheckChange={handleSwitchCheckChange}
                        handleTextCheckChange={handleTextCheckChange}
                    />
                ) : selectedPart() === 'peer-opts' ? (
                    <PeerOptsParts
                        config={globalTorrentConfig()}
                        handleSwitchCheckChange={handleSwitchCheckChange}
                        handleTextCheckChange={handleTextCheckChange}
                    />
                ) : (
                    <p>Invalid or Unsupported Part</p>
                )}
                <button className="save-settings-button" onClick={async () => { await handleOnSave() }}>
                    <span>Save</span>
                </button>
            </div>
        </Show>
    );
}

function DHTPart({ config, handleCheckChange }) {
    return (
        <div className="torrenting-page-group" id="torrenting-dht">
            <p className="torrenting-page-group-title">DHT</p>
            <ul className="torrenting-page-group-list">
                <li>
                    <span>Disable DHT :</span>
                    <label className="switch">
                        <input
                            type="checkbox"
                            checked={config.dht.disable}
                            onChange={() => handleCheckChange("dht.disable")}
                        />
                        <span className="switch-slider round"></span>
                    </label>
                </li>
                <li>
                    <span>Disable DHT Persistence :</span>
                    <label className="switch">
                        <input
                            type="checkbox"
                            checked={config.dht.disable_persistence}
                            onChange={() => handleCheckChange("dht.disable_persistence")}
                        />
                        <span className="switch-slider round"></span>
                    </label>
                </li>
                <li>
                    <span>DHT Persistence File Path :</span>
                    <div className="settings-path-container">
                        <span className="settings-path-text">{config.dht.persistence_filename}</span>
                    </div>
                </li>
            </ul>
        </div>
    );
}

function TCPPart({ config, handleSwitchCheckChange, handleTextCheckChange }) {

    return (
        <div className="torrenting-page-group" id="torrenting-dht">
            <p className="torrenting-page-group-title">TCP</p>
            <ul className="torrenting-page-group-list">
                <li>
                    <span>Disable TCP :</span>
                    <label className="switch">
                        <input
                            type="checkbox"
                            checked={config.tcp_listen.disable}
                            onChange={() => handleSwitchCheckChange("dht.disable")}
                        />
                        <span className="switch-slider round"></span>
                    </label>
                </li>
                <li>
                    <span>TCP Minimum Port: </span>
                    <div className="settings-path-container">
                        <input
                            type="number"
                            className="settings-path-input"
                            value={config.tcp_listen.min_port}
                            onInput={(e) =>
                                handleTextCheckChange(`tcp_listen.min_port`, Number(e.target.value))
                            }
                        />
                    </div>
                </li>
                <li>
                    <span>TCP Maximum Port: </span>
                    <div className="settings-path-container">
                        <input
                            type="number"
                            className="settings-path-input"
                            value={config.tcp_listen.max_port}
                            onInput={(e) =>
                                handleTextCheckChange(`tcp_listen.max_port`, Number(e.target.value))
                            }
                        />
                    </div>
                </li>
            </ul>
        </div>
    );
}

function PersistencePart({ config, handleSwitchCheckChange, handleTextCheckChange }) {
    return (
        <div className="torrenting-page-group" id="torrenting-dht">
            <p className="torrenting-page-group-title">TCP</p>
            <ul className="torrenting-page-group-list">
                <li>
                    <span>Disable Session Persistence :</span>
                    <label className="switch">
                        <input
                            type="checkbox"
                            checked={config.persistence.disable}
                            onChange={() => handleSwitchCheckChange("persistence.disable")}
                        />
                        <span className="switch-slider round"></span>
                    </label>
                </li>
                <li>
                    <span>Enable FastResume (Resume the torrents faster but can sometimes cause issues) :</span>
                    <label className="switch">
                        <input
                            type="checkbox"
                            checked={config.persistence.fastresume}
                            onChange={() => handleSwitchCheckChange("persistence.fastresume")}
                        />
                        <span className="switch-slider round"></span>
                    </label>
                </li>
                <li>
                    <span>Session Persistence Path: </span>
                    <div className="settings-path-container">
                        <span className="settings-path-text">{config.persistence.folder}</span>
                    </div>
                </li>
            </ul>
        </div>
    );
}

function PeerOptsParts({ config, handleSwitchCheckChange, handleTextCheckChange }) {
    return (
        <div className="torrenting-page-group" id="torrenting-dht">
            <p className="torrenting-page-group-title">TCP</p>
            <ul className="torrenting-page-group-list">
                <li>
                    <span>Peers Connect TimeOut: </span>
                    <div className="settings-path-container">
                        <input
                            type="number"
                            className="settings-path-input"
                            value={config.peer_opts.connect_timeout}
                            onInput={(e) =>
                                handleTextCheckChange(`peer_opts.connect_timeout`, Number(e.target.value))
                            }
                        />
                    </div>
                </li>
                <li>
                    <span>Peers Read Write TimeOut: </span>
                    <div className="settings-path-container">
                        <input
                            type="number"
                            className="settings-path-input"
                            value={config.peer_opts.read_write_timeout}
                            onInput={(e) =>
                                handleTextCheckChange(`peer_opts.read_write_timeout`, Number(e.target.value))
                            }
                        />
                    </div>
                </li>
            </ul>
        </div>
    );
}

export default TorrentingPage;