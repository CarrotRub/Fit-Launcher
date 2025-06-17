import { SettingsInputAddressLabelProps } from "../../../../../../types/settings/ui";

export default function LabelInputAddress(props: SettingsInputAddressLabelProps) {
    return (
        <li class="flex flex-col gap-2 py-3 px-4 bg-popup-background rounded-lg border border-secondary-20">
            <span class="text-text/80 text-sm">
                {props.text}  {<i class="text-muted "><small>{props.typeText}</small></i>} :
            </span>
            <div class="relative">
                <input
                    type="text"
                    class="w-full bg-background text-text border border-secondary-20 rounded-md py-2 px-3 focus:outline-none focus:ring-1 focus:ring-accent disabled:bg-background-70 disabled:text-muted"
                    value={props.value}
                    onInput={(e) => props.action?.("dns.primary", e.target.value)}
                    disabled={props.disabled}
                />
            </div>
        </li>
    )
}