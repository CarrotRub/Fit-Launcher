import { Accessor, For, JSX, Match, Show, Switch } from "solid-js"
import { DownloadedGame } from "../../../bindings";
import { extractMainTitle } from "../../../helpers/format";
import Button from "../../../components/UI/Button/Button";
import { Globe, Magnet, Play, Zap } from "lucide-solid";
import { useNavigate } from "@solidjs/router";
import { DownloadType } from "../../../types/popup";
import createDownloadPopup from "../../../Pop-Ups/Download-PopUp/Download-PopUp";
import { MetadataRow } from "./MetadataRow";
import { GameDetails } from "../../../types/game";
import createBasicChoicePopup from "../../../Pop-Ups/Basic-Choice-PopUp/Basic-Choice-PopUp";
import { LibraryApi } from "../../../api/library/api";
import { showError } from "../../../helpers/error";
import { InfoContainer } from "../components/InfoContainer";


export type SidebarSectionProps = {
    gameDetails: Accessor<GameDetails>;
    game: Accessor<DownloadedGame | null | undefined>;
    hasDebridCached: Accessor<boolean>;
}

export const SidebarSection = (props: SidebarSectionProps) => {
    const navigate = useNavigate();
    const api = new LibraryApi();

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

    const handleStartGame = (path: string) => {
        createBasicChoicePopup({
            infoTitle: "Launch Game",
            infoMessage: "Do you want to launch the game now?",
            action: async () => {
                try {
                    await api.runExecutable(path);
                } catch (err) {
                    await showError(err, "Error");
                }
            },
        });
    };

    return (
        <InfoContainer class="flex flex-col py-12 justify-between gap-6">
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
            <Switch>
                {/* If the game is not installed */}
                <Match when={props.game()?.executable_info.executable_path === "" || props.game()?.executable_info.executable_path === undefined}>
                    <div class="flex flex-col gap-3">
                        {/* Torrent Download */}
                        <Button
                            icon={<Magnet class="w-4 h-4" />}
                            label="Torrent Download"
                            onClick={() => handleDownloadPopup("bittorrent")}
                            class="w-full py-3 justify-center text-sm font-semibold uppercase tracking-wide border border-secondary-20 bg-secondary-20/50 hover:bg-secondary-20 hover:text-text transition-all"
                            variant="bordered"
                        />

                        {/* Direct Download with optional Fast badge */}
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
                </Match>

                <Match when={props.game()?.executable_info.executable_path !== undefined && props.game()?.executable_info.executable_path !== ""}>
                    <Button
                        icon={<Play class="w-4 h-4" />}
                        label="Play Now"
                        onClick={() => handleStartGame(props.game()!.executable_info.executable_path)}
                        class="w-full"
                        variant="solid"
                    />
                </Match>

            </Switch>
        </InfoContainer>
    )

}

export const SidebarCard = (props: { title: string; children: JSX.Element }) => (
    <InfoContainer>
        <div class="flex items-center gap-2 mb-4 pb-3 border-b border-secondary-20/30">
            <div class="w-2 h-2 rounded-full bg-accent"></div>
            <h3 class="text-sm font-semibold uppercase tracking-wider text-text">{props.title}</h3>
        </div>
        {props.children}
    </InfoContainer>
);
