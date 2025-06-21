import TextInput from "../../../../../../components/UI/TextInput/TextInput";
import { SettingsDropdownLabelProps, SettingsTextInputLabelProps } from "../../../../../../types/settings/ui";
import TitleLabel from "../TitleLabel/TitleLabel";

export default function LabelTextInputSettings(props: SettingsTextInputLabelProps) {
    return (
        <li class="flex items-center justify-between py-3 px-4 bg-popup-background hover:bg-secondary-20 rounded-lg border border-secondary-20 transition-colors w-full">
            <TitleLabel text={props.text} typeText={props.typeText} />
            <TextInput value={props.value} disabled={props.disabled} />
        </li>
    )
}