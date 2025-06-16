import { Show } from "solid-js"
import '../GlobalSettingsPage.css'
import { SettingsSectionProps } from "../../../../../types/settings/types";
import { InstallationSettings } from "../../../../../bindings";

export default function InstallSettingsPart({ settings, handleSwitchCheckChange }: SettingsSectionProps<InstallationSettings>) {

    return (
        <Show when={settings} fallback={<p>Loading</p>} >
            <div class="global-page-group" id="global-display">
                <p class="global-page-group-title">Installation Settings</p>
                <ul class="global-page-group-list">
                    <li>
                        <span>Enable Auto-Install <small><i>(Will install the game directly after downloading)</i></small> :</span>
                        <label class="switch">
                            <input
                                type="checkbox"
                                checked={settings.auto_install}
                                onChange={() => handleSwitchCheckChange?.("installation_settings.auto_install")}
                            />
                            <span class="switch-slider round"></span>
                        </label>
                    </li>
                    <li>
                        <span>Enable Auto-Clean <small><i>(Will clean the game's setup after installing and introducing the path in library)</i></small> :</span>
                        <label class="switch">
                            <input
                                type="checkbox"
                                checked={settings.auto_clean}
                                onChange={() => handleSwitchCheckChange?.("installation_settings.auto_clean")}
                            />
                            <span class="switch-slider round"></span>
                        </label>
                    </li>
                    <li>
                        <span>Enable 2GB Limit for installation <small><i>(Will be automatically enabled if you have 8GB or less)</i></small> :</span>
                        <label class="switch">
                            <input
                                type="checkbox"
                                checked={settings.two_gb_limit}
                                onChange={() => handleSwitchCheckChange?.("installation_settings.two_gb_limit")}
                            />
                            <span class="switch-slider round"></span>
                        </label>
                    </li>
                    <li>
                        <span>Enable installation of DirectX <small><i>(It's only useful once if you have never installed fitgirl repacks)</i></small> :</span>
                        <label class="switch">
                            <input
                                type="checkbox"
                                checked={settings.directx_install}
                                onChange={() => handleSwitchCheckChange?.("installation_settings.directx_install")}
                            />
                            <span class="switch-slider round"></span>
                        </label>
                    </li>
                    <li>
                        <span>Enable installation of Microsoft C++ <small><i>(It's only useful once if you have never installed fitgirl repacks)</i></small> :</span>
                        <label class="switch">
                            <input
                                type="checkbox"
                                checked={settings.microsoftcpp_install}
                                onChange={() => handleSwitchCheckChange?.("installation_settings.microsoftcpp_install")}
                            />
                            <span class="switch-slider round"></span>
                        </label>
                    </li>
                </ul>
            </div>

        </Show>
    );
}
