import { createEffect, createSignal, onMount, Show } from "solid-js"
import './GlobalSettingsPage.css'
import { invoke } from "@tauri-apps/api/core";
import { confirm, message } from "@tauri-apps/plugin-dialog";

function GlobalSettingsPage(props) {
    const [globalSettings, setGlobalSettings] = createSignal(null); // Start with null to indicate loading
    const selectedPart = () => props.settingsPart.replace('global-', '') || 'display'; // Provide a default fallback value

    async function getCurrentSettings() {
        try {
            const dnsSettings = await invoke('get_dns_settings');
            const installationSettings = await invoke('get_installation_settings');
            const gamehubSettings = await invoke('get_gamehub_settings');

            setGlobalSettings({
                dns: dnsSettings,
                installation_settings: installationSettings,
                display: gamehubSettings,
            });

        } catch (error) {
            let messagecorrect = 'Error gettings settings' + error;
            await message(messagecorrect, { title: 'FitLauncher', kind: 'error' })
        }
    }

    onMount(async () => {
        await getCurrentSettings()
    });


    async function handleOnSave() {
        const settingsToSave = globalSettings();
        if (!settingsToSave) {
            console.error('No settings to save');
            return;
        }

        try {
            if (settingsToSave.dns) {
                await invoke('change_dns_settings', { settings: settingsToSave.dns });
            }

            if (settingsToSave.installation_settings) {
                await invoke('change_installation_settings', { settings: settingsToSave.installation_settings });
            }

            if (settingsToSave.display) {
                await invoke('change_gamehub_settings', { settings: settingsToSave.display });
            }

            await message('Settings Saved Successfully', { title: 'FitLauncher', kind: 'info' })
        } catch (error) {
            let messagecorrect = 'Error saving settings' + error;
            await message(messagecorrect, { title: 'FitLauncher', kind: 'error' })
        }
    }

    function handleSwitchCheckChange(path) {
        setGlobalSettings((prevConfig) => {
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
        setGlobalSettings((prevConfig) => {
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

    async function handleResetSettings() {
        console.log(selectedPart())
        switch (selectedPart()) {
            case 'display':
                try {
                    await invoke('reset_gamehub_settings');
                    await message('Display settings got reseted to default successfully !', { title: 'FitLauncher', kind: 'info' })
                } catch (error) {
                    let formatted_message = 'Error resetting Display settings ! :' + error
                    await message(formatted_message, { title: 'FitLauncher', kind: 'error' })
                }
                break;
            case 'dns':
                try {
                    await invoke('reset_dns_settings');
                    await message('DNS settings got reseted to default successfully !', { title: 'FitLauncher', kind: 'info' })
                } catch (error) {
                    let formatted_message = 'Error resetting DNS settings ! :' + error
                    await message(formatted_message, { title: 'FitLauncher', kind: 'error' })
                }
                break;
            case 'install':
                try {
                    await invoke('reset_installation_settings');
                    await message('Installation settings got reseted to default successfully !', { title: 'FitLauncher', kind: 'info' })
                } catch (error) {
                    let formatted_message = 'Error resetting Installation settings ! :' + error
                    await message(formatted_message, { title: 'FitLauncher', kind: 'error' })
                }
                break;
        }
        //TODO: Fix this, bad reactivity probably has to do with props being passed down.
        window.location.reload();
    }

    return (
        <Show when={globalSettings()} fallback={<p>Loading...</p>}>
            <div className="torrenting-page">
                {selectedPart() === 'display' ? (
                    <DisplayPart settings={globalSettings().display} handleSwitchCheckChange={handleSwitchCheckChange} />
                ) : selectedPart() === 'dns' ? (
                    <DNSPart settings={globalSettings().dns} handleTextCheckChange={handleTextCheckChange} />
                ) : selectedPart() === 'install' ? (
                    <InstallSettingsPart settings={globalSettings().installation_settings} handleSwitchCheckChange={handleSwitchCheckChange} />
                ) : selectedPart() === 'cache' ? (
                    <CacheSettings />
                ) : (
                    <p>Invalid or Unsupported Part</p>
                )}
                <div className="global-settings-buttons-container">
                    <button className="reset-settings-button" onClick={async () => { await handleResetSettings(); }}>
                        <span>Reset To Default</span>
                    </button>
                    <button className="save-settings-button" onClick={async () => { await handleOnSave(); }}>
                        <span>Save</span>
                    </button>
                </div>
            </div>
        </Show>
    );
}

function DisplayPart({ settings, handleSwitchCheckChange }) {

    return (
        <Show when={settings} placeholder={<p>Loading</p>} >
            <div className="global-page-group" id="global-display">
                <p className="global-page-group-title">Display</p>
                <ul className="global-page-group-list">
                    <li>
                        <span>Hide NSFW Content :</span>
                        <label className="switch">
                            <input
                                type="checkbox"
                                checked={settings.nsfw_censorship}
                                onChange={() => handleSwitchCheckChange("display.nsfw_censorship")}
                            />
                            <span className="switch-slider round"></span>
                        </label>
                    </li>
                    <li>
                        <span>Automatically Get Colors <small><i>(Popular Games)</i></small> :</span>
                        <label className="switch">
                            <input
                                type="checkbox"
                                checked={settings.auto_get_colors_popular_games}
                                onChange={() => handleSwitchCheckChange("display.auto_get_colors_popular_games")}
                            />
                            <span className="switch-slider round"></span>
                        </label>
                    </li>
                </ul>
            </div>

        </Show>
    );
}

function DNSPart({ settings, handleTextCheckChange }) {

    return (
        <Show when={settings} placeholder={<p>Loading</p>} >
            <div className="global-page-group" id="global-display">
                <p className="global-page-group-title">DNS</p>
                <ul className="global-page-group-list">
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
                            />
                        </div>
                    </li>
                </ul>
            </div>

        </Show>
    );
}

function InstallSettingsPart({ settings, handleSwitchCheckChange }) {

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

function CacheSettings() {
    async function handleClearCache() {
        const confirmation = await confirm('This will delete every cache files, this action cannot be reverted, are you sure ?', {title: 'FitLauncher', kind: 'warning'})
        if (confirmation) {
            try {
                await invoke('clear_all_cache');
                await message('Cache cleared successfully !', {title: 'FitLauncher', kind: 'info'})
            } catch(error) {
                await message(error, {title: 'FitLauncher', kind: 'error'})
            }
        }
    }

    async function handleGoToLogs() {
        try {
            await invoke('open_logs_directory');
        } catch(error) {
            await message(error, {title: 'FitLauncher', kind: 'error'});
        }
    }

    return (

        <div className="global-page-group" id="global-display">
            <p className="global-page-group-title">Cache & Logs Settings</p>
            <ul className="global-page-group-list">
                <li>
                    <span>Clear All Cache Files <small><i>(This will remove images cache and all torrents cache, dht and session data. )</i></small>:</span>
                    <button className="clear-cache-settings-button" onClick={async () => { await handleClearCache() }}>
                        <span>Clear</span>
                    </button>
                </li>
                <li>
                    <span>Go To Logs <small><i>(Please do not share this with anyone except the official FitLauncher's Moderation !)</i></small>:</span>
                    <button className="go-to-logs-settings-button" onClick={async () => { await handleGoToLogs() }}>
                        <span>Go !</span>
                    </button>
                </li>
            </ul>
        </div>

    );
}
export default GlobalSettingsPage;