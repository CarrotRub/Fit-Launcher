import { createSignal, createMemo, For } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import type { Game } from '../../../bindings';
import { commands } from '../../../bindings';
import { Bookmark, BookmarkCheck, Download } from 'lucide-solid';
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
    const [isHovered, setIsHovered] = createSignal(false);

    // Derived values
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

    const tags = createMemo(() => props.game.tag?.split(',').map(t => t.trim()).slice(0, 3) || []);

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
                notify(`Added to wishlist`, { type: "success" });
            } else {
                await library.removeGameToDownload(props.game.title);
                notify(`Removed from wishlist`, { type: "success" });
            }
        } catch {
            setIsFavorite(!newState);
            notify("Error updating wishlist", { type: "error" });
        }
    };

    // Use first secondary image (in-game screenshot) as background, fallback to main image
    const backgroundImage = createMemo(() =>
        props.game.secondary_images?.[0] || props.game.img
    );

    return (
        <div
            class="group relative rounded-lg overflow-hidden cursor-pointer"
            style={{
                "content-visibility": "auto",
                "contain-intrinsic-size": "auto 280px"
            }}
            onClick={handleGoToGame}
        >
            {/* Full-width background image (using in-game screenshot) */}
            <div class="absolute inset-0">
                <LazyImage src={backgroundImage()} alt="" class="w-full h-full" objectFit="cover" />
                {/* Dark overlay - much darker for text readability */}
                <div class="absolute inset-0 bg-black/50" />
                <div class="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-black/20" />
                <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
            </div>

            {/* Content overlay */}
            <div class="relative flex h-[280px]">
                {/* Left: Game cover image (prominent) */}
                <div class="w-[200px] h-full shrink-0 p-4">
                    <div class="relative w-full h-full rounded-md overflow-hidden shadow-2xl ring-1 ring-white/10">
                        <LazyImage src={props.game.img} alt={props.game.title} class="w-full h-full" objectFit="cover" />
                    </div>
                </div>

                {/* Right: Game info */}
                <div class="flex flex-col justify-between py-5 pr-6 pl-2 flex-1 min-w-0">
                    {/* Top section */}
                    <div>
                        {/* Title */}
                        <h3 class="text-2xl font-bold text-white mb-3 line-clamp-2 drop-shadow-lg">
                            {displayTitle()}
                        </h3>

                        {/* Tags */}
                        <div class="flex flex-wrap gap-1.5 mb-3">
                            <For each={tags()}>
                                {(tag) => (
                                    <span class="px-2.5 py-1 bg-accent/80 text-white rounded text-xs font-medium uppercase tracking-wide">
                                        {tag}
                                    </span>
                                )}
                            </For>
                        </div>

                        {/* Description */}
                        <p class="text-sm text-white line-clamp-5 leading-relaxed" style={{ "text-shadow": "0 1px 3px rgba(0,0,0,0.8), 0 2px 8px rgba(0,0,0,0.6)" }}>
                            {descriptionSnippet() || 'No description available'}
                        </p>
                    </div>

                    {/* Bottom section */}
                    <div class="flex items-center justify-between mt-4">
                        {/* Size badge */}
                        {repackSize() && (
                            <div class="flex items-center gap-2 px-3 py-1.5 bg-secondary-20/50 backdrop-blur rounded-full">
                                <Download class="w-4 h-4 text-accent" />
                                <span class="text-sm font-medium text-white">{repackSize()}</span>
                            </div>
                        )}

                        {/* Actions */}
                        <div class="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                            <button
                                onClick={toggleFavorite}
                                class="p-2.5 rounded-full transition-all duration-200 bg-secondary-20/50 hover:bg-secondary-20"
                                title={isFavorite() ? "Remove from library" : "Add to library"}
                            >
                                {isFavorite()
                                    ? <BookmarkCheck class="w-5 h-5 text-accent" />
                                    : <Bookmark class="w-5 h-5 text-white" />
                                }
                            </button>
                            <button
                                onClick={handleGoToGame}
                                class="px-5 py-2 bg-accent hover:bg-accent/80 text-text text-sm font-semibold rounded-full transition-all"
                            >
                                View Game
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
