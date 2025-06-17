import { JSX } from "solid-js";
import { FitLauncherConfigPeerOpts, FitLauncherConfigTcpListen } from "../../../../../bindings";
import { SettingsSectionProps } from "../../../../../types/settings/types";
import PageGroup from "../../Components/PageGroup";
import LabelCheckboxSettings from "../../Components/UI/LabelCheckbox/LabelCheckbox";
import LabelNumericalInput from "../../Components/UI/LabelNumericalInput/LabelNumericalInput";

export default function PeerOptsPart({
    settings,
    handleTextCheckChange,
}: SettingsSectionProps<FitLauncherConfigPeerOpts>): JSX.Element {
    return (
        <PageGroup title="Peers Options">
            <LabelNumericalInput
                text="Connect Timeout"
                value={settings().connect_timeout.secs}
                min={0}
                onInput={(value) => handleTextCheckChange?.("peer_opts.connect_timeout", value)}
            />
            <LabelNumericalInput
                text="TCP Maximum Port"
                value={settings().read_write_timeout.secs}
                min={0}
                onInput={(value) => handleTextCheckChange?.("peer_opts.read_write_timeout", value)}
            />
        </PageGroup>

    );
}