import { JSX } from "solid-js";
import { ButtonProps } from "../../../types/components/types";

const Button = (props: ButtonProps) => {
  return (
    <button
      id={props.id}
      onClick={props.onClick}
      disabled={props.disabled}
      class={`
        relative overflow-hidden
        px-6 py-2.5 rounded-lg font-medium
        transition-all duration-200 ease-out
        active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100
        border
        group ${props.size === "sm" ? "text-sm px-4 py-1.5" :
          props.size === "lg" ? "text-lg px-8 py-3" : "text-base"}
        
        /* Variant Styles */
        ${props.variant === "glass"
          ? "bg-background-30/40 hover:bg-background-30/60 border-secondary-20/30 text-text"
          : props.variant === "bordered"
            ? "bg-transparent hover:bg-secondary-20/40 border-accent/60 text-text hover:border-accent"
            : `bg-accent/90 hover:bg-accent 
               border-primary/80 
               text-text`
        }
        ${props.class}
      `}
    >
      {/* Subtle hover overlay */}
      <span class={`
        absolute inset-0 -z-10 rounded-[inherit]
        bg-accent/0 group-hover:bg-accent/10
        transition-colors duration-300
        ${props.variant === "solid" ? "!bg-primary/20" : ""}
      `}></span>

      {/* Content */}
      <div class="flex items-center justify-center gap-2 relative">
        {props.icon && (
          <span class="text-lg leading-none">{props.icon}</span>
        )}
        {props.label}
      </div>

      {/* Active state indicator */}
      <span class={`
        absolute inset-0 -z-20 rounded-[inherit]
        bg-text/0 active:bg-text/5
      `}></span>
    </button>
  );
};

export default Button;