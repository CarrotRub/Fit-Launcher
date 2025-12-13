import { Show } from "solid-js";
import { FitLauncherDnsConfig } from "../../../../../bindings";
import { SettingsSectionProps } from "../../../../../types/settings/types";
import PageGroup from "../../Components/PageGroup";
import LabelCheckboxSettings from "../../Components/UI/LabelCheckbox/LabelCheckbox";
import LoadingPage from "../../../../LoadingPage-01/LoadingPage";
import LabelInputAddress from "../../Components/UI/LabelInputAddress/LabelInputAddress";

export default function DNSPart(props: SettingsSectionProps<FitLauncherDnsConfig>) {
    return (
        <Show when={props.settings} fallback={<LoadingPage />}>
            <PageGroup title="DNS Settings">
                <LabelCheckboxSettings
                    text="Use your system's default DNS Settings:"
                    checked={props.settings().system_conf}
                    action={() => props.handleSwitchCheckChange?.("dns.system_conf")}
                />

                <LabelInputAddress
                    text="Primary DNS Address"
                    typeText="IPv4"
                    value={props.settings()?.primary || "1.1.1.1"}
                    action={(e) => props.handleTextCheckChange?.("dns.primary", e.target.value)}
                    disabled={props.settings().system_conf}
                    isDirty={props.isDirty?.("dns.primary")}
                    savePulse={props.savePulse?.("dns.primary")}
                />

                <LabelInputAddress
                    text="Secondary DNS Address"
                    typeText="IPv4"
                    value={props.settings().secondary || "1.0.0.1"}
                    action={(e) => props.handleTextCheckChange?.("dns.secondary", e.target.value)}
                    disabled={props.settings().system_conf}
                    isDirty={props.isDirty?.("dns.secondary")}
                    savePulse={props.savePulse?.("dns.secondary")}
                />
            </PageGroup>
        </Show>
    );
}
