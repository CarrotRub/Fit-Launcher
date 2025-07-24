import Button from "../../../../../../components/UI/Button/Button";
import Dropdown from "../../../../../../components/UI/Dropdown/Dropdown";

import { SettingsDropdownLabelProps } from "../../../../../../types/settings/ui";
import TitleLabel from "../TitleLabel/TitleLabel";

export default function LabelDropdownSettings(props: SettingsDropdownLabelProps) {
    return (
        <li class="flex items-center justify-between py-3 px-4 bg-popup-background hover:bg-secondary-20 rounded-lg border border-secondary-20 transition-colors w-full">
            <TitleLabel text={props.text} typeText={props.typeText} />
            <div class="flex gap-2">
                <Dropdown
                    {...props}
                />
                <Button class="h-min w-fit px-2" label="+" onClick={(e) => props.action?.(e)} variant={props.variants} disabled={props.disabled} />
            </div>
        </li>
    );
}
