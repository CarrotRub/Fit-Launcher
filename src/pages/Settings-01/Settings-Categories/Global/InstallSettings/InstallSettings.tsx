import { Show } from "solid-js";
import { SettingsSectionProps } from "../../../../../types/settings/types";
import { InstallationSettings } from "../../../../../bindings";
import PageGroup from "../../Components/PageGroup";
import LoadingPage from "../../../../LoadingPage-01/LoadingPage";
import LabelCheckboxSettings from "../../Components/UI/LabelCheckbox/LabelCheckbox";

/**
 * Installation settings component.
 * Following SolidJS best practices: props accessed as props.X, not destructured.
 */
export default function InstallSettingsPart(props: SettingsSectionProps<InstallationSettings>) {
    return (
        <Show when={props.settings} fallback={<LoadingPage />}>
            <PageGroup title="Installation Settings">
                <LabelCheckboxSettings
                    text="Enable Auto-Install"
                    typeText="Will install the game directly after downloading"
                    checked={props.settings().auto_install}
                    action={() => props.handleSwitchCheckChange?.("installation_settings.auto_install")}
                />
                <LabelCheckboxSettings
                    text="Enable Auto-Clean"
                    typeText="Will clean the game's setup after installing and introducing the path in library"
                    checked={props.settings().auto_clean}
                    action={() => props.handleSwitchCheckChange?.("installation_settings.auto_clean")}
                />
                <LabelCheckboxSettings
                    text="Enable 2GB Limit for installation"
                    typeText="Will be automatically enabled if you have 8GB or less"
                    checked={props.settings().two_gb_limit}
                    action={() => props.handleSwitchCheckChange?.("installation_settings.two_gb_limit")}
                />
                <LabelCheckboxSettings
                    text="Enable installation of DirectX"
                    typeText="It's only useful once if you have never installed fitgirl repacks"
                    checked={props.settings().directx_install}
                    action={() => props.handleSwitchCheckChange?.("installation_settings.directx_install")}
                />
                <LabelCheckboxSettings
                    text="Enable installation of Microsoft C++"
                    typeText="It's only useful once if you have never installed fitgirl repacks"
                    checked={props.settings().microsoftcpp_install}
                    action={() => props.handleSwitchCheckChange?.("installation_settings.microsoftcpp_install")}
                />
            </PageGroup>
        </Show>
    );
}
