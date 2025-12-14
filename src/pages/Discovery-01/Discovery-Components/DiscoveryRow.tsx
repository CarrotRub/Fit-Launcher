import { createSignal, createMemo, For, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import type { Game } from '../../../bindings';
import { commands } from '../../../bindings';
import { Bookmark, BookmarkCheck, Download, Star } from 'lucide-solid';
import { LibraryApi } from '../../../api/library/api';
import { useToast } from 'solid-notifications';
import LazyImage from '../../../components/LazyImage/LazyImage';
import { parseGameSize, formatBytesToSize } from '../../../helpers/gameFilters';

const library = new LibraryApi();

interface DiscoveryRowProps {
    game: Game;
    isFavorite: boolean;
}

export default function DiscoveryRow(props: DiscoveryRowProps) {
    const navigate = useNavigate();
    const { notify } = useToast();
    const [isFavorite, setIsFavorite] = createSignal(props.isFavorite);

    const repackSize = createMemo(() => {
        const bytes = parseGameSize(props.game.details || '', 'repack');
        return bytes > 0 ? formatBytesToSize(bytes) : null;
    });

    const displayTitle = createMemo(() =>
        props.game.title?.replace(/\s*[:\-]\s*$/, '').replace(/\(.*?\)/g, '').replace(/[\–].*$/, '').trim() || props.game.title
    );

    const descriptionSnippet = createMemo(() => {
        const desc = props.game.description;
        if (!desc) return '';
        return desc.length > 280 ? `${desc.slice(0, 280).trim()}...` : desc;
    });

    const tags = createMemo(() => props.game.tag?.split(',').map(t => t.trim()).slice(0, 4) || []);

    // Use first secondary image (in-game screenshot) as background, fallback to main image
    const backgroundImage = createMemo(() =>
        props.game.secondary_images?.[0] || props.game.img
    );

    const handleGoToGame = async () => {
        const uuid = await commands.hashUrl(props.game.href);
        navigate(`/game/${uuid}`, { state: { gameHref: props.game.href, gameTitle: props.game.title } });
    };



    const toggleFavorite = async (e: MouseEvent) => {
        e.stopPropagation();
        const newState = !isFavorite();
        setIsFavorite(newState);
        try {
            if (newState) {
                await library.addGameToCollection("games_to_download", props.game);
                notify(`Added to favorites`, { type: "success" });
            } else {
                await library.removeGameToDownload(props.game.title);
                notify(`Removed from favorites`, { type: "success" });
            }
        } catch {
            setIsFavorite(!newState);
            notify("Error updating favorites", { type: "error" });
        }
    };

    return (
        <div
            class="group relative cursor-pointer transition-all duration-300 hover:scale-102"

            onClick={handleGoToGame}
        >
            <div class="absolute inset-0 bg-gradient-to-r from-accent/20 via-primary/10 to-accent/20 opacity-0 group-hover:opacity-100  transition-opacity duration-500 rounded-2xl -z-10" />

            {/* Main card */}
            <div class="relative h-78 rounded-2xl overflow-hidden border border-primary/40 bg-gradient-to-br from-gray-900/90 via-gray-900/80 to-black/90">
                <div class="absolute inset-0 transition-transform duration-700 group-hover:scale-110">
                    <LazyImage
                        src={backgroundImage()}
                        alt=""
                        class="w-full h-full"
                        objectFit="cover"
                    />

                    <div class="absolute inset-0 bg-gradient-to-t from-black/60  via-black/30 to-transparent" />
                    <div class="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent" />


                </div>
                <div class="absolute inset-0 backdrop-blur-xs" />
                {/* Content */}
                <div class="relative h-full flex p-6">
                    <div class="w-[180px] h-full shrink-0 relative">
                        <div class="absolute top-0 left-0 w-full h-[calc(100%-2rem)] transition-all duration-500 group-hover:translate-y-[-8px] ">
                            <div class="relative w-full h-full rounded-xl overflow-hidden ring-2 ring-primary/60 ring-offset-2 ring-offset-background">
                                <LazyImage
                                    src={props.game.img}
                                    alt={props.game.title}
                                    class="w-full h-full "
                                    objectFit="cover"
                                />
                                <div class="absolute inset-0 bg-gradient-to-tr from-transparent via-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                            </div>

                        </div>
                    </div>

                    {/* Game info */}
                    <div class="flex flex-col justify-between pl-6 pr-4 flex-1 min-w-0">
                        <div class="space-y-4">
                            <div class="space-y-2">
                                <h3 class="text-3xl font-bold text-text line-clamp-2">
                                    {displayTitle()}
                                </h3>
                                <div class="h-[2px] w-16 bg-gradient-to-r from-accent to-primary rounded-full transition-all duration-300 group-hover:w-32" />
                            </div>

                            <div class="flex flex-wrap gap-2">
                                <For each={tags()}>
                                    {(tag, index) => (
                                        <span
                                            class="px-3 py-1.5 bg-secondary/10 text-text/90 rounded-full text-xs font-medium uppercase tracking-wider border border-white/20 transition-all duration-300 hover:bg-accent/50 hover:border-accent/50 hover:scale-105"
                                            style={{
                                                "transition-delay": `${index() * 50}ms`
                                            }}
                                        >
                                            {tag}
                                        </span>
                                    )}
                                </For>
                            </div>

                            <div class="relative">
                                <p class="text-sm text-text/80 leading-relaxed line-clamp-4 transition-opacity duration-300">
                                    {descriptionSnippet() || 'No description available'}
                                </p>
                            </div>
                        </div>

                        {/* Bottom */}
                        <div class="flex items-center justify-between pt-4 border-t border-white/10">
                            <div class="flex items-center gap-4">
                                {repackSize() && (
                                    <div class="flex items-center gap-2 px-4 py-2 bg-secondary/5 rounded-full border border-white/10 transition-all hover:bg-accent/20 hover:border-accent/30">
                                        <Download class="w-4 h-4 text-accent" />
                                        <span class="text-sm text-text">{repackSize()}</span>
                                    </div>
                                )}

                            </div>

                            <div class="flex items-center gap-3 z-50" >
                                <button
                                    onClick={toggleFavorite}
                                    class="relative p-3 rounded-full transition-all duration-300 bg-secondary/5  hover:bg-accent/20 border border-white/20 hover:border-accent/30 hover:scale-110 "
                                    title={isFavorite() ? "Remove from wishlist" : "Add to wishlist"}
                                >
                                    {isFavorite()
                                        ? <BookmarkCheck class="w-5 h-5 text-accent" />
                                        : <Bookmark class="w-5 h-5 text-text/70 group-hover:text-accent transition-colors" />
                                    }

                                </button>

                                <button
                                    onClick={handleGoToGame}
                                    class="px-5 py-2 bg-accent hover:bg-accent/80 border border-primary/60 text-text text-sm rounded-full transition-all duration-250 hover:scale-105"
                                >
                                    View Game
                                </button>
                            </div>
                        </div>
                    </div>
                </div>


            </div>

            <Show when={isFavorite()}>
                <div class="absolute top-4 left-4 z-10">
                    <div class="flex items-center gap-1.5 px-3 py-1 bg-secondary/40 backdrop-blur-sm rounded-full border border-accent/30">
                        <Star class="w-3 h-3 text-primary fill-primary" />
                        <span class="text-xs font-semibold text-primary">Wishlisted</span>
                    </div>
                </div>
            </Show>
        </div>
    );
}