import { JSX } from "solid-js";
import { SettingsSectionProps } from "../../../../../types/settings/types";
import LabelCheckboxSettings from "../../Components/UI/LabelCheckbox/LabelCheckbox";
import PageGroup from "../../Components/PageGroup";
import LabelTextInputSettings from "../../Components/UI/LabelTextInput/LabelTextInput";
import { FitLauncherConfigAria2 } from "../../../../../bindings";
import LabelNumericalInput from "../../Components/UI/LabelNumericalInput/LabelNumericalInput";

export default function AriaPart(props: SettingsSectionProps<FitLauncherConfigAria2>): JSX.Element {
    return (
        <PageGroup title="Aria2 RPC Settings">
            <LabelNumericalInput
                text="Aria2C Port Number"
                typeText="Port on which the Aria2 RPC interface will listen"
                value={props.settings().port}
                onInput={(value) => props.handleTextCheckChange?.("rpc.port", value)}
            />

            <LabelTextInputSettings
                text="Token"
                typeText="Authentication token used to secure RPC access"
                value={props.settings().token || ""}
                onInput={(value: string) => props.handleTextCheckChange?.("rpc.token", value)}
            />
            <LabelCheckboxSettings
                text="Start Daemon"
                typeText="Whether to automatically start the aria2 daemon"
                action={() => props.handleSwitchCheckChange?.("rpc.start_daemon")}
                checked={props.settings().start_daemon}
            />
        </PageGroup>
    );
}