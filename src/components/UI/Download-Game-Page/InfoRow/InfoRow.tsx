import { JSX } from "solid-js";

interface InfoRowProps {
    icon: JSX.Element;
    label: string;
    value: string;
    iconBgClass?: string;
    multiline?: boolean;
    onClick?: () => void;
}

export function InfoRow(props: InfoRowProps) {
    const content = (
        <>
            <div class={`w-9 h-9 flex items-center justify-center rounded-lg flex-shrink-0 ${props.iconBgClass || "bg-secondary-20"}`}>
                {props.icon}
            </div>
            <div class="flex-1 min-w-0">
                <p class="text-xs text-muted uppercase tracking-wide">{props.label}</p>
                <p class={`font-medium text-sm ${props.multiline ? "line-clamp-2" : "line-clamp-1"}`}>
                    {props.value}
                </p>
            </div>
        </>
    );

    if (props.onClick) {
        return (
            <button
                onClick={props.onClick}
                class="flex items-center gap-3 w-full hover:bg-secondary-20/30 -mx-1 px-1 py-1 rounded-lg transition-colors group text-left"
            >
                {content}
            </button>
        );
    }

    return (
        <div class={`flex ${props.multiline ? "items-start" : "items-center"} gap-3`}>
            {content}
        </div>
    );
}

export function InfoDivider() {
    return <div class="h-px bg-secondary-20" />;
}
