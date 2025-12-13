import { createSignal, createEffect, on } from "solid-js";
import { NumericalInputProps } from "../../../types/components/types";

export default function NumericalInput(props: NumericalInputProps) {
    const [isFocused, setIsFocused] = createSignal(false);
    const [localValue, setLocalValue] = createSignal<string>("");

    // Sync from props only when NOT focused
    createEffect(on(
        () => props.value,
        (value) => {
            if (!isFocused()) {
                setLocalValue(String(value ?? 0));
            }
        },
        { defer: false }
    ));

    const handleInput = (e: InputEvent) => {
        const raw = (e.currentTarget as HTMLInputElement).value;
        setLocalValue(raw); // Update local state immediately

        const value = parseFloat(raw);
        if (!isNaN(value)) {
            props.onInput(value);
        }
    };

    const handleFocus = () => {
        setIsFocused(true);
    };

    const handleBlur = () => {
        setIsFocused(false);
        // Sync back from props on blur to ensure consistency
        setLocalValue(String(props.value ?? 0));
    };

    const increment = () => {
        const step = props.step ?? 1;
        const newValue = (props.value ?? 0) + step;
        const maxBound = props.max !== undefined ? Math.min(newValue, props.max) : newValue;
        props.onInput(maxBound);
    };

    const decrement = () => {
        const step = props.step ?? 1;
        const newValue = (props.value ?? 0) - step;
        const minBound = props.min !== undefined ? Math.max(newValue, props.min) : newValue;
        props.onInput(Math.max(0, minBound));
    };

    return (
        <div class={`relative ${props.class || ""}`}>
            <div class={`
                relative overflow-hidden rounded-lg border
                transition-all duration-200 flex items-center
                ${isFocused() ? "border-accent ring-2 ring-accent/20" : "border-secondary-20"}
              bg-background-70
            `}>
                <input
                    type="text"
                    inputmode="numeric"
                    value={localValue()}
                    onInput={handleInput}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    class={`
                      flex-1 py-2.5 pr-2 pl-4 bg-transparent
                      text-text placeholder:text-muted/60
                      focus:outline-none appearance-none
                      [&::-webkit-inner-spin-button]:appearance-none
                      [&::-webkit-outer-spin-button]:appearance-none
                    `}
                />

                {/* Optional valueType label */}
                {props.valueType && (
                    <div class="pr-10 text-muted text-sm whitespace-nowrap">
                        {props.valueType}
                    </div>
                )}

                {/* Stepper Controls */}
                <div class={`
                    absolute right-0 top-0 h-full flex flex-col
                    border-l border-secondary-20
                    transition-opacity duration-150
                    opacity-100
                `}>
                    <button
                        onClick={increment}
                        onMouseDown={(e) => e.preventDefault()}
                        class={`
                          flex-1 px-2 flex items-center justify-center
                          hover:bg-secondary-20/30
                          transition-colors duration-100
                        `}
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" class="text-muted">
                            <path fill="currentColor" d="M7 14l5-5 5 5z" />
                        </svg>
                    </button>
                    <div class="border-t border-secondary-20/50"></div>
                    <button
                        onClick={decrement}
                        onMouseDown={(e) => e.preventDefault()}
                        class={`
                          flex-1 px-2 flex items-center justify-center
                          hover:bg-secondary-20/30
                          transition-colors duration-100
                        `}
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" class="text-muted">
                            <path fill="currentColor" d="M7 10l5 5 5-5z" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Focus Glow */}
            <div class={`
                absolute inset-0 -z-10 rounded-lg
                bg-gradient-to-r from-accent/10 to-primary/10
                opacity-0 transition-opacity duration-300
                ${isFocused() ? "opacity-100" : ""}
            `} />
        </div>
    );
}
