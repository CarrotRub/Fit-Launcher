import { action } from "@solidjs/router";
import Button from "../../../../../../components/UI/Button/Button";
import { SettingsButtonLabelProps } from "../../../../../../types/settings/ui";

export default function LabelButtonSettings(props: SettingsButtonLabelProps) {
    return (
        <li class="flex items-center justify-between py-2 px-4 bg-popup-background hover:bg-secondary-20/30 rounded-lg border border-secondary-20 transition-colors w-full">
            <span class="text-text font-medium flex flex-col">
                {props.text}
                {<i class="text-muted ml-2"><small>{props.typeText}</small></i>}
            </span>
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