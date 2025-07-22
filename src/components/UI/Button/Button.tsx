import { JSX } from "solid-js";
import { ButtonProps } from "../../../types/components/types";

const Button = (props: ButtonProps) => {
  return (
    <button
      id={props.id}
      onClick={props.onClick}
      disabled={props.disabled}
      class={`
        relative overflow-hidden isolate
        px-6 py-2.5 ${props.notRounded ? "rounded-none" : "rounded-xl"} font-medium
        transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]
        active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100
        border
        group ${props.size === "sm" ? "text-sm px-4 py-1.5" :
          props.size === "lg" ? "text-lg px-8 py-3" : "text-base"}
        
       
        ${props.variant === "glass"
          ? `
            bg-gradient-to-b from-background/15 to-background/10
            border-white/10 hover:border-white/20
            text-text backdrop-blur-md
            shadow-[0_1px_1px_rgba(255,255,255,0.1)]
            hover:shadow-[0_1px_2px_rgba(255,255,255,0.15)]
            before:content-[''] before:absolute before:inset-0 
            before:bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.3)_0%,_transparent_70%)] 
            before:opacity-0 before:group-hover:opacity-10
            before:transition-opacity before:duration-300
          `
          : props.variant === "bordered"
            ? "bg-transparent hover:bg-secondary-20/40 border-accent/60 text-text hover:border-accent"
            : `bg-accent/90 hover:bg-accent border-primary/80 text-text`
        }
        ${props.class}
      `}
    >
      <span class={`
        absolute inset-0 -z-10 rounded-[inherit]
        transition-opacity duration-300
        ${props.variant === "glass" ? `
          bg-[conic-gradient(from_210deg_at_50%_50%,rgba(120,180,255,0.05)_0deg,transparent_120deg)]
          opacity-30 group-hover:opacity-50
        ` : ''}
      `}></span>

      {/* Content container */}
      <div class="flex items-center justify-center gap-2 w-full">
        {props.icon && (
          <span class={`transition-transform duration-200 ${props.label ? 'group-hover:translate-x-0.5' : ''}`}>
            {props.icon}
          </span>
        )}
        {props.label && (
          <span class={`transition-transform duration-200 ${props.icon ? 'group-hover:translate-x-0.5' : ''}`}>
            {props.label}
          </span>
        )}
      </div>

      <span class={`
        absolute inset-0 -z-20 rounded-[inherit] overflow-hidden
        ${props.variant === "glass" ? `
          after:content-[''] after:absolute after:top-1/2 after:left-1/2 
          after:w-[3px] after:h-[3px] after:rounded-full 
          after:bg-white/15 after:-translate-x-1/2 after:-translate-y-1/2
          after:scale-0 after:group-active:scale-[100] after:opacity-0 after:group-active:opacity-50
          after:transition-all after:duration-400 after:ease-out
        ` : ''}
      `}></span>
    </button>
  );
};

export default Button;