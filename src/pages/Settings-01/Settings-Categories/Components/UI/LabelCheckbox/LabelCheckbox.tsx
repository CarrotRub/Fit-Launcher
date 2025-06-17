import { SettingsTypes } from "../../../../../../types/settings/types";
import { SettingsCheckboxLabelProps, SettingsLabelProps } from "../../../../../../types/settings/ui";

export default function LabelCheckboxSettings(props: SettingsCheckboxLabelProps) {
    return (
        <li class="flex items-center justify-between py-3 px-4 bg-popup-background hover:bg-secondary-20 rounded-lg border border-secondary-20 transition-colors w-full">
            <span class="text-text font-medium flex flex-col">
                {props.text}
                {<i class="text-muted ml-2"><small>{props.typeText}</small></i>}
            </span>
            <label class="relative inline-flex items-center cursor-pointer">
                <input
                    type="checkbox"
                    class="sr-only peer"
                    checked={props.checked}
                    onChange={async () => {
                        const result = props.action?.();
                        if (result instanceof Promise) {
                            await result;
                        }
                    }}
                />
                <div class="w-11 h-6 bg-secondary-20 peer-focus:outline-none peer-focus:ring-1 peer-focus:ring-accent rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-accent after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-text after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
            </label>
        </li>
    );
}
