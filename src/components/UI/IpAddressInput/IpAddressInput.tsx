import { IpAddressInputProps } from "../../../types/components/types";
import { SettingsButtonLabelProps } from "../../../types/settings/ui";

export default function IpAddressInput(props: IpAddressInputProps) {
    return (
        <input
            type="text"
            class="w-full bg-background text-text border border-secondary-20 rounded-md py-2 px-3 focus:outline-none focus:ring-1 focus:ring-accent disabled:bg-background-70 disabled:text-muted"
            value={props.value}
            onInput={(e) => {
                const val = Number(e.currentTarget.value);
                if (!isNaN(val)) props.onInput?.(val);
            }}
            disabled={props.disabled}
        />
    )
}