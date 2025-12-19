import { Accessor, Show } from "solid-js"
import { DownloadedGame } from "../../../../bindings"
import { SidebarCard } from "../SidebarSection"
import { StatItem } from "../../components/StatCard/StatCard"
import { Clock, Play } from "lucide-solid"
import { formatDate, formatPlayTime } from "../../../../helpers/format"

export type ActivitySectionProps = {
    game: Accessor<DownloadedGame | null | undefined>
}

export const ActivitySection = (props: ActivitySectionProps) => {
    return (
        <Show when={props.game()?.executable_info?.executable_path}>
            <SidebarCard title="Your Activity">
                <div class="grid grid-cols-1 gap-4">
                    <StatItem
                        icon={<Clock class="w-5 h-5" />}
                        iconBg="bg-accent/20 text-accent"
                        label="Time Played"
                        value={formatPlayTime(props.game()!.executable_info.executable_play_time)}
                    />
                    <StatItem
                        icon={<Play class="w-5 h-5" />}
                        iconBg="bg-primary/20 text-primary"
                        label="Last Session"
                        value={formatDate(props.game()!.executable_info.executable_last_opened_date)}
                        small
                    />
                </div>
            </SidebarCard>
        </Show>
    )
}