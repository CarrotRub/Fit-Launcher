import type { JSX } from "solid-js";
import { SettingsSectionProps } from "../../../../../types/settings/types";
import PageGroup from "../../Components/PageGroup";
import { TransferLimits } from "../../../../../bindings";
import LabelNumericalInput from "../../Components/UI/LabelNumericalInput/LabelNumericalInput";

export default function TransferLimitsPart(props: SettingsSectionProps<TransferLimits>): JSX.Element {
    return (
        <PageGroup title="Transfer Limits">
            <LabelNumericalInput
                text="Maximum download rate per download"
                typeText="Each download can have this rate (0 = unlimited)"
                value={props.settings()["max-download"] ?? 0}
                onInput={(bytes) =>
                    props.handleTextCheckChange?.("limits.max-download", bytes === 0 ? null : bytes)
                }
                unit
                isDirty={props.isDirty?.("limits.max-download")}
                savePulse={props.savePulse?.("limits.max-download")}
            />

            <LabelNumericalInput
                text="Maximum upload rate per upload"
                typeText="Each upload can have this rate (0 = unlimited)"
                value={props.settings()["max-upload"] ?? 0}
                onInput={(bytes) =>
                    props.handleTextCheckChange?.("limits.max-upload", bytes === 0 ? null : bytes)
                }
                unit
                isDirty={props.isDirty?.("limits.max-upload")}
                savePulse={props.savePulse?.("limits.max-upload")}
            />

            <LabelNumericalInput
                text="Maximum overall download rate"
                typeText="Total download bandwidth limit (0 = unlimited)"
                value={props.settings()["max-overall-download"] ?? 0}
                onInput={(bytes) =>
                    props.handleTextCheckChange?.("limits.max-overall-download", bytes === 0 ? null : bytes)
                }
                unit
                isDirty={props.isDirty?.("limits.max-overall-download")}
                savePulse={props.savePulse?.("limits.max-overall-download")}
            />

            <LabelNumericalInput
                text="Maximum overall upload rate"
                typeText="Total upload bandwidth limit (0 = unlimited)"
                value={props.settings()["max-overall-upload"] ?? 0}
                onInput={(bytes) =>
                    props.handleTextCheckChange?.("limits.max-overall-upload", bytes === 0 ? null : bytes)
                }
                unit
                isDirty={props.isDirty?.("limits.max-overall-upload")}
                savePulse={props.savePulse?.("limits.max-overall-upload")}
            />
        </PageGroup>
    );
}