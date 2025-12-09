import { createSignal, createMemo, Show, JSX, For } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import type { Game } from '../../../bindings';
import { commands } from '../../../bindings';
import { Star, HardDrive, Factory, Languages, Tags } from 'lucide-solid';
import Button from '../../../components/UI/Button/Button';
import { LibraryApi } from '../../../api/library/api';
import { useToast } from 'solid-notifications';
import LazyImage from '../../../components/LazyImage/LazyImage';
import { extractCompany, extractLanguage, parseGameSize, formatBytesToSize } from '../../../helpers/gameFilters';

const defaultPath: string = await commands.getSearchIndexPathCmd();
const library = new LibraryApi();

export default function DiscoveryRow({
    gameItemObject,
    preloadedDownloadLater
}: {
    gameItemObject: Game;
    preloadedDownloadLater: boolean;
}): JSX.Element {
    const navigate = useNavigate();
    const [isToDownloadLater, setToDownloadLater] = createSignal(preloadedDownloadLater);
    const { notify } = useToast();

    // Optimize: Compute details once, synchronously, without signals
    const details = createMemo(() => {
        const desc = gameItemObject.details;
        if (!desc) return { companies: 'N/A', language: 'N/A', original: 'N/A', repack: 'N/A' };

        const companies = extractCompany(desc);
        const language = extractLanguage(desc);
        const originalBytes = parseGameSize(desc, 'original');
        const repackBytes = parseGameSize(desc, 'repack');

        return {
            companies,
            language,
            original: originalBytes > 0 ? formatBytesToSize(originalBytes) : 'N/A',
            repack: repackBytes > 0 ? formatBytesToSize(repackBytes) : 'N/A'
        };
    });

    // Optimize: Extract title once
    const displayTitle = createMemo(() => {
        const title = gameItemObject.title;
        return title
            ?.replace(/\s*[:\-]\s*$/, '')
            ?.replace(/\(.*?\)/g, '')
            ?.replace(/\s*[:\–]\s*$/, '')
            ?.replace(/[\–].*$/, '') ?? title;
    });

    async function handleAddToDownloadLater() {
        const newState = !isToDownloadLater();
        setToDownloadLater(newState);

        if (newState) {
            await library.addGameToCollection("games_to_download", gameItemObject);
            notify(`${gameItemObject.title} added to favorites`, { type: "success" });
        } else {
            await library.removeGameToDownload(gameItemObject.title);
            notify(`${gameItemObject.title} removed from favorites`, { type: "success" });
        }
    }

    async function handleGoToGamePage() {
        const uuid = await commands.hashUrl(gameItemObject.href);
        navigate(`/game/${uuid}`, {
            state: {
                gameHref: gameItemObject.href,
                gameTitle: gameItemObject.title,
                filePath: defaultPath
            }
        });
    }

    // Image logic
    const primaryImage = () => gameItemObject.img;
    const thumbnails = () => gameItemObject.secondary_images?.slice(0, 3) || [];
    const tags = () => gameItemObject.tag?.split(',').map(t => t.trim()).slice(0, 4) || [];

    return (
        <div class="group relative flex flex-col md:flex-row bg-popup-background rounded-xl border border-secondary-20 overflow-hidden">

            {/* Left: Image Collage (Clickable) */}
            <div
                class="w-full md:w-[45%] lg:w-[40%] xl:w-[35%] h-56 md:h-48 lg:h-52 shrink-0 flex gap-1 p-1 cursor-pointer"
                onClick={handleGoToGamePage}
            >
                {/* Main Image - Takes 75% width */}
                <div class="relative w-[75%] h-full rounded-lg overflow-hidden shadow-md">
                    <LazyImage
                        src={primaryImage()}
                        alt={gameItemObject.title}
                        class="w-full h-full object-cover"
                    />
                </div>

                {/* Thumbnails Strip - Takes 25% width */}
                <div class="flex flex-col gap-1 w-[25%] h-full">
                    <For each={thumbnails()}>
                        {(thumb, i) => (
                            <div class="relative w-full h-full rounded-md overflow-hidden bg-black/20">
                                <LazyImage
                                    src={thumb}
                                    alt={`Thumb ${i()}`}
                                    class="w-full h-full object-cover opacity-80"
                                />
                            </div>
                        )}
                    </For>
                    {/* Fallback pattern if no thumbnails */}
                    <Show when={thumbnails().length === 0}>
                        <div class="w-full h-full bg-secondary-20/30 rounded-md flex items-center justify-center">
                            <span class="text-xs text-muted/50">No preview</span>
                        </div>
                    </Show>
                </div>
            </div>

            {/* Right: Info & Actions */}
            <div class="flex flex-col grow p-4 md:py-3 md:px-5 justify-between relative">

                {/* Header Section */}
                <div>
                    <div class="flex justify-between items-start gap-2">
                        <h3
                            class="text-lg md:text-xl font-bold text-text transition-colors cursor-pointer line-clamp-1"
                            onClick={handleGoToGamePage}
                            title={gameItemObject.title}
                        >
                            {displayTitle()}
                        </h3>

                        {/* Repack Size Badge */}
                        <div class="shrink-0 px-2 py-1 bg-secondary-100 rounded text-xs font-mono text-accent border border-accent/20">
                            {details().repack}
                        </div>
                    </div>

                    {/* Tags */}
                    <div class="flex flex-wrap gap-1.5 mt-2">
                        <For each={tags()}>
                            {tag => (
                                <span class="px-2 py-0.5 bg-secondary-20/50 text-muted rounded-full text-[10px] uppercase font-bold tracking-wider cursor-default">
                                    {tag}
                                </span>
                            )}
                        </For>
                    </div>
                </div>

                {/* Metadata Grid */}
                <div class="grid grid-cols-2 gap-x-8 gap-y-1 text-xs text-muted mt-3 mb-3">
                    <div class="flex items-center gap-2">
                        <HardDrive class="w-3.5 h-3.5" />
                        <span>Original Size: <span class="text-text/80">{details().original}</span></span>
                    </div>
                    <div class="flex items-center gap-2">
                        <Factory class="w-3.5 h-3.5" />
                        <span class="truncate" title={details().companies}>Publisher: <span class="text-text/80">{details().companies}</span></span>
                    </div>
                    <div class="flex items-center gap-2 col-span-2">
                        <Languages class="w-3.5 h-3.5" />
                        <span class="truncate" title={details().language}>Language: <span class="text-text/80">{details().language}</span></span>
                    </div>
                </div>

                {/* Actions Footer */}
                <div class="flex items-center justify-between pt-3 border-t border-secondary-20/50 mt-auto">
                    <div class="flex items-center gap-2">
                        <Button
                            label="View Details"
                            size="sm"
                            variant="bordered"
                            onClick={handleGoToGamePage}
                            class="opacity-90 hover:opacity-100"
                        />
                    </div>

                    <button
                        onClick={(e) => { e.stopPropagation(); handleAddToDownloadLater(); }}
                        class="p-2 rounded-lg hover:bg-secondary-20 transition-colors group/star"
                        title={isToDownloadLater() ? "Remove from favorites" : "Add to favorites"}
                    >
                        <Star
                            class={`w-5 h-5 transition-all ${isToDownloadLater() ? 'fill-accent text-accent' : 'text-muted group-hover/star:text-text'}`}
                        />
                    </button>
                </div>

            </div>
        </div>
    );
}
