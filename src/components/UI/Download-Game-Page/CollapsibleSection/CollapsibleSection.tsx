import { JSX, Show, createSignal } from "solid-js";
import { ChevronDown, ChevronUp } from "lucide-solid";

interface CollapsibleSectionProps {
    icon: JSX.Element;
    title: string;
    children: JSX.Element;
    defaultExpanded?: boolean;
}

export function CollapsibleSection(props: CollapsibleSectionProps) {
    const [expanded, setExpanded] = createSignal(props.defaultExpanded ?? false);

    return (
        <div class="bg-popup-background rounded-xl border border-secondary-20">
            <button
                onClick={() => setExpanded(!expanded())}
                class="w-full flex items-center justify-between p-4 hover:bg-secondary-20/30 transition-colors rounded-xl"
            >
                <div class="flex items-center gap-3">
                    {props.icon}
                    <span class="font-semibold">{props.title}</span>
                </div>
                {expanded() ? (
                    <ChevronUp class="w-5 h-5 text-muted" />
                ) : (
                    <ChevronDown class="w-5 h-5 text-muted" />
                )}
            </button>
            <Show when={expanded()}>
                <div class="px-4 pb-4">
                    <div class="h-px bg-secondary-20 mb-4" />
                    {props.children}
                </div>
            </Show>
        </div>
    );
}
