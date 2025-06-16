import { Show } from "solid-js"
import '../GlobalSettingsPage.css'
import { confirm } from "@tauri-apps/plugin-dialog";
import { exit } from "@tauri-apps/plugin-process";
import { FitLauncherDnsConfig } from "../../../../../bindings";
import { SettingsSectionProps } from "../../../../../types/settings/types";
import PageGroup from "../../Components/PageGroup";
import LabelCheckboxSettings from "../../Components/UI/LabelCheckbox/LabelCheckbox";

export default function DNSPart({
    settings,
    handleTextCheckChange,
    handleSwitchCheckChange,
}: SettingsSectionProps<FitLauncherDnsConfig>) {

    return (
        <Show when={settings} fallback={<p>Loading</p>} >
            <PageGroup>
                <DNSContent
                    settings={settings}
                    handleTextCheckChange={handleTextCheckChange}
                    handleSwitchCheckChange={handleSwitchCheckChange}
                />
            </ PageGroup >
        </Show>
    );
}

function DNSContent({
    settings,
    handleTextCheckChange,
    handleSwitchCheckChange,
}: SettingsSectionProps<FitLauncherDnsConfig>) {

    async function warnDNSSystemConf() {
        const confirm_sys = await confirm("Please remember that you will have to save first and then restart FitLauncher for the changes to be made.\n Do you want to restart now or later ?  (if you do not restart now, you will have to quit the app from taskbar too).\n Keep in mind that if it makes the app slow down revert to the default settings. ", { title: 'FitLauncher', kind: 'warning' })
        if (confirm_sys) {
            await exit();
        }
    }

    return (
        <>

            <LabelCheckboxSettings text="Use your system's default DNS Settings :" checked={settings.system_conf} action={async () => {
                handleSwitchCheckChange?.("dns.system_conf");
                await warnDNSSystemConf();
            }} />
            <li>
                <span>Primary DNS Address <small><i>(IpV4)</i></small>: </span>
                <div class="settings-path-container">
                    <input
                        type="text"
                        class="settings-path-input"
                        value={settings.primary || "1.1.1.1"}
                        onInput={(e) => handleTextCheckChange?.(`dns.primary`, e.target.value)}
                        disabled={settings.system_conf} />
                </div>
            </li><li>
                <span>Secondary DNS Address <small><i>(IpV4)</i></small>: </span>
                <div class="settings-path-container">
                    <input
                        type="text"
                        class="settings-path-input"
                        value={settings.secondary || "1.1.1.1"}
                        onInput={(e) => handleTextCheckChange?.(`dns.secondary`, e.target.value)}
                        disabled={settings.system_conf} />
                </div>
            </li></>
    )
}