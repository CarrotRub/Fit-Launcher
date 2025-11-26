import { ChevronDown, X, Check } from "lucide-solid";
import { createSignal, For, Show, JSX } from "solid-js";
import { MultiSelectDropdownProps } from "../../../types/components/types";

export default function MultiSelectDropdown(props: MultiSelectDropdownProps): JSX.Element {
  const [isOpen, setIsOpen] = createSignal(false);
  const [searchQuery, setSearchQuery] = createSignal("");

  const filteredOptions = () => {
    const query = searchQuery().toLowerCase();
    if (!query) return props.options;
    return props.options.filter((option) =>
      option.toLowerCase().includes(query)
    );
  };

  const toggleOption = (option: string) => {
    const isSelected = props.selected.includes(option);
    if (isSelected) {
      props.onChange(props.selected.filter((s) => s !== option));
    } else {
      props.onChange([...props.selected, option]);
    }
  };

  const removeOption = (option: string, e: MouseEvent) => {
    e.stopPropagation();
    props.onChange(props.selected.filter((s) => s !== option));
  };

  const clearAll = (e: MouseEvent) => {
    e.stopPropagation();
    props.onChange([]);
  };

  return (
    <div class={`relative w-full ${props.class || ""}`}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen())}
        class={`
          w-full flex items-center justify-between gap-2
          py-2 px-3 rounded-lg border min-h-[42px]
          transition-all duration-200
          ${isOpen()
            ? "border-accent bg-background-70 shadow-sm"
            : "border-accent/60 bg-background hover:bg-background-70"
          }
        `}
      >
        <div class="flex flex-wrap items-center gap-1 flex-1 min-w-0">
          <Show
            when={props.selected.length > 0}
            fallback={
              <span class="text-muted truncate">
                {props.placeholder ?? "Select options..."}
              </span>
            }
          >
            <Show
              when={props.selected.length <= 2}
              fallback={
                <span class="text-text text-sm">
                  {props.selected.length} selected
                </span>
              }
            >
              <For each={props.selected}>
                {(item) => (
                  <span class="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-md bg-accent/20 text-accent border border-accent/30">
                    <span class="truncate max-w-[100px]">{item}</span>
                    <button
                      onClick={(e) => removeOption(item, e)}
                      class="hover:text-primary transition-colors"
                    >
                      <X size={12} />
                    </button>
                  </span>
                )}
              </For>
            </Show>
          </Show>
        </div>

        <div class="flex items-center gap-1 shrink-0">
          <Show when={props.selected.length > 0}>
            <button
              onClick={clearAll}
              class="p-1 hover:bg-secondary-20/50 rounded transition-colors text-muted hover:text-text"
              title="Clear all"
            >
              <X size={14} />
            </button>
          </Show>
          <ChevronDown
            size={16}
            class={`transition-transform duration-200 ${isOpen() ? "rotate-180 text-accent" : "text-muted"}`}
          />
        </div>
      </button>

      {/* Dropdown Panel */}
      <Show when={isOpen()}>
        <div
          class="
            absolute z-[9999] mt-1.5 w-full max-h-72
            bg-popup-background border border-secondary-30 rounded-lg
            shadow-lg shadow-background/50 backdrop-blur-sm
            overflow-hidden
          "
        >
          {/* Search Input */}
          <div class="p-2 border-b border-secondary-20/50">
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery()}
              onInput={(e) => setSearchQuery(e.currentTarget.value)}
              class="
                w-full px-3 py-1.5 text-sm rounded-md
                bg-background border border-secondary-20
                text-text placeholder:text-muted
                focus:outline-none focus:border-accent/50
                transition-colors
              "
            />
          </div>

          {/* Options List */}
          <ul class="max-h-52 overflow-y-auto overscroll-contain scrollbar-thin scrollbar-thumb-accent/50 scrollbar-track-transparent">
            <Show
              when={filteredOptions().length > 0}
              fallback={
                <li class="px-4 py-3 text-sm text-muted text-center">
                  No options found
                </li>
              }
            >
              <For each={filteredOptions()}>
                {(option) => {
                  const isSelected = () => props.selected.includes(option);

                  return (
                    <li
                      onClick={() => toggleOption(option)}
                      class={`
                        flex items-center gap-2 px-4 py-2 cursor-pointer
                        text-sm transition-all duration-150
                        ${isSelected()
                          ? "bg-accent/10 text-accent"
                          : "text-text hover:bg-secondary-20/20"
                        }
                      `}
                    >
                      <div
                        class={`
                          w-4 h-4 rounded border flex items-center justify-center
                          transition-colors duration-150
                          ${isSelected()
                            ? "bg-accent border-accent"
                            : "border-secondary-20 bg-transparent"
                          }
                        `}
                      >
                        <Show when={isSelected()}>
                          <Check size={12} class="text-background" />
                        </Show>
                      </div>
                      <span class="truncate">{option}</span>
                    </li>
                  );
                }}
              </For>
            </Show>
          </ul>
        </div>

        {/* Click outside to close */}
        <div
          class="fixed inset-0 z-[9998]"
          onClick={() => {
            setIsOpen(false);
            setSearchQuery("");
          }}
        />
      </Show>
    </div>
  );
}

