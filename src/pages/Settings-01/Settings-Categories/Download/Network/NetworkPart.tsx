import { JSX } from "solid-js";
import { SettingsSectionProps } from "../../../../../types/settings/types";
import LabelNumericalInput from "../../Components/UI/LabelNumericalInput/LabelNumericalInput";
import PageGroup from "../../Components/PageGroup";
import { Connection } from "../../../../../bindings";

export default function NetworkPart(props: SettingsSectionProps<Connection>): JSX.Element {
    return (
        <PageGroup title="Network Configuration">
            <LabelNumericalInput
                text="Minimum split size"
                typeText="The smallest size a split part of a file can be, by default, in MB"
                value={props.settings()["min-split-size"] || 4}
                onInput={(value) =>
                    props.handleTextCheckChange?.("network.min-split-size", value)
                }
                unit={true}
                isDirty={props.isDirty?.("network.min-split-size")}
                savePulse={props.savePulse?.("network.min-split-size")}
            />

            <LabelNumericalInput
                text="Connect timeout"
                typeText="How long to wait when trying to establish a connection (in seconds)"
                value={props.settings()["connect-timeout"]?.secs ?? 0}
                onInput={(value) =>
                    props.handleTextCheckChange?.("network.connect-timeout", { secs: value, nanos: 0 })
                }
                valueType="Sec"
                isDirty={props.isDirty?.("network.connect-timeout")}
                savePulse={props.savePulse?.("network.connect-timeout")}
            />

            <LabelNumericalInput
                text="Read/write timeout"
                typeText="How long to wait for read/write operations to complete (in seconds)"
                value={props.settings()["rw-timeout"]?.secs || 5}
                onInput={(value) =>
                    props.handleTextCheckChange?.("network.rw-timeout", { secs: value, nanos: 0 })
                }
                valueType="Sec"
                isDirty={props.isDirty?.("network.rw-timeout")}
                savePulse={props.savePulse?.("network.rw-timeout")}
            />

            <LabelNumericalInput
                text="Number of splits per download"
                typeText="How many parts each file will be split into for parallel downloading"
                value={props.settings().split || 4}
                onInput={(value) =>
                    props.handleTextCheckChange?.("network.split", value)
                }
                isDirty={props.isDirty?.("network.split")}
                savePulse={props.savePulse?.("network.split")}
            />

            <LabelNumericalInput
                text="Maximum number of connections per server"
                typeText="Limits how many concurrent connections are allowed per server"
                value={props.settings()["max-connection-per-server"] || 10}
                onInput={(value) =>
                    props.handleTextCheckChange?.("network.max-connection-per-server", value)
                }
                isDirty={props.isDirty?.("network.max-connection-per-server")}
                savePulse={props.savePulse?.("network.max-connection-per-server")}
            />
        </PageGroup>
    );
}
