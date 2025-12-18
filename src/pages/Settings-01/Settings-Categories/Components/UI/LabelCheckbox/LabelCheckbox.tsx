import Checkbox from "../../../../../../components/UI/Checkbox/Checkbox";
import { SettingsCheckboxLabelProps } from "../../../../../../types/settings/ui";
import TitleLabel from "../TitleLabel/TitleLabel";

export default function LabelCheckboxSettings(props: SettingsCheckboxLabelProps) {
    return (
        <li class="flex items-center justify-between py-3 px-4 bg-popup-background hover:bg-secondary-20 rounded-lg border border-secondary-20 transition-colors w-full">
            <TitleLabel text={props.text} typeText={props.typeText} />
            <Checkbox checked={props.checked} action={props.action} />
        </li>
    );
}
