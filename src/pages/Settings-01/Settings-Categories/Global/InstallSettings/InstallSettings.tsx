import { Show } from "solid-js"

import { SettingsSectionProps } from "../../../../../types/settings/types";
import { InstallationSettings } from "../../../../../bindings";
import PageGroup from "../../Components/PageGroup";
import LoadingPage from "../../../../LoadingPage-01/LoadingPage";
import LabelCheckboxSettings from "../../Components/UI/LabelCheckbox/LabelCheckbox";


export default function InstallSettingsPart({ settings, handleSwitchCheckChange }: SettingsSectionProps<InstallationSettings>) {

    return (
        <Show when={settings} fallback={<LoadingPage />}>
            <PageGroup title="Installation Settings">
                <InstallationSettingsContent settings={settings} />
            </PageGroup>
        </Show>
    );
}
function InstallationSettingsContent({ settings, handleSwitchCheckChange }: SettingsSectionProps<InstallationSettings>) {

    return (
        <>
            <LabelCheckboxSettings
                text="Enable Auto-Install"
                typeText="Will install the game directly after downloading"
                checked={settings.auto_install}
                action={() => handleSwitchCheckChange?.("installation_settings.auto_install")}
            />
            <LabelCheckboxSettings
                text="Enable Auto-Clean"
                typeText="Will clean the game's setup after installing and introducing the path in library"
                checked={settings.auto_clean}
                action={() => handleSwitchCheckChange?.("installation_settings.auto_clean")}
            />
            <LabelCheckboxSettings
                text="Enable 2GB Limit for installation"
                typeText="Will be automatically enabled if you have 8GB or less"
                checked={settings.two_gb_limit}
                action={() => handleSwitchCheckChange?.("installation_settings.two_gb_limit")}
            />
            <LabelCheckboxSettings
                text="Enable installation of DirectX"
                typeText="It's only useful once if you have never installed fitgirl repacks"
                checked={settings.directx_install}
                action={() => handleSwitchCheckChange?.("installation_settings.directx_install")}
            />
            <LabelCheckboxSettings
                text="Enable installation of Microsoft C++"
                typeText="It's only useful once if you have never installed fitgirl repacks"
                checked={settings.microsoftcpp_install}
                action={() => handleSwitchCheckChange?.("installation_settings.microsoftcpp_install")}
            />
        </>

    );
}
