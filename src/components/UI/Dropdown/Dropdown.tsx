import { ChevronDown, X } from "lucide-solid";
import { createSignal, Show } from "solid-js";
import { DropdownProps } from "../../../types/components/types";


export default function Dropdown<T extends string | number>(props: DropdownProps<T>) {
    const [isOpen, setIsOpen] = createSignal(false);
    const [isAnimating, setIsAnimating] = createSignal(false);
    const [hoveredItem, setHoveredItem] = createSignal<T | null>(null);

    const handleSelection = async (item: T) => {
        setIsAnimating(true);
        await props.onListChange(item);
        setIsOpen(false);
        setTimeout(() => setIsAnimating(false), 150);
    };

    return (
        <div class="relative w-full max-w-xs">
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
                    {props.activeItem ?? props.placeholder ?? "Select an option"}
                </span>
                <ChevronDown
                    size={16}
                    class={`transition-transform duration-200 ${isOpen() ? "rotate-180 text-accent" : "text-muted"}`}
                />
            </button>

            <Show when={isOpen()}>
                <div
                    class={`
            absolute z-50 mt-1.5 w-full max-h-64 overflow-auto
            bg-popup-background border border-secondary-30 rounded-lg
            shadow-lg shadow-background/50 backdrop-blur-sm
            transition-opacity duration-200 no-scrollbar
            ${isAnimating() ? "opacity-90" : "opacity-100"}
          `}
                >
                    <ul class="group max-w-full divide-y divide-secondary-20/50">
                        {props.list.map((item) => {
                            const isRemovable = props.removableList?.includes(item);
                            const isActive = item === props.activeItem;

                            return (
                                <li
                                    class="relative group flex justify-between min-w-full"
                                    onMouseEnter={() => setHoveredItem(() => item)}
                                    onMouseLeave={() => setHoveredItem(null)}
                                >
                                    <button
                                        onClick={() => handleSelection(item)}
                                        class={`
                      w-full flex items-center justify-between  
                      text-sm transition-all duration-200
                      ${isActive
                                                ? "bg-accent/10 text-accent font-medium"
                                                : "text-text hover:bg-secondary-20/20"}
                      ${isAnimating() ? "opacity-80" : "opacity-100"}
                    `}
                                    >
                                        <span class="truncate text-left flex-1 min-w-0 py-2.5 pl-4">
                                            {String(item)}
                                        </span>

                                        <Show when={isRemovable}>
                                            <button
                                                onClick={async (e) => {
                                                    e.stopPropagation();
                                                    await props.onRemove?.(item);
                                                }}
                                                class="p-2 h-full border-l-1 border-secondary-20/50 transition-all duration-200 text-muted hover:text-primary hover:bg-accent/30"
                                                title="Remove"
                                            >
                                                <X size={14} class="transition-transform hover:scale-110" />
                                            </button>
                                        </Show>
                                    </button>

                                    {isActive && <div class="absolute left-0 top-0 bottom-0 w-1 bg-accent" />}
                                </li>
                            );
                        })}
                    </ul>
                </div>
            </Show>
        </div>
    );
}
