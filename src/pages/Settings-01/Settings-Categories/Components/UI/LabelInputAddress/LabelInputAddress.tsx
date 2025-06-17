import IpAddressInput from "../../../../../../components/UI/IpAddressInput/IpAddressInput";
import { SettingsInputAddressLabelProps } from "../../../../../../types/settings/ui";
import TitleLabel from "../TitleLabel/TitleLabel";

export default function LabelInputAddress(props: SettingsInputAddressLabelProps) {
    return (
        <li class="flex flex-col gap-2 py-3 px-4 bg-popup-background rounded-lg border border-secondary-20">
            <TitleLabel text={props.text} typeText={props.typeText} />
            <IpAddressInput value={props.value} onInput={props.onInput} disabled={props.disabled} />
        </li>
    )
}