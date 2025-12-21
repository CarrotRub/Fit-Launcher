import { Accessor, createSignal, For, Match, onMount, Show, Switch } from "solid-js"
import { DownloadedGame } from "../../../bindings"
import { InfoContainer } from "../components/InfoContainer"

export type FeaturesSectionProps = {
    game: Accessor<DownloadedGame | null | undefined>
}

export const FeaturesSection = (props: FeaturesSectionProps) => {
    const [infoTab, setInfoTab] = createSignal<"game" | "repack">("game");
    onMount(() => {
        if (!props.game()?.gameplay_features) {
            setInfoTab("repack");
        } else {
            setInfoTab("game")
        }
    })
    return (
        <InfoContainer >
            <div class="flex gap-2 mb-4 border-b items-center transition-all duration-300 border-secondary-20/40 ">
                <div class="w-1 h-4 bg-accent rounded-full"></div>
                <Show when={props.game()?.gameplay_features} >
                    <button
                        onClick={() => setInfoTab("game")}
                        class={`px-4 py-2 text-lg font-semibold transition-colors
                              ${infoTab() === "game"
                                ? " font-bold bg-linear-to-r from-text to-accent bg-clip-text text-transparent"
                                : "text-muted hover:text-text"
                            }`}
                    >
                        Game Features
                    </button>
                </Show>
                <Show when={props.game()?.features}>
                    <button
                        onClick={() => setInfoTab("repack")}
                        class={`px-4 py-2 text-lg font-semibold transition-colors
                              ${infoTab() === "repack"
                                ? " font-bold bg-linear-to-r from-text to-accent bg-clip-text text-transparent"
                                : "text-muted hover:text-text"
                            }`}
                    >
                        Repack Features
                    </button>
                </Show>

            </div>

            <InfoContainer class="p-4 max-h-80 overflow-y-auto custom-scrollbar">
                <Switch>
                    <Match when={infoTab() === "game"}>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm text-muted leading-6">
                            <For
                                each={props.game()?.gameplay_features
                                    ?.split("\n")
                                    .map(f => f.trim())
                                    .filter(Boolean)
                                    .sort((a, b) => b.length - a.length)
                                }
                            >
                                {(feature) => (
                                    <div class="flex gap-2">
                                        <span class="mt-1 h-1.5 w-1.5 rounded-full bg-accent shrink-0" />
                                        <p>{feature}</p>
                                    </div>
                                )}
                            </For>
                        </div>
                    </Match>

                    <Match when={infoTab() === "repack"}>
                        <div class="text-xs font-mono text-muted whitespace-pre-wrap leading-6">
                            {props.game()?.features}
                        </div>
                    </Match>
                </Switch>
            </InfoContainer>
        </InfoContainer>
    )
}