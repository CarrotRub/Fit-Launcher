import { JSX } from "solid-js";
import { FitLauncherConfigDht } from "../../../../../bindings";
import { SettingsSectionProps } from "../../../../../types/settings/types";
import LabelCheckboxSettings from "../../Components/UI/LabelCheckbox/LabelCheckbox";
import PageGroup from "../../Components/PageGroup";
import LabelPathTextSettings from "../../Components/UI/LabelPathText/LabelPathText";

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
            <LabelPathTextSettings
                text="DHT Persistence File Path"
                path={settings().persistence_filename}
            />
        </PageGroup>

    );
}