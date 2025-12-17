import { createSignal } from "solid-js";
import { RangeSliderProps } from "../../../types/components/types";


export default function RangeSlider(props: RangeSliderProps) {
    const [isActive, setIsActive] = createSignal(false);

    return (
        <div class={`flex items-center gap-4 w-full ${props.class || ""}`}>
            <div class="relative flex-1 group">
                {/* Track Line */}
                <div class="h-1.5 w-full rounded-full bg-secondary-20/50 overflow-hidden">
                    {/* Progress Fill */}
                    <div
                        class="h-full bg-accent rounded-full absolute top-0 left-0"
                        style={{
                            width: `${(props.value - (props.min || 0)) / ((props.max || 50) - (props.min || 0)) * 100}%`
                        }}
                    />
                </div>

                {/* Thumb Handle */}
                <input
                    type="range"
                    min={props.min || 0}
                    max={props.max || 50}
                    step={props.step || 1}
                    value={props.value}
                    onInput={(e) => props.onInput(parseFloat(e.currentTarget.value))}
                    onMouseDown={() => setIsActive(true)}
                    onMouseUp={() => setIsActive(false)}
                    class={`
            absolute top-1/2 left-0 w-full h-4 -translate-y-1/2
            appearance-none bg-transparent cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-accent
            [&::-webkit-slider-thumb]:border-2
            [&::-webkit-slider-thumb]:border-background
            [&::-webkit-slider-thumb]:shadow-lg
            [&::-webkit-slider-thumb]:transition-all
            [&::-webkit-slider-thumb]:duration-200
            ${isActive() ?
                            "[&::-webkit-slider-thumb]:scale-125 [&::-webkit-slider-thumb]:shadow-accent/30" :
                            "[&::-webkit-slider-thumb]:scale-100 [&::-webkit-slider-thumb]:shadow-accent/20"}
          `}
                />
            </div>

            {/* Value Display */}
            <div class={`
        flex items-center justify-center min-w-[2.5rem] px-2 py-1 
        rounded-md text-sm font-medium
        bg-background-70 border border-secondary-20
        transition-colors duration-200
        ${isActive() ? "text-accent" : "text-text/80"}
      `}>
                {props.value}
            </div>
        </div>
    );
}
