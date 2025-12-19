import { Accessor, For } from "solid-js"
import { SidebarCard } from "../SidebarSection"
import { DownloadedGame } from "../../../../bindings"

export const DLCSection = (props: { game: Accessor<DownloadedGame | null | undefined> }) => {
    return (
        <SidebarCard title="Included DLCs">
            <div class="max-h-64 overflow-y-auto custom-scrollbar pr-2 space-y-1">
                <For each={props.game()?.included_dlcs.split("\n").filter(d => d.trim() && d.trim() !== ":")}>
                    {(dlc) => (
                        <div class="text-xs text-muted/80 hover:text-text transition-colors py-1 border-b border-secondary-20/10 last:border-0">
                            {dlc.trim()}
                        </div>
                    )}
                </For>
            </div>
        </SidebarCard>
    )
}