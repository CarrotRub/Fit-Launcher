import { createSignal } from "solid-js";
import { IpAddressInputProps } from "../../../types/components/types";
import { getInputBorderClasses } from "../../../helpers/inputStyles";

export default function IpAddressInput(props: IpAddressInputProps) {
    const [isFocused, setIsFocused] = createSignal(false);

    const handleInput = (e: InputEvent) => {
        const raw = (e.currentTarget as HTMLInputElement).value;
        // Only allow digits and dots for IP addresses
        const filtered = raw.replace(/[^0-9.]/g, '');

        // Update the input value to filtered version
        (e.currentTarget as HTMLInputElement).value = filtered;

        // Create a new event-like object with the filtered value
        const filteredEvent = {
            ...e,
            target: { ...e.target, value: filtered } as EventTarget & HTMLInputElement,
            currentTarget: e.currentTarget
        } as InputEvent;

        props.action?.(filteredEvent);
    };

    return (
        <div class="relative w-full">
            <input
                type="text"
                class={`w-full bg-background text-text border rounded-md py-2 px-3 
                    focus:outline-none transition-all duration-300
                    ${getInputBorderClasses({ savePulse: props.savePulse, isDirty: props.isDirty, isFocused: isFocused() })}
                    ${props.disabled ? "bg-background-70 text-muted cursor-not-allowed" : ""}`}
                value={props.value}
                onInput={handleInput}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                disabled={props.disabled}
                placeholder="0.0.0.0"
            />
        </div>
    );
}