import { createSignal, createEffect, JSX } from "solid-js";
import { DualRangeSliderProps } from "../../../types/components/types";

export default function DualRangeSlider(props: DualRangeSliderProps): JSX.Element {
  const [isDraggingMin, setIsDraggingMin] = createSignal(false);
  const [isDraggingMax, setIsDraggingMax] = createSignal(false);

  const step = () => props.step ?? 1;

  const formatValue = (value: number) => {
    if (props.formatValue) {
      return props.formatValue(value);
    }
    return value.toString();
  };

  const getPercentage = (value: number) => {
    return ((value - props.min) / (props.max - props.min)) * 100;
  };

  const handleMinChange = (e: Event) => {
    const target = e.currentTarget as HTMLInputElement;
    const newValue = parseFloat(target.value);
    // Ensure min doesn't exceed max
    if (newValue <= props.maxValue) {
      props.onMinChange(newValue);
    }
  };

  const handleMaxChange = (e: Event) => {
    const target = e.currentTarget as HTMLInputElement;
    const newValue = parseFloat(target.value);
    // Ensure max doesn't go below min
    if (newValue >= props.minValue) {
      props.onMaxChange(newValue);
    }
  };

  return (
    <div class={`flex flex-col gap-2 w-full ${props.class || ""}`}>
      {props.label && (
        <label class="text-sm font-medium text-muted">{props.label}</label>
      )}

      <div class="relative flex items-center h-6">
        {/* Track background */}
        <div class="absolute h-1.5 w-full rounded-full bg-secondary-20/50" />

        {/* Active range highlight */}
        <div
          class="absolute h-1.5 bg-accent rounded-full"
          style={{
            left: `${getPercentage(props.minValue)}%`,
            width: `${getPercentage(props.maxValue) - getPercentage(props.minValue)}%`,
          }}
        />

        {/* Min slider */}
        <input
          type="range"
          min={props.min}
          max={props.max}
          step={step()}
          value={props.minValue}
          onInput={handleMinChange}
          onMouseDown={() => setIsDraggingMin(true)}
          onMouseUp={() => setIsDraggingMin(false)}
          onTouchStart={() => setIsDraggingMin(true)}
          onTouchEnd={() => setIsDraggingMin(false)}
          class={`
            absolute w-full h-6 appearance-none bg-transparent cursor-pointer pointer-events-none
            ${props.minValue > (props.max - props.min) * 0.9 ? "z-30" : "z-20"}
            [&::-webkit-slider-thumb]:pointer-events-auto
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-accent
            [&::-webkit-slider-thumb]:border-2
            [&::-webkit-slider-thumb]:border-background
            [&::-webkit-slider-thumb]:shadow-lg
            [&::-webkit-slider-thumb]:transition-transform
            [&::-webkit-slider-thumb]:duration-150
            [&::-webkit-slider-thumb]:cursor-grab
            [&::-webkit-slider-thumb]:active:cursor-grabbing
            ${isDraggingMin()
              ? "[&::-webkit-slider-thumb]:scale-125 [&::-webkit-slider-thumb]:shadow-accent/40"
              : "[&::-webkit-slider-thumb]:scale-100 [&::-webkit-slider-thumb]:shadow-accent/20 hover:[&::-webkit-slider-thumb]:scale-110"
            }
          `}
        />

        {/* Max slider */}
        <input
          type="range"
          min={props.min}
          max={props.max}
          step={step()}
          value={props.maxValue}
          onInput={handleMaxChange}
          onMouseDown={() => setIsDraggingMax(true)}
          onMouseUp={() => setIsDraggingMax(false)}
          onTouchStart={() => setIsDraggingMax(true)}
          onTouchEnd={() => setIsDraggingMax(false)}
          class={`
            absolute w-full h-6 appearance-none bg-transparent cursor-pointer z-20 pointer-events-none
            [&::-webkit-slider-thumb]:pointer-events-auto
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-accent
            [&::-webkit-slider-thumb]:border-2
            [&::-webkit-slider-thumb]:border-background
            [&::-webkit-slider-thumb]:shadow-lg
            [&::-webkit-slider-thumb]:transition-transform
            [&::-webkit-slider-thumb]:duration-150
            [&::-webkit-slider-thumb]:cursor-grab
            [&::-webkit-slider-thumb]:active:cursor-grabbing
            ${isDraggingMax()
              ? "[&::-webkit-slider-thumb]:scale-125 [&::-webkit-slider-thumb]:shadow-accent/40"
              : "[&::-webkit-slider-thumb]:scale-100 [&::-webkit-slider-thumb]:shadow-accent/20 hover:[&::-webkit-slider-thumb]:scale-110"
            }
          `}
        />
      </div>

      {/* Value labels */}
      <div class="flex justify-between items-center gap-2">
        <div
          class={`
            flex items-center justify-center min-w-[4rem] px-2 py-1
            rounded-md text-xs font-medium
            bg-background-70 border border-secondary-20
            transition-colors duration-200
            ${isDraggingMin() ? "text-accent border-accent/50" : "text-text/80"}
          `}
        >
          {formatValue(props.minValue)}
        </div>
        <span class="text-muted text-xs">to</span>
        <div
          class={`
            flex items-center justify-center min-w-[4rem] px-2 py-1
            rounded-md text-xs font-medium
            bg-background-70 border border-secondary-20
            transition-colors duration-200
            ${isDraggingMax() ? "text-accent border-accent/50" : "text-text/80"}
          `}
        >
          {formatValue(props.maxValue)}
        </div>
      </div>
    </div>
  );
}

