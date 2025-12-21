import { Accessor, Show } from "solid-js";
import { DownloadedGame } from "../../../../bindings";

import { DLCSection } from "./DLCSection";
import { ActivitySection } from "./ActivitySection";

type AboutSectionProps = {
    game: Accessor<DownloadedGame | null | undefined>;
    downloadedGame: Accessor<DownloadedGame | null | undefined>
}

export const AboutSection = (props: AboutSectionProps) => {
    return (
        <div class="space-y-6 flex-row">
            <div class="bg-secondary-20/10 rounded-xl p-6 shadow-lg border border-primary/20">
                <div class="flex items-center gap-3 mb-6">
                    <div class="w-1.5 h-6 bg-linear-to-b from-accent to-primary rounded-full"></div>
                    <h2 class="text-xl font-bold bg-linear-to-r from-text to-accent bg-clip-text text-transparent">About This Game</h2>
                </div>
                <div class="text-sm text-muted/90 leading-relaxed space-y-4 text-justify whitespace-pre-wrap font-light">
                    {props.game()?.description}
                </div>
            </div>

            <div class="flex flex-col gap-6">
                <Show when={props.game()?.included_dlcs}>
                    <DLCSection game={props.game} />
                </Show>

                <Show when={props.downloadedGame()}>
                    <ActivitySection game={props.downloadedGame} />
                </Show>
            </div>
        </div>
    )
}