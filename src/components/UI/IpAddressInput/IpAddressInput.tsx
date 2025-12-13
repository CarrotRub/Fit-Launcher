import { createSignal } from "solid-js";
import { IpAddressInputProps } from "../../../types/components/types";
import { getInputBorderClasses } from "../../../helpers/inputStyles";

export default function IpAddressInput(props: IpAddressInputProps) {
    const [isFocused, setIsFocused] = createSignal(false);

    return (
        <div class="relative w-full">
            <input
                type="text"
                class={`w-full bg-background text-text border rounded-md py-2 px-3 
                    focus:outline-none transition-all duration-300
                    ${getInputBorderClasses({ savePulse: props.savePulse, isDirty: props.isDirty, isFocused: isFocused() })}
                    ${props.disabled ? "bg-background-70 text-muted cursor-not-allowed" : ""}`}
                value={props.value}
                onInput={(e) => {
                    // Pass the event to the action handler
                    props.action?.(e);
                }}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                disabled={props.disabled}
                placeholder="0.0.0.0"
            />
        </div>
    );
}