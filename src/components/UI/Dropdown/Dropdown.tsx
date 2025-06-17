import { ChevronDown } from "lucide-solid";
import { createSignal, Show } from "solid-js";
import { DropdownProps } from "../../../types/components/types";


export default function Dropdown(props: DropdownProps) {
    const [isOpen, setIsOpen] = createSignal(false);
    const [isAnimating, setIsAnimating] = createSignal(false);

    const handleSelection = async (item: string) => {
        setIsAnimating(true);
        await props.onListChange(item);
        setIsOpen(false);
        setTimeout(() => setIsAnimating(false), 150);
        props.onChange?.();
    };

    return (
        <div class="relative w-fit">
            <button
                onClick={() => setIsOpen(!isOpen())}
                class={`
          w-fit flex items-center justify-between gap-2
          py-2.5 px-4 rounded-lg border
          transition-all duration-200   
          ${isOpen()
                        ? "border-accent bg-background-70 shadow-sm"
                        : "border-accent/60 bg-background hover:bg-background-70"}
        `}
            >
                <span class="truncate text-text">
                    {props.activeItem || props.placeholder || "Select an option"}
                </span>
                <ChevronDown
                    size={16}
                    class={`transition-transform duration-200 ${isOpen() ? "rotate-180 text-accent" : "text-muted"
                        }`}
                />
            </button>

            {/* Dropdown Menu */}
            <Show when={isOpen()}>
                <div
                    class={`
                            absolute z-50 mt-1.5 w-fit max-h-64 overflow-auto
                            bg-popup-background border border-secondary-30 rounded-lg
                            shadow-lg shadow-background/50 backdrop-blur-sm
                            transition-opacity duration-200 no-scrollbar
                            ${isAnimating() ? "opacity-90" : "opacity-100"}
                    `}

                >
                    <ul class="py-1.5 divide-y divide-secondary-20/50">
                        {props.list.map((item) => (
                            <li>
                                <button
                                    onClick={() => handleSelection(item)}
                                    class={`
                    w-full text-left px-4 py-2.5 text-sm
                    transition-colors duration-150
                    ${item === props.activeItem
                                            ? "bg-accent/10 text-accent font-medium"
                                            : "text-text hover:bg-secondary-20/30"
                                        }
                    ${isAnimating() ? "opacity-80" : "opacity-100"}
                  `}
                                >
                                    {item}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            </Show>
        </div>
    );
}