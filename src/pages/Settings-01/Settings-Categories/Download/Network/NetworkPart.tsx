import { JSX, onMount } from "solid-js";
import { SettingsSectionProps } from "../../../../../types/settings/types";
import LabelNumericalInput from "../../Components/UI/LabelNumericalInput/LabelNumericalInput";
import PageGroup from "../../Components/PageGroup";
import { Connection } from "../../../../../bindings";

export default function NetworkPart({
    settings,
    handleTextCheckChange,
}: SettingsSectionProps<Connection>): JSX.Element {
    onMount(() => {
        console.log("connect_timeout: ", settings().connect_timeout, " rw_timeout: ", settings().rw_timeout)
    })
    return (
        <PageGroup title="Network Configuration">
            <LabelNumericalInput
                text="Minimum split size"
                typeText="The smallest size a split part of a file can be (in MB)"
                value={settings().min_split_size || 4}
                onInput={(value) =>
                    handleTextCheckChange?.("general.min_split_size", value)
                }
                unit={true}
            />

            <LabelNumericalInput
                text="Connect timeout"
                typeText="How long to wait when trying to establish a connection (in seconds)"
                value={settings().connect_timeout?.secs}
                onInput={(value) =>
                    handleTextCheckChange?.("general.connect_timeout", { secs: value, nanos: 0 })
                }
                valueType="Sec"
            />

            <LabelNumericalInput
                text="Read/write timeout"
                typeText="How long to wait for read/write operations to complete (in seconds)"
                value={settings().rw_timeout?.secs}
                onInput={(value) =>
                    handleTextCheckChange?.("general.rw_timeout", { secs: value, nanos: 0 })
                }
                valueType="Sec"
            />

            <LabelNumericalInput
                text="Number of splits per download"
                typeText="How many parts each file will be split into for parallel downloading"
                value={settings().split || 4}
                onInput={(value) =>
                    handleTextCheckChange?.("general.split", value)
                }
            />

            <LabelNumericalInput
                text="Maximum number of connections per server"
                typeText="Limits how many concurrent connections are allowed per server"
                value={settings().max_connection_per_server || 10}
                onInput={(value) =>
                    handleTextCheckChange?.("general.max_connection_per_server", value)
                }
            />


        </PageGroup>
    );
}
