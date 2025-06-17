import { action } from "@solidjs/router";
import Button from "../../../../../../components/UI/Button/Button";
import { SettingsButtonLabelProps } from "../../../../../../types/settings/ui";
import TitleLabel from "../TitleLabel/TitleLabel";

export default function LabelButtonSettings(props: SettingsButtonLabelProps) {
    return (
        <li class="flex items-center justify-between py-2 px-4 bg-popup-background hover:bg-secondary-20/30 rounded-lg border border-secondary-20 transition-colors w-full">
            <TitleLabel text={props.text} typeText={props.typeText} />
            <Button
                class="z-40"
                label={props.buttonLabel}
                onClick={async (e: MouseEvent) => {
                    await props.action?.(e);
                }}
                variant="bordered"
                disabled={props.disabled}
            />

        </li>
    );
}