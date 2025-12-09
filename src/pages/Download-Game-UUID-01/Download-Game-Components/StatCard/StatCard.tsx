import { JSX } from "solid-js";

interface StatCardProps {
    icon: JSX.Element;
    label: string;
    value: string;
    iconBgClass?: string;
}

export function StatCard(props: StatCardProps) {
    return (
        <div class="flex items-center gap-3 p-3 bg-secondary-20/30 rounded-lg">
            <div class={`w-10 h-10 flex items-center justify-center rounded-lg ${props.iconBgClass || "bg-secondary-20"}`}>
                {props.icon}
            </div>
            <div>
                <p class="text-xs text-muted uppercase tracking-wide">{props.label}</p>
                <p class="font-semibold">{props.value}</p>
            </div>
        </div>
    );
}
