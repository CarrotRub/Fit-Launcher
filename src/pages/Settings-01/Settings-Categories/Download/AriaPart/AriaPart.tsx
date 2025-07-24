import { createSignal, JSX } from "solid-js";
import { SettingsSectionProps } from "../../../../../types/settings/types";
import LabelCheckboxSettings from "../../Components/UI/LabelCheckbox/LabelCheckbox";
import PageGroup from "../../Components/PageGroup";
import LabelTextInputSettings from "../../Components/UI/LabelTextInput/LabelTextInput";
import { FitLauncherConfigAria2, General } from "../../../../../bindings";
import LabelPathInputSettings from "../../Components/UI/LabelPathInput/LabelPathInput";
import LabelNumericalInput from "../../Components/UI/LabelNumericalInput/LabelNumericalInput";

export default function AriaPart({
    settings,
    handleSwitchCheckChange,
    handleTextCheckChange,
}: SettingsSectionProps<FitLauncherConfigAria2>): JSX.Element {
    return (
        <PageGroup title="Aria2 RPC Settings">
            <LabelNumericalInput
                text="Aria2C Port Number"
                typeText="Port on which the Aria2 RPC interface will listen"
                value={settings().port}
                onInput={(value) => handleTextCheckChange?.("rpc.port", value.valueOf())}
            />

            <LabelTextInputSettings
                text="Token"
                typeText="Authentication token used to secure RPC access"
                value={settings().token || ""}
                onInput={(value: string) => handleTextCheckChange?.("rpc.token", value)}
            />
            <LabelCheckboxSettings
                text="Start Daemon"
                typeText="Whether to automatically start the aria2 daemon"
                action={() => handleSwitchCheckChange?.("rpc.start_daemon")}
                checked={settings().start_daemon}
            />
        </PageGroup>


    );
}