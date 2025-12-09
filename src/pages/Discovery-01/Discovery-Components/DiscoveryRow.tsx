import { createSignal, createMemo, Show, For } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import type { Game } from '../../../bindings';
import { commands } from '../../../bindings';
import { Star, HardDrive, Factory, Languages } from 'lucide-solid';
import Button from '../../../components/UI/Button/Button';
import { LibraryApi } from '../../../api/library/api';
import { useToast } from 'solid-notifications';
import LazyImage from '../../../components/LazyImage/LazyImage';
import { extractCompany, extractLanguage, parseGameSize, formatBytesToSize } from '../../../helpers/gameFilters';

const library = new LibraryApi();

interface DiscoveryRowProps {
    game: Game;
    isFavorite: boolean;
}

export default function DiscoveryRow(props: DiscoveryRowProps) {
    const navigate = useNavigate();
    const { notify } = useToast();
    const [isFavorite, setIsFavorite] = createSignal(props.isFavorite);

    // Derived: game details (memoized)
    const details = createMemo(() => {
        const desc = props.game.details;
        if (!desc) return { companies: 'N/A', language: 'N/A', original: 'N/A', repack: 'N/A' };
        const originalBytes = parseGameSize(desc, 'original');
        const repackBytes = parseGameSize(desc, 'repack');
        return {
            companies: extractCompany(desc),
            language: extractLanguage(desc),
            original: originalBytes > 0 ? formatBytesToSize(originalBytes) : 'N/A',
            repack: repackBytes > 0 ? formatBytesToSize(repackBytes) : 'N/A'
        };
    });

    // Derived: clean title
    const displayTitle = createMemo(() =>
        props.game.title?.replace(/\s*[:\-]\s*$/, '').replace(/\(.*?\)/g, '').replace(/\s*[:\–]\s*$/, '').replace(/[\–].*$/, '') || props.game.title
    );

    // Derived: thumbnails and tags (sliced once)
    const thumbnails = createMemo(() => props.game.secondary_images?.slice(0, 2) || []);
    const tags = createMemo(() => props.game.tag?.split(',').map(t => t.trim()).slice(0, 4) || []);

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
                notify(`${props.game.title} added to favorites`, { type: "success" });
            } else {
                await library.removeGameToDownload(props.game.title);
                notify(`${props.game.title} removed from favorites`, { type: "success" });
            }
        } catch {
            setIsFavorite(!newState);
            notify("Error updating favorites", { type: "error" });
        }
    };

    return (
        // content-visibility: auto enables browser to skip rendering off-screen rows
        <div class="group relative flex flex-col md:flex-row bg-popup-background rounded-xl border border-secondary-20 overflow-hidden" style={{ "content-visibility": "auto", "contain-intrinsic-size": "auto 200px" }}>
            {/* Image Section */}
            <div class="w-full md:w-[45%] lg:w-[40%] xl:w-[35%] h-56 md:h-48 lg:h-52 shrink-0 flex gap-1 p-1 cursor-pointer" onClick={handleGoToGame}>
                {/* Main Image */}
                <div class="relative w-[75%] h-full rounded-lg overflow-hidden">
                    <LazyImage src={props.game.img} alt={props.game.title} class="w-full h-full" />
                </div>

                {/* Thumbnails */}
                <div class="flex flex-col gap-1 w-[25%] h-full">
                    <For each={thumbnails()}>
                        {(thumb) => (
                            <div class="relative w-full flex-1 rounded-md overflow-hidden bg-black/20">
                                <LazyImage src={thumb} class="w-full h-full" />
                            </div>
                        )}
                    </For>
                    <Show when={thumbnails().length === 0}>
                        <div class="w-full h-full bg-secondary-20/30 rounded-md flex items-center justify-center">
                            <span class="text-xs text-muted/50">No preview</span>
                        </div>
                    </Show>
                </div>
            </div>

            {/* Info Section */}
            <div class="flex flex-col grow p-4 md:py-3 md:px-5 justify-between">
                {/* Header */}
                <div>
                    <div class="flex justify-between items-start gap-2">
                        <h3 class="text-lg md:text-xl font-bold text-text cursor-pointer line-clamp-1" onClick={handleGoToGame} title={props.game.title}>
                            {displayTitle()}
                        </h3>
                        <div class="shrink-0 px-2 py-1 bg-secondary-100 rounded text-xs font-mono text-accent border border-accent/20">
                            {details().repack}
                        </div>
                    </div>

                    {/* Tags */}
                    <div class="flex flex-wrap gap-1.5 mt-2">
                        <For each={tags()}>
                            {(tag) => (
                                <span class="px-2 py-0.5 bg-secondary-20/50 text-muted rounded-full text-[10px] uppercase font-bold tracking-wider">
                                    {tag}
                                </span>
                            )}
                        </For>
                    </div>
                </div>

                {/* Metadata - using static icons to avoid recreation */}
                <div class="grid grid-cols-2 gap-x-8 gap-y-1 text-xs text-muted mt-3 mb-3">
                    <div class="flex items-center gap-2">
                        <HardDrive class="w-3.5 h-3.5 shrink-0" />
                        <span class="truncate">Original: <span class="text-text/80">{details().original}</span></span>
                    </div>
                    <div class="flex items-center gap-2">
                        <Factory class="w-3.5 h-3.5 shrink-0" />
                        <span class="truncate" title={details().companies}>Publisher: <span class="text-text/80">{details().companies}</span></span>
                    </div>
                    <div class="flex items-center gap-2 col-span-2">
                        <Languages class="w-3.5 h-3.5 shrink-0" />
                        <span class="truncate" title={details().language}>Language: <span class="text-text/80">{details().language}</span></span>
                    </div>
                </div>

                {/* Actions */}
                <div class="flex items-center justify-between pt-3 border-t border-secondary-20/50 mt-auto">
                    <Button label="View Details" size="sm" variant="bordered" onClick={handleGoToGame} />
                    <button onClick={toggleFavorite} class="p-2 rounded-lg hover:bg-secondary-20 transition-colors" title={isFavorite() ? "Remove from favorites" : "Add to favorites"}>
                        <Star class={`w-5 h-5 ${isFavorite() ? 'fill-accent text-accent' : 'text-muted'}`} />
                    </button>
                </div>
            </div>
        </div>
    );
}
