import { createSignal, JSX, createEffect } from "solid-js";
import { SettingsSectionProps } from "../../../../../types/settings/types";
import PageGroup from "../../Components/PageGroup";
import { General } from "../../../../../bindings";
import LabelPathInputSettings from "../../Components/UI/LabelPathInput/LabelPathInput";
import LabelNumericalInput from "../../Components/UI/LabelNumericalInput/LabelNumericalInput";
import LabelCheckboxSettings from "../../Components/UI/LabelCheckbox/LabelCheckbox";

export default function GeneralSettingsPart(props: SettingsSectionProps<General>): JSX.Element {
    const [path, setPath] = createSignal<string>("");
    const [valid, setValid] = createSignal<boolean>(false);

    // Sync path from props on initial load
    createEffect(() => {
        const downloadDir = props.settings().download_dir;
        if (downloadDir && !path()) {
            setPath(downloadDir);
            setValid(true);
        }
    });

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
                        props.handleTextCheckChange?.("general.download_dir", newPath);
                    }
                }}
            />
            <LabelNumericalInput
                text="Maximum number of concurrent downloads"
                typeText="How many downloads you can run at the same time"
                value={props.settings().concurrent_downloads || 5}
                onInput={(value) => props.handleTextCheckChange?.("general.concurrent_downloads", value)}
                isDirty={props.isDirty?.("general.concurrent_downloads")}
                savePulse={props.savePulse?.("general.concurrent_downloads")}
            />
            <LabelCheckboxSettings
                text="Exclude app folders from Windows Defender"
                typeText="Automatically adds FitLauncher download directory to Windows Defender exclusions to prevent errors and false positives."
                action={() => props.handleSwitchCheckChange?.("general.folder_exclusion")}
                checked={props.settings().folder_exclusion}
            />
            <LabelCheckboxSettings
                text="Automatically clean up Windows Defender exclusions"
                typeText="Removes FitLauncher folders from Windows Defender exclusions when they are no longer used or have been deleted."
                action={() => props.handleSwitchCheckChange?.("general.folder_exclusion_cleanup")}
                checked={props.settings().folder_exclusion_cleanup}
            />

        </PageGroup>
    );
}