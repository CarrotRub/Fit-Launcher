import { For, createSignal, onMount, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { render } from "solid-js/web";
import BasicChoicePopup from "../../../Pop-Ups/Basic-Choice-PopUp/Basic-Choice-PopUp";
import { message } from "@tauri-apps/plugin-dialog";
import { Game } from "../../../bindings";
import { CollectionListProps } from "../../../types/library/type";
import { setDownloadGamePageInfo } from "../../../components/functions/dataStoreGlobal";
import { LibraryAPI } from "../../../api/library/api";
import { ChevronDown, ChevronUp, Trash2, X, ChevronRight } from "lucide-solid";

const api = new LibraryAPI();

export default function CollectionList({ collectionGamesList, collectionName }: CollectionListProps) {
    const [gamesList, setGamesList] = createSignal<Game[]>([]);
    const [clicked, setClicked] = createSignal(false);
    const [isExpanded, setIsExpanded] = createSignal(true);
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

    async function handleGameClick(title: string, filePath: string, href: string) {
        if (!clicked() && collectionName === "games_to_download") {
            setClicked(true);
            const uuid = crypto.randomUUID();
            setDownloadGamePageInfo({ gameTitle: title, gameHref: href, filePath });
            window.location.href = `/game/${uuid}`;
        }
    }

    async function handleGameRemove(game: Game) {
        let result;

        if (collectionName === "games_to_download") {
            result = await api.removeGameToDownload(game.title);
        } else if (collectionName === "downloaded_games") {
            result = await api.removeDownloadedGame(game.title);
        } else {
            result = await api.removeGameFromCollection(game.title, collectionName);
        }

        if (result.status === "ok") {
            await message("Game has been removed from collection", { title: "FitLauncher", kind: "info" });
            window.location.reload();
        } else {
            await message(result.error, { title: "FitLauncher", kind: "error" });
        }
    }

    async function handleCollectionRemove() {
        if (collectionName === "games_to_download" || collectionName === "downloaded_games") {
            await message("Can't remove this protected collection", {
                title: "Collection Removal",
                kind: "warning"
            });
            return;
        }

        const pageContent = document.querySelector(".library");
        async function confirmRemove() {
            const result = await api.removeCollection(collectionName);
            if (result.status === "ok") {
                await message("Collection has been removed", { title: "FitLauncher", kind: "info" });
                window.location.reload();
            } else {
                await message(result.error, { title: "FitLauncher", kind: "error" });
            }
        }

        render(() => (
            <BasicChoicePopup
                infoTitle="Do you really want to remove this collection?"
                infoMessage={`You are going to remove ${collectionName}. Are you sure?`}
                infoFooter=""
                action={confirmRemove}
            />
        ), pageContent!);
    }

    onMount(() => {
        setGamesList(collectionGamesList || []);
    });

    return (
        <div class="w-full rounded-xl border border-secondary-20 overflow-hidden bg-background-70 mb-4">
            {/* Collection Header */}
            <div
                class="flex items-center justify-between p-4 cursor-pointer hover:bg-secondary-20/30 transition-colors"
                onClick={toggleExpand}
            >
                <div class="flex items-center gap-3">
                    {isExpanded() ?
                        <ChevronDown size={20} class="text-primary" /> :
                        <ChevronRight size={20} class="text-primary" />
                    }
                    <h3 class="text-md font-bold text-text flex flex-col ">
                        {formatKeyName(collectionName)}
                        <span class="ml-2 text-sm text-muted font-normal">
                            ({gamesList().length} {gamesList().length === 1 ? 'game' : 'games'})
                        </span>
                    </h3>
                </div>

                <Show when={!["games_to_download", "downloaded_games"].includes(collectionName)}>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleCollectionRemove();
                        }}
                        class="p-1.5 rounded-full hover:bg-red-500/20 text-muted hover:text-red-500 transition-colors"
                        title="Remove collection"
                    >
                        <Trash2 size={18} />
                    </button>
                </Show>
            </div>

            {/* Games List */}
            <Show when={isExpanded()}>
                <div class="border-t border-secondary-20/50">
                    <For each={gamesList()}>
                        {(game) => (
                            <div class="flex items-center p-3 border-b border-secondary-20/30 last:border-b-0 hover:bg-secondary-20/10 group">
                                <img
                                    src={game.img}
                                    alt={extractMainTitle(game.title)}
                                    onClick={() => handleGameClick(game.title, "", game.href)}
                                    class="w-12 h-12 rounded-md object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                />
                                <div
                                    class="flex-1 ml-3 cursor-pointer"
                                    onClick={() => handleGameClick(game.title, "", game.href)}
                                >
                                    <p class="font-medium text-text">
                                        {extractMainTitle(game.title)}
                                    </p>
                                    <p class="text-sm text-muted line-clamp-1">
                                        {game.title}
                                    </p>
                                </div>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleGameRemove(game);
                                    }}
                                    class="p-1.5 rounded-full hover:bg-accent/20 text-muted hover:text-accent transition-colors opacity-0 group-hover:opacity-100"
                                    title="Remove game"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        )}
                    </For>

                    <Show when={gamesList().length === 0}>
                        <div class="p-6 text-center text-muted">
                            No games found in this collection
                        </div>
                    </Show>
                </div>
            </Show>
        </div>
    );
}