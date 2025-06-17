import { JSX } from "solid-js";
import { FitLauncherConfigTcpListen } from "../../../../../bindings";
import { SettingsSectionProps } from "../../../../../types/settings/types";
import PageGroup from "../../Components/PageGroup";
import LabelCheckboxSettings from "../../Components/UI/LabelCheckbox/LabelCheckbox";
import LabelNumericalInput from "../../Components/UI/LabelNumericalInput/LabelNumericalInput";

export default function TCPPart({
    settings,
    handleSwitchCheckChange,
    handleTextCheckChange,
}: SettingsSectionProps<FitLauncherConfigTcpListen>): JSX.Element {
    return (
        <PageGroup title="TCP">
            <LabelCheckboxSettings
                text="Disable TCP"
                checked={settings().disable}
                action={() => handleSwitchCheckChange?.("tcp_listen.disable")}
            />
            <LabelNumericalInput
                text="TCP Minimum Port"
                value={settings().min_port}
                min={0}
                max={65535}
                onInput={(value) => handleTextCheckChange?.("tcp_listen.min_port", value)}
            />
            <LabelNumericalInput
                text="TCP Maximum Port"
                value={settings().max_port}
                min={0}
                max={65535}
                onInput={(value) => handleTextCheckChange?.("tcp_listen.max_port", value)}
            />
        </PageGroup>

    );
}