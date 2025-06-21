import { createSignal, JSX } from "solid-js";
import { NumericalInputProps } from "../../../types/components/types";


export default function NumericalInput(props: NumericalInputProps) {
    const [isFocused, setIsFocused] = createSignal(false);
    const [isHovered, setIsHovered] = createSignal(false);

    const handleChange = (e: InputEvent) => {
        const raw = (e.currentTarget as HTMLInputElement).value;

        if (props.zeroIsInfinite && raw === "∞") {
            props.onInput(0);
            return;
        }

        const value = parseFloat(raw);
        if (!isNaN(value)) {
            props.onInput(value);
        }
    };

    const displayValue = () => {
        if (props.zeroIsInfinite && props.value === 0 && !isFocused()) {
            return "∞";
        }
        return props.value;
    };

    return (
        <div class={`relative ${props.class || ""}`}>
            <div class={`
                relative overflow-hidden rounded-lg border
                transition-all duration-200 flex items-center
                ${isFocused() ? "border-accent ring-2 ring-accent/20" : "border-secondary-20"}
                ${isHovered() ? "bg-background-70" : "bg-background"}
            `}>
                <input
                    type="text"
                    value={displayValue()}
                    onInput={handleChange}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
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
                    absolute right-[2px] top-0 h-full flex flex-col
                    border-l border-secondary-20
                    transition-opacity duration-150
                    ${isHovered() || isFocused() ? "opacity-100" : "opacity-0"}
                `}>
                    <button
                        onClick={() => props.onInput(props.value + (props.step || 1))}
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
                        onClick={() => props.onInput(props.value - (props.step || 1))}
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
