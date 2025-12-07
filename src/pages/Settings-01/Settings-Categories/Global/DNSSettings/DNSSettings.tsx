import { Show } from "solid-js"

import { FitLauncherDnsConfig } from "../../../../../bindings";
import { SettingsSectionProps } from "../../../../../types/settings/types";
import PageGroup from "../../Components/PageGroup";
import LabelCheckboxSettings from "../../Components/UI/LabelCheckbox/LabelCheckbox";
import LoadingPage from "../../../../LoadingPage-01/LoadingPage";
import LabelInputAddress from "../../Components/UI/LabelInputAddress/LabelInputAddress";

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
    return (
        <>
            <LabelCheckboxSettings
                text="Use your system's default DNS Settings:"
                checked={settings().system_conf}
                action={() => handleSwitchCheckChange?.("dns.system_conf")}
            />

            <LabelInputAddress text="Primary DNS Address" typeText="IpV4" value={settings()?.primary || "1.1.1.1"}
                action={(e) => handleTextCheckChange?.("dns.primary", e.target.value)}
                disabled={settings().system_conf} />


            <LabelInputAddress text="Secondary DNS Address" typeText="IpV4" value={settings().secondary || "1.0.0.1"}
                action={(e) => handleTextCheckChange?.("dns.secondary", e.target.value)}
                disabled={settings().system_conf} />


        </>
    );
}
