import { JSX } from "solid-js";
import { FitLauncherConfigDht } from "../../../../../bindings";
import { SettingsSectionProps } from "../../../../../types/settings/types";
import LabelCheckboxSettings from "../../Components/UI/LabelCheckbox/LabelCheckbox";
import PageGroup from "../../Components/PageGroup";
import LabelTextInputSettings from "../../Components/UI/LabelTextInput/LabelTextInput";

export default function DHTPart({
    settings,
    handleSwitchCheckChange,
}: SettingsSectionProps<FitLauncherConfigDht>): JSX.Element {
    return (
        <PageGroup title="DHT">
            <LabelCheckboxSettings
                text="Disable DHT"
                checked={settings().disable}
                action={() => handleSwitchCheckChange?.("dht.disable")}
            />
            <LabelCheckboxSettings
                text="Disable DHT Persistence"
                checked={settings().disable_persistence}
                action={() => handleSwitchCheckChange?.("dht.disable_persistence")}
            />
            <LabelTextInputSettings
                text="DHT Persistence File Path"
                value={settings().persistence_filename}
                disabled={true}
            />
        </PageGroup>

    );
}