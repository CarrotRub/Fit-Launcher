import { Accessor, For, JSX, Show } from "solid-js"
import { DownloadedGame } from "../../../bindings";
import { extractMainTitle } from "../../../helpers/format";
import Button from "../../../components/UI/Button/Button";
import { Globe, Magnet, Zap } from "lucide-solid";
import { useNavigate } from "@solidjs/router";
import { DownloadType } from "../../../types/popup";
import createDownloadPopup from "../../../Pop-Ups/Download-PopUp/Download-PopUp";
import { MetadataRow } from "./MetadataRow";
import { GameDetails } from "../../../types/game";


export type SidebarSectionProps = {
    gameDetails: Accessor<GameDetails>;
    game: Accessor<DownloadedGame | null | undefined>;
    hasDebridCached: Accessor<boolean>;
}

export const SidebarSection = (props: SidebarSectionProps) => {
    const navigate = useNavigate();


    const handleDownloadPopup = (downloadType: DownloadType) => {
        const g = props.game();
        if (!g) return;

        createDownloadPopup({
            infoTitle: "Download Game",
            infoMessage: `Do you want to download ${g.title}`,
            downloadedGame: g,
            //todo: add in config settings
            folderExclusion: false,
            gameDetails: props.gameDetails(),
            downloadType,
            onFinish: () => navigate("/downloads-page")
        });
    };

    return (
        <div class="flex flex-col py-12 justify-between gap-6 bg-secondary-20/10 rounded-xl p-6 shadow-lg border border-primary/20">
            {/* Title */}
            <div class="flex flex-col gap-6">
                <div>
                    <h1 class="text-3xl font-bold leading-tight mb-2 text-text">
                        {extractMainTitle(props.game()!.title)}
                    </h1>
                    <p class="text-sm text-muted line-clamp-3 leading-relaxed">
                        {props.game()?.description?.slice(0, 150) || props.game()!.title}...
                    </p>
                </div>
                {/* Tags */}
                <div class="flex flex-wrap gap-1.5">
                    <For each={props.gameDetails().tags.split(",")}>
                        {(tag) => (
                            <span
                                class="px-3 py-1.5 bg-secondary/10 text-text/90 rounded-lg text-xs font-medium uppercase tracking-wider border border-white/20 transition-all duration-300 hover:bg-accent/50 hover:border-accent/50 hover:scale-105"
                            >
                                {tag}
                            </span>
                        )}
                    </For>
                </div>

                {/* Metadata */}
                <div class="flex flex-col lg:mt-6 gap-1 text-sm bg-popup-background/50 p-4 rounded-lg border border-secondary-20/50">
                    <MetadataRow label="Download Size" value={props.gameDetails().repackSize} valueClass="text-accent font-mono" />
                    <MetadataRow label="Orig Size" value={props.gameDetails().originalSize} valueClass="text-primary font-mono" />
                    <MetadataRow label="Publisher" value={props.gameDetails().companies} />
                    <MetadataRow label="Languages" value={props.gameDetails().language} last />
                </div>
            </div>



            {/* Download Actions */}
            <div class="flex flex-col gap-3 ">
                <Button
                    icon={<Magnet class="w-4 h-4" />}
                    label="Torrent Download"
                    onClick={() => handleDownloadPopup("bittorrent")}
                    class="w-full py-3 justify-center text-sm font-semibold uppercase tracking-wide border border-secondary-20 bg-secondary-20/50 hover:bg-secondary-20 hover:text-text transition-all"
                    variant="bordered"
                />
                <div class="relative w-full">
                    <Show when={props.hasDebridCached()}>
                        <div class="absolute -top-2 -right-2 z-10 flex items-center gap-1 px-2 py-0.5 bg-emerald-500 text-text text-[10px] font-bold uppercase rounded-sm shadow-md tracking-wider">
                            <Zap class="w-3 h-3" /> Fast
                        </div>
                    </Show>
                    <Button
                        icon={<Globe class="w-4 h-4" />}
                        label="Direct Download"
                        onClick={() => handleDownloadPopup("direct_download")}
                        class="w-full py-3 justify-center text-sm font-semibold uppercase tracking-wide border border-secondary-20 bg-secondary-20/50 hover:bg-secondary-20 hover:text-text transition-all"
                        variant="bordered"
                    />
                </div>
            </div>
        </div>)

}

export const SidebarCard = (props: { title: string; children: JSX.Element }) => (
    <div class="bg-secondary-20/10  shadow-lg border border-primary/20 rounded-xl p-5 hover:border-secondary-20/50 transition-colors">
        <div class="flex items-center gap-2 mb-4 pb-3 border-b border-secondary-20/30">
            <div class="w-2 h-2 rounded-full bg-accent"></div>
            <h3 class="text-sm font-semibold uppercase tracking-wider text-text">{props.title}</h3>
        </div>
        {props.children}
    </div>
);
