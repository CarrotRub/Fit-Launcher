import { JSX } from "solid-js";
import { FitLauncherConfigPersistence } from "../../../../../bindings";
import { SettingsSectionProps } from "../../../../../types/settings/types";
import PageGroup from "../../Components/PageGroup";
import LabelCheckboxSettings from "../../Components/UI/LabelCheckbox/LabelCheckbox";
import LabelTextInputSettings from "../../Components/UI/LabelTextInput/LabelTextInput";

export default function DHTPart({
    settings,
    handleSwitchCheckChange,
}: SettingsSectionProps<FitLauncherConfigPersistence>): JSX.Element {
    return (
        <PageGroup title="Session Persistence">
            <LabelCheckboxSettings
                text="Disable Session Persistence"
                checked={settings().disable}
                action={() => handleSwitchCheckChange?.("persistence.disable")}
            />
            <LabelCheckboxSettings
                text="Enable FastResume"
                checked={settings().fastresume || false}
                action={() => handleSwitchCheckChange?.("persistence.fastresume")}
            />
            <LabelTextInputSettings
                text="Session Persistence Path"
                value={settings().folder || "No persistence path"}
                disabled={true}
            />
        </PageGroup>

    );
}