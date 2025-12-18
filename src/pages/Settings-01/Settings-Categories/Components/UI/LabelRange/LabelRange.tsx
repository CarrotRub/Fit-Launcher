import RangeSlider from "../../../../../../components/UI/RangeSlider/RangeSlider";
import { SettingsRangeLabelProps } from "../../../../../../types/settings/ui";
import TitleLabel from "../TitleLabel/TitleLabel";

export default function LabelRangeSettings(props: SettingsRangeLabelProps) {
    return (
        <li class="flex flex-col gap-2 py-3 px-4 bg-popup-background rounded-lg border border-secondary-20">
            <TitleLabel text={props.text} typeText={props.typeText} />
            <RangeSlider
                {...props}
            />
        </li>
    )
}