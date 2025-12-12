import { createSignal, JSX } from "solid-js";
import { SettingsSectionProps } from "../../../../../types/settings/types";
import LabelCheckboxSettings from "../../Components/UI/LabelCheckbox/LabelCheckbox";
import PageGroup from "../../Components/PageGroup";
import LabelTextInputSettings from "../../Components/UI/LabelTextInput/LabelTextInput";
import { General, TransferLimits } from "../../../../../bindings";
import LabelPathInputSettings from "../../Components/UI/LabelPathInput/LabelPathInput";
import LabelNumericalInput from "../../Components/UI/LabelNumericalInput/LabelNumericalInput";

export default function TransferLimitsPart({
    settings,
    handleTextCheckChange,
}: SettingsSectionProps<TransferLimits>): JSX.Element {

    return (
        <PageGroup title="Transfer Limits">
            <LabelNumericalInput
                text="Maximum download rate per download"
                typeText="Each download can have this rate, by default, in KB/sec"
                value={(settings()["max-download"] ?? 0) / 1024}
                onInput={(value) =>
                    handleTextCheckChange?.("limits.max_download", value === 0 ? null : value * 1024)
                }
                zeroIsInfinite
                valueType="KB/S"
                unitPerUnit="s"
                unit
            />

            <LabelNumericalInput
                text="Maximum upload rate per upload"
                typeText="Each upload can have this rate, by default, in KB/sec"
                value={(settings()["max-upload"] ?? 0) / 1024}
                onInput={(value) =>
                    handleTextCheckChange?.("limits.max_upload", value === 0 ? null : value * 1024)
                }
                zeroIsInfinite
                valueType="KB/S"
                unitPerUnit="s"
                unit
            />

            <LabelNumericalInput
                text="Maximum overall download rate"
                typeText="Total download bandwidth limit, by default, in KB/sec"
                value={(settings()["max-overall-download"] ?? 0) / 1024}
                onInput={(value) =>
                    handleTextCheckChange?.("limits.max_overall_download", value === 0 ? null : value * 1024)
                }
                zeroIsInfinite
                valueType="KB/S"
                unitPerUnit="s"
                unit
            />

            <LabelNumericalInput
                text="Maximum overall upload rate"
                typeText="Total upload bandwidth limit, by default, in KB/sec"
                value={(settings()["max-overall-upload"] ?? 0) / 1024}
                onInput={(value) =>
                    handleTextCheckChange?.("limits.max_overall_upload", value === 0 ? null : value * 1024)
                }
                zeroIsInfinite
                valueType="KB/S"
                unitPerUnit="s"
                unit
            />


        </PageGroup>

    );
}