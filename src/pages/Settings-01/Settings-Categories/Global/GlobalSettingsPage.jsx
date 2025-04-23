import { createSignal, onMount, Show } from "solid-js"
import './GlobalSettingsPage.css'
import { invoke } from "@tauri-apps/api/core";
import { message } from "@tauri-apps/plugin-dialog";
import CacheSettings from "./CacheSettings/CacheSettings";
import InstallSettingsPart from "./InstallSettings/InstallSettings";
import DNSPart from "./DNSSettings/DNSSettings";
import DisplayPart from "./DisplayPart/DisplayPart";

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
                    <DNSPart settings={globalSettings().dns} handleTextCheckChange={handleTextCheckChange} handleSwitchCheckChange={handleSwitchCheckChange}/>
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


export default GlobalSettingsPage;