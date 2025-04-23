import { Show } from "solid-js"
import '../GlobalSettingsPage.css'

export default function InstallSettingsPart({ settings, handleSwitchCheckChange }) {

    return (
        <Show when={settings} placeholder={<p>Loading</p>} >
            <div className="global-page-group" id="global-display">
                <p className="global-page-group-title">Installation Settings</p>
                <ul className="global-page-group-list">
                    <li>
                        <span>Enable Auto-Install <small><i>(Will install the game directly after downloading)</i></small> :</span>
                        <label className="switch">
                            <input
                                type="checkbox"
                                checked={settings.auto_install}
                                onChange={() => handleSwitchCheckChange("installation_settings.auto_install")}
                            />
                            <span className="switch-slider round"></span>
                        </label>
                    </li>
                    <li>
                        <span>Enable Auto-Clean <small><i>(Will clean the game's setup after installing and introducing the path in library)</i></small> :</span>
                        <label className="switch">
                            <input
                                type="checkbox"
                                checked={settings.auto_clean}
                                onChange={() => handleSwitchCheckChange("installation_settings.auto_clean")}
                            />
                            <span className="switch-slider round"></span>
                        </label>
                    </li>
                    <li>
                        <span>Enable 2GB Limit for installation <small><i>(Will be automatically enabled if you have 8GB or less)</i></small> :</span>
                        <label className="switch">
                            <input
                                type="checkbox"
                                checked={settings.two_gb_limit}
                                onChange={() => handleSwitchCheckChange("installation_settings.two_gb_limit")}
                            />
                            <span className="switch-slider round"></span>
                        </label>
                    </li>
                    <li>
                        <span>Enable installation of DirectX <small><i>(It's only useful once if you have never installed fitgirl repacks)</i></small> :</span>
                        <label className="switch">
                            <input
                                type="checkbox"
                                checked={settings.directx_install}
                                onChange={() => handleSwitchCheckChange("installation_settings.directx_install")}
                            />
                            <span className="switch-slider round"></span>
                        </label>
                    </li>
                    <li>
                        <span>Enable installation of Microsoft C++ <small><i>(It's only useful once if you have never installed fitgirl repacks)</i></small> :</span>
                        <label className="switch">
                            <input
                                type="checkbox"
                                checked={settings.microsoftcpp_install}
                                onChange={() => handleSwitchCheckChange("installation_settings.microsoftcpp_install")}
                            />
                            <span className="switch-slider round"></span>
                        </label>
                    </li>
                </ul>
            </div>

        </Show>
    );
}
