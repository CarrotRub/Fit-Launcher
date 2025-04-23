import { Show } from "solid-js"
import '../GlobalSettingsPage.css'
import { confirm } from "@tauri-apps/plugin-dialog";
import { exit } from "@tauri-apps/plugin-process";

export default function DNSPart({ settings, handleTextCheckChange, handleSwitchCheckChange }) {
    async function warnDNSSystemConf() {
        const confirm_sys = await confirm("Please remember that you will have to save first and then restart FitLauncher for the changes to be made.\n Do you want to restart now or later ?  (if you do not restart now, you will have to quit the app from taskbar too).\n Keep in mind that if it makes the app slow down revert to the default settings. ",{title:'FitLauncher', kind: 'warning'})
        if( confirm_sys ) {
            await exit();
        }
    }

    return (
        <Show when={settings} placeholder={<p>Loading</p>} >
            <div className="global-page-group" id="global-display">
                <p className="global-page-group-title">DNS Settings</p>
                <ul className="global-page-group-list">
                    <li>
                        <span>Use your system's default DNS Settings :</span>
                        <label className="switch">
                            <input
                                type="checkbox"
                                checked={settings.system_conf}
                                onChange={async () => {
                                    handleSwitchCheckChange("dns.system_conf")
                                    await warnDNSSystemConf();
                                }}
                            />
                            <span className="switch-slider round"></span>
                        </label>
                    </li>

                    <li>
                        <span>Primary DNS Address <small><i>(IpV4)</i></small>: </span>
                        <div className="settings-path-container">
                            <input
                                type="text"
                                className="settings-path-input"
                                value={settings.primary}
                                onInput={(e) =>
                                    handleTextCheckChange(`dns.primary`, e.target.value)
                                }
                                disabled={settings.system_conf}
                            />
                        </div>
                    </li>
                    <li>
                        <span>Secondary DNS Address <small><i>(IpV4)</i></small>: </span>
                        <div className="settings-path-container">
                            <input
                                type="text"
                                className="settings-path-input"
                                value={settings.secondary}
                                onInput={(e) =>
                                    handleTextCheckChange(`dns.secondary`, e.target.value)
                                }
                                disabled={settings.system_conf}
                            />
                        </div>
                    </li>
                </ul>
            </div>
        </Show>
    );
}
