import { Show } from "solid-js"

import { confirm } from "@tauri-apps/plugin-dialog";
import { exit } from "@tauri-apps/plugin-process";
import { FitLauncherDnsConfig } from "../../../../../bindings";
import { SettingsSectionProps } from "../../../../../types/settings/types";
import PageGroup from "../../Components/PageGroup";
import LabelCheckboxSettings from "../../Components/UI/LabelCheckbox/LabelCheckbox";
import LoadingPage from "../../../../LoadingPage-01/LoadingPage";
import LabelInputAddress from "../../Components/UI/InputAddress/InputAddress";

export default function DNSPart({
    settings,
    handleTextCheckChange,
    handleSwitchCheckChange,
}: SettingsSectionProps<FitLauncherDnsConfig>) {

    return (
        <Show when={settings} fallback={<LoadingPage />}>
            <PageGroup title="DNS Settings">
                <DNSContent
                    settings={settings}
                    handleTextCheckChange={handleTextCheckChange}
                    handleSwitchCheckChange={handleSwitchCheckChange}
                />
            </PageGroup>
        </Show>
    );
}


function DNSContent({
    settings,
    handleTextCheckChange,
    handleSwitchCheckChange,
}: SettingsSectionProps<FitLauncherDnsConfig>) {

    async function warnDNSSystemConf() {
        const confirm_sys = await confirm(
            "Please remember that you will have to save first and then restart FitLauncher for the changes to be made.\nDo you want to restart now or later? (if you do not restart now, you will have to quit the app from taskbar too).\nKeep in mind that if it makes the app slow down revert to the default settings.",
            { title: 'FitLauncher', kind: 'warning' }
        );
        if (confirm_sys) {
            await exit();
        }
    }

    return (
        <>
            <LabelCheckboxSettings
                text="Use your system's default DNS Settings:"
                checked={settings.system_conf}
                action={async () => {
                    handleSwitchCheckChange?.("dns.system_conf");
                    await warnDNSSystemConf();
                }}
            />

            <LabelInputAddress text="Primary DNS Address" typeText="IpV4" value={settings.primary || "1.1.1.1"}
                action={(e) => handleTextCheckChange?.("dns.primary", e.target.value)}
                disabled={settings.system_conf} />


            <LabelInputAddress text="Secondary DNS Address" typeText="IpV4" value={settings.secondary || "1.0.0.1"}
                action={(e) => handleTextCheckChange?.("dns.secondary", e.target.value)}
                disabled={settings.system_conf} />


        </>
    );
}
