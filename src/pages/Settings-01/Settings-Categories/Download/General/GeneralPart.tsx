import { createSignal, JSX } from "solid-js";
import { SettingsSectionProps } from "../../../../../types/settings/types";
import LabelCheckboxSettings from "../../Components/UI/LabelCheckbox/LabelCheckbox";
import PageGroup from "../../Components/PageGroup";
import LabelTextInputSettings from "../../Components/UI/LabelTextInput/LabelTextInput";
import { General } from "../../../../../bindings";
import LabelPathInputSettings from "../../Components/UI/LabelPathInput/LabelPathInput";
import LabelNumericalInput from "../../Components/UI/LabelNumericalInput/LabelNumericalInput";
import LabelDropdownSettings from "../../Components/UI/LabelDropdown/LabelDropdown";

export default function GeneralSettingsPart({
    settings,
    handleTextCheckChange,
}: SettingsSectionProps<General>): JSX.Element {
    const [path, setPath] = createSignal<string>(settings().download_dir || "");
    const [valid, setValid] = createSignal<boolean>(false);

    return (
        <PageGroup title="Global Configuration">
            <LabelPathInputSettings
                text="Default download path"
                value={path()}
                isDirectory={true}
                isValidPath={valid()}
                onPathChange={(newPath, isValid) => {
                    setPath(newPath);
                    setValid(isValid);
                    if (isValid) {
                        handleTextCheckChange?.("general.download_dir", newPath)
                    }
                }}
            />
            <LabelNumericalInput
                text="Maximum number of concurrent downloads"
                typeText="How many downloads you can run at the same time"
                value={settings().concurrent_downloads || 5}
                onInput={(value) => handleTextCheckChange?.("general.concurrent_downloads", value)}
            />

        </PageGroup>

    );
}