import { createSignal } from "solid-js";
import { TextInputProps } from "../../../types/components/types";

export default function TextInput(props: TextInputProps) {
  const [isFocused, setIsFocused] = createSignal(false);
  return (
    <div class={`relative w-full ${props.class || ""}`}>
      <div class={`
        flex items-center gap-2 w-full
        border rounded-lg overflow-hidden
        transition-all duration-200
        ${isFocused() ? "border-primary/60 ring-1 ring-primary/20" : "border-secondary-20"}
      `}>
        <input
          type="text"
          value={props.value}
          disabled={props.disabled}
          onInput={(e) => props.onInput?.((e.target as HTMLInputElement).value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          class={`
                      flex-1 py-2.5 px-4 bg-transparent
                      text-text placeholder:text-muted/60
                      focus:outline-none
                    `}
        />

      </div>

      {/* Animated focus highlight */}
      <div class={`
        absolute inset-0 -z-10 rounded-lg
        bg-gradient-to-r from-accent/10 to-primary/10
        opacity-0 transition-opacity duration-300
        ${isFocused() ? "opacity-100" : ""}
      `}></div>
    </div>
  )

}