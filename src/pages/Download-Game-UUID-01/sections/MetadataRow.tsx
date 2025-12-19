export const MetadataRow = (props: { label: string; value: string; valueClass?: string; last?: boolean }) => (
    <div class={`flex justify-between items-baseline py-1 ${props.last ? "pt-2" : "border-b border-secondary-20/30"}`}>
        <span class="text-muted/70 text-xs font-bold uppercase tracking-wider">{props.label}</span>
        <span class={`max-w-50 truncate ${props.valueClass || "text-secondary-foreground"}`} title={props.value}>
            {props.value}
        </span>
    </div>
);