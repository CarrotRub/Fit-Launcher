import { For, createSignal, onMount, Show, createEffect } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { render } from "solid-js/web";
import BasicChoicePopup from "../../../Pop-Ups/Basic-Choice-PopUp/Basic-Choice-PopUp";
import { message } from "@tauri-apps/plugin-dialog";
import { commands, Game } from "../../../bindings";
import { CollectionListProps } from "../../../types/library/type";
import { setDownloadGamePageInfo } from "../../../components/functions/dataStoreGlobal";
import { LibraryApi } from "../../../api/library/api";
import { ChevronDown, ChevronUp, Trash2, X, ChevronRight } from "lucide-solid";
import createBasicChoicePopup from "../../../Pop-Ups/Basic-Choice-PopUp/Basic-Choice-PopUp";

const api = new LibraryApi();

export default function CollectionList(props: CollectionListProps) {
    const [gamesList, setGamesList] = createSignal<Game[]>([]);
    const [clicked, setClicked] = createSignal(false);
    const [isExpanded, setIsExpanded] = createSignal(false);
    const navigate = useNavigate();

    const toggleExpand = () => setIsExpanded(!isExpanded());

    function extractMainTitle(title?: string) {
        return title
            ?.replace(/(?: - |, | )?(Digital Deluxe|Ultimate Edition|Deluxe Edition)\s*[:\-]?.*|(?: - |, ).*/, '')
            ?.replace(/\s*[:\-]\s*$/, '')
            ?.replace(/\(.*?\)/g, '')
            ?.replace(/\s*[:\–]\s*$/, '')
            ?.replace(/[\–].*$/, '');
    }

    function formatKeyName(key: string) {
        return key
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    async function handleGameClick(gameTitle: string, filePath: string, gameHref: string) {
        if (!clicked() && props.collectionName === "games_to_download") {
            setClicked(true);
            const uuid = await commands.hashUrl(gameHref);
            navigate(`/game/${uuid}`, {
                state: { gameHref, gameTitle, filePath }
            });
        }
    }

    async function handleGameRemove(game: Game) {
        let result;

        if (props.collectionName === "games_to_download") {
            result = await api.removeGameToDownload(game.title);
        } else if (props.collectionName === "downloaded_games") {
            result = await api.removeDownloadedGame(game.title);
        } else {
            result = await api.removeGameFromCollection(game.title, props.collectionName);
        }

        if (result.status === "ok") {
            setGamesList(prev => prev.filter(g => g.title !== game.title));
            await message("Game has been removed from collection", { title: "FitLauncher", kind: "info" });
        } else {
            await message(result.error, { title: "FitLauncher", kind: "error" });
        }
    }

    async function handleCollectionRemove() {
        if (props.collectionName === "games_to_download" || props.collectionName === "downloaded_games") {
            await message("Can't remove this protected collection", {
                title: "Collection Removal",
                kind: "warning"
            });
            return;
        }

        async function confirmRemove() {
            const result = await api.removeCollection(props.collectionName);

            if (result.status === "ok") {
                props.onCollectionRemove?.(props.collectionName);
                await message("Collection has been removed", {
                    title: "FitLauncher",
                    kind: "info"
                });
            } else {
                await message(result.error, {
                    title: "FitLauncher",
                    kind: "error"
                });
            }
        }


        createBasicChoicePopup({
            infoTitle: "Do you really want to remove this collection?",
            infoMessage: `You are going to remove ${props.collectionName}. Are you sure?`,
            infoFooter: "",
            action: confirmRemove
        })
    }

    createEffect(() => {
        setGamesList(props.collectionGamesList());
    });

    return (
        <div class="w-full rounded-xl border border-secondary-20 overflow-hidden bg-background-70 mb-4 h-full">
            {/* Collection Header */}
            <div
                class="flex items-stretch min-h-10 cursor-pointer hover:bg-secondary-20/30 transition-colors"
                onClick={toggleExpand}
            >
                {/* Left side: Chevron + Title */}
                <div class="flex items-center gap-3 p-4 h-full flex-1 min-w-0 overflow-hidden">
                    {isExpanded() ? (
                        <ChevronDown size={20} class="text-primary" />
                    ) : (
                        <ChevronRight size={20} class="text-primary" />
                    )}

                    <h3 class="text-md font-light text-text flex flex-col min-w-0 overflow-hidden">
                        <span class="truncate text-md" title={formatKeyName(props.collectionName)}>{formatKeyName(props.collectionName)}</span>
                        <span class="text-xs text-muted font-normal truncate italic">
                            ({gamesList().length} {gamesList().length === 1 ? "game" : "games"})
                        </span>
                    </h3>
                </div>

                {/* Right side: Trash icon in fixed-width area */}
                <Show when={!["games_to_download", "downloaded_games"].includes(props.collectionName)}>
                    <div class="flex items-center px-3 min-w-10 border-l border-secondary-20/20">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleCollectionRemove();
                            }}
                            class="w-full h-full flex items-center justify-center text-muted hover:text-accent transition-colors"
                            title="Remove collection"
                        >
                            <Trash2 size={18} />
                        </button>
                    </div>
                </Show>
            </div>


            {/* Games List */}
            <Show when={isExpanded()}>
                <div class="border-t border-secondary-20/50">
                    <For each={gamesList()}>
                        {(game) => (
                            <div class="group flex items-stretch border-b border-secondary-20/30 last:border-b-0 hover:bg-secondary-20/10">
                                {/* Left: Image + Text */}
                                <div
                                    class="flex flex-1 min-w-0  p-3 items-center cursor-pointer"
                                    onClick={() => handleGameClick(game.title, "", game.href)}
                                >
                                    <img
                                        src={game.img}
                                        title={extractMainTitle(game.title)}
                                        alt={extractMainTitle(game.title)}
                                        class="w-12 h-12 rounded-md object-cover hover:opacity-90 transition-opacity"
                                    />
                                    <div class="ml-3 flex-1 overflow-hidden">
                                        <p class="font-medium text-text truncate line-clamp-1 text-sm" title={extractMainTitle(game.title)}>
                                            {extractMainTitle(game.title)}
                                        </p>
                                        <p class="text-sm text-muted truncate line-clamp-1">
                                            {game.title}
                                        </p>
                                    </div>
                                </div>

                                {/* Right: X Button (fixed width) */}
                                <Show when={props.collectionName !== "downloaded_games"}>
                                    <div class="flex items-center px-3 min-w-[56px] border-l border-secondary-20/20">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleGameRemove(game);
                                            }}
                                            class="w-full h-full flex items-center justify-center text-muted hover:text-accent transition-colors"
                                            title="Remove from collection"
                                        >
                                            <X size={18} />
                                        </button>
                                    </div>
                                </Show>

                            </div>
                        )}
                    </For>

                    <Show when={gamesList().length === 0}>
                        <div class="p-6 text-center text-sm text-muted">No games in this collection</div>
                    </Show>
                </div>

            </Show>
        </div>
    );
}