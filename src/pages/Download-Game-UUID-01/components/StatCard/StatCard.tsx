import { JSX } from "solid-js";

interface StatItemProps {
    icon: JSX.Element;
    iconBg: string;
    label: string;
    value: string;
    small?: boolean
}

export const StatItem = (props: StatItemProps) => (
    <div class="flex items-center gap-4 p-3 bg-secondary-20/10 rounded-xl  border border-primary/20">
        <div class={`p-3 rounded-lg ${props.iconBg}`}>
            {props.icon}
        </div>
        <div class="flex-1 min-w-0">
            <div class="text-xs text-muted uppercase tracking-wide mb-1">{props.label}</div>
            <div class={`font-medium text-text truncate ${props.small ? "text-sm" : "text-base"}`}>
                {props.value}
            </div>
        </div>
    </div>
);