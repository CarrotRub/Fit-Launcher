import { createSignal, onMount, Show, JSX, For } from 'solid-js';
import { appDataDir, join } from '@tauri-apps/api/path';
import { mkdir, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { useNavigate } from '@solidjs/router';
import type { DiscoveryGame } from '../../../../bindings';
import { commands } from '../../../../bindings';
import { CircleArrowLeft, CircleArrowRight, Star, Info, Languages, HardDrive, Tags, Factory, ChevronLeft, ChevronRight } from 'lucide-solid';
import Button from '../../../../components/UI/Button/Button';
import { LibraryApi } from '../../../../api/library/api';
import { DOMElement } from 'solid-js/jsx-runtime';

const defaultPath: string = await commands.getNewlyAddedGamesPath();
const library = new LibraryApi();

//todo: fix tags

function HorizontalImagesCarousel({
    gameItemObject,
    preloadedDownloadLater
}: {
    gameItemObject: DiscoveryGame;
    preloadedDownloadLater: boolean;
}): JSX.Element {
    const navigate = useNavigate();
    const [clicked, setClicked] = createSignal(false);
    const [imagesList, setImagesList] = createSignal<string[]>([]);
    const [currentImage, setCurrentImage] = createSignal(0);
    const [isThrottled, setIsThrottled] = createSignal(false);
    const [isToDownloadLater, setToDownloadLater] = createSignal(preloadedDownloadLater);
    const [gameCompanies, setCompanies] = createSignal('N/A');
    const [gameLanguages, setLanguage] = createSignal('N/A');
    const [originalSize, setOriginalSize] = createSignal('N/A');
    const [repackSize, setRepackSize] = createSignal('N/A');

    async function checkIfInDownloadLater(title: string) {
        try {
            const list = await library.getGamesToDownload();
            const exists = list.some((g) => g.title === title);
            setToDownloadLater(exists);
        } catch (err) {
            console.error("Error checking download later list", err);
            setToDownloadLater(false);
        }
    }

    onMount(async () => {
        checkIfInDownloadLater(gameItemObject.game_title)
        setImagesList(gameItemObject.game_secondary_images);
        extractDetails(gameItemObject.game_description);

    });

    function throttle(callback: () => void, delay: number) {
        if (isThrottled()) return;
        setIsThrottled(true);
        callback();
        setTimeout(() => setIsThrottled(false), delay);
    }

    function prevSlide() {
        throttle(() => {
            setCurrentImage((current) => (current - 1 + imagesList().length) % imagesList().length);
        }, 400);
    }

    function nextSlide() {
        throttle(() => {
            setCurrentImage((current) => (current + 1) % imagesList().length);
        }, 400);
    }

    function getSlideClass(index: number): string {
        const total = imagesList().length;
        if (index === currentImage()) return 'active';
        if (index === (currentImage() - 1 + total) % total) return 'left';
        if (index === (currentImage() + 1) % total) return 'right';
        return 'hidden';
    }

    function extractMainTitle(title: string): string {
        return title
            ?.replace(/\s*[:\-]\s*$/, '')
            ?.replace(/\(.*?\)/g, '')
            ?.replace(/\s*[:\–]\s*$/, '')
            ?.replace(/[\–].*$/, '') ?? title;
    }

    function extractDetails(description: string) {
        const companiesMatch = description.match(/Companies?:\s*([^\n]+)/);
        const languageMatch = description.match(/Languages:\s*([^\n]+)/);
        const originalSizeMatch = description.match(/Original Size:\s*([^\n]+)/);
        const repackSizeMatch = description.match(/Repack Size:\s*([^\n]+)/);

        setCompanies(companiesMatch?.[1]?.trim() ?? 'N/A');
        setLanguage(languageMatch?.[1]?.trim() ?? 'N/A');
        setOriginalSize(originalSizeMatch?.[1]?.trim() ?? 'N/A');
        setRepackSize(repackSizeMatch?.[1]?.trim() ?? 'N/A');
    }



    async function handleAddToDownloadLater(gameData: DiscoveryGame, checked: boolean) {
        if (!gameData) return;
        if (checked) {
            await library.addGameToCollection("games_to_download", library.discoveryGameToGame(gameData));
        } else {
            await library.removeGameToDownload(gameData.game_title);
        }

    }

    async function handleCheckboxChange(e: Event) {
        const target = e.target as HTMLInputElement;
        const isChecked = target.checked;
        setToDownloadLater(isChecked);
        await handleAddToDownloadLater(gameItemObject, isChecked);
    }

    async function handleGoToGamePage(e: MouseEvent & { target: DOMElement; }) {
        
        if(e.target?.closest('.ignore-game-selection')) return

        if (!clicked()) {
            setClicked(true);
            const uuid = await commands.hashUrl(gameItemObject.game_href);
            navigate(`/game/${uuid}`, {
                state: { gameHref: gameItemObject.game_href, gameTitle: gameItemObject.game_title, filePath: defaultPath }
            });
        }
    }

    return (
        <Show when={imagesList().length > 0}>
            <div 
                onClick={async (e) =>
                            await handleGoToGamePage(e)
                        } 
                class="cursor-pointer relative w-full flex flex-col gap-4 max-w-6xl mx-auto p-6 bg-popup rounded-xl shadow-2xl border border-secondary-20 transition-all will-change-transform hover:shadow-accent/20">
                {/* 3D Carousel */}
                <div class="relative flex justify-center h-96 w-full overflow-hidden  will-change-transform perspective-1000">
                    {imagesList().map((image, index) => (
                        <div
                            class={`absolute top-0 aspect-auto  origin-center h-full flex items-center justify-center transition-all duration-700 ease-[cubic-bezier(0.25,0.1,0.25,1)] ${getSlideClass(index) === 'active'
                                ? 'translate-x-0 scale-110 opacity-100 z-30 rotate-y-0'
                                : getSlideClass(index) === 'left'
                                    ? '-translate-x-[110%] scale-95 opacity-70 z-20 rotate-y-12'
                                    : getSlideClass(index) === 'right'
                                        ? 'translate-x-[110%] scale-95 opacity-70 z-20 -rotate-y-12'
                                        : 'opacity-0 pointer-events-none z-10'
                                }`}
                        >
                            <img
                                src={image}
                                alt={`Slide ${index}`}
                                loading="lazy"
                                class="w-full h-[80%] rounded-xl object-cover shadow-lg transition-transform duration-300 hover:scale-102 hover:shadow-secondary-30"
                            />
                        </div>
                    ))}
                </div>

                {/* Navigation Arrows */}
                <div class="w-full flex justify-between transform pointer-events-none z-40 px-2 ignore-game-selection">

                    <button
                        onClick={prevSlide}
                        class="w-10 h-10 pointer-events-auto flex items-center justify-center z-20 rounded-full bg-background/90 backdrop-blur-md border border-secondary-20 shadow-lg hover:bg-accent/20 transition-all duration-300 hover:scale-110"
                    >
                        <ChevronLeft size={20} class="text-text" stroke-width={1.5} />
                    </button>

                    <button
                        onClick={nextSlide}
                        class="w-10 h-10 pointer-events-auto flex items-center justify-center z-20 rounded-full bg-background/90 backdrop-blur-md border border-secondary-20 shadow-lg hover:bg-accent/20 transition-all duration-300 hover:scale-110"
                    >
                        <ChevronRight size={20} class="text-text" stroke-width={1.5} />
                    </button>

                </div>
                <Show when={imagesList().length > 1}>
                    <div class="flex flex-row self-center gap-2 z-30 ignore-game-selection">
                        <For each={imagesList()}>
                            {(_, index) => (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setCurrentImage(index()); // you likely already have this signal
                                    }}
                                    class={`w-3 h-3 rounded-full transition-all duration-300 ${currentImage() === index()
                                        ? 'bg-accent w-6 scale-125 shadow-sm shadow-accent/50'
                                        : 'bg-secondary-20 hover:bg-accent/50'
                                        }`}
                                />
                            )}
                        </For>
                    </div>
                </Show>

                {/* Game Info */}
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-secondary-20">
                    <div>
                        <h2 class="text-2xl font-bold bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent mb-1">
                            {extractMainTitle(gameItemObject.game_title)}
                        </h2>
                        <p class="text-muted italic text-sm mb-4">
                            {gameItemObject.game_title}
                        </p>

                        <div class="flex items-center gap-2 text-sm text-muted mb-2">
                            <Tags class="w-4 h-4" />
                            <span class="font-medium">Tags:</span>
                            <span>{gameItemObject.game_tags || 'N/A'}</span>
                        </div>
                    </div>

                    <div class="space-y-3">
                        <div class="flex items-center gap-2 text-sm">
                            <HardDrive class="w-4 h-4 text-accent" />
                            <span class="font-medium">Repack Size:</span>
                            <span class="text-muted">{repackSize()}</span>
                        </div>
                        <div class="flex items-center gap-2 text-sm">
                            <HardDrive class="w-4 h-4 text-accent" />
                            <span class="font-medium">Original Size:</span>
                            <span class="text-muted">{originalSize()}</span>
                        </div>
                        <div class="flex items-center gap-2 text-sm">
                            <Languages class="w-4 h-4 text-accent" />
                            <span class="font-medium">Languages:</span>
                            <span class="text-muted">{gameLanguages()}</span>
                        </div>
                        <div class="flex items-center gap-2 text-sm">
                            <Factory class="w-4 h-4 text-accent" />
                            <span class="font-medium">Companies:</span>
                            <span class="text-muted">{gameCompanies()}</span>
                        </div>
                    </div>
                </div>

                <label class="absolute bottom-4 right-4 cursor-pointer select-none z-10 group ignore-game-selection">
                    <input
                        type="checkbox"
                        checked={isToDownloadLater()}
                        onChange={handleCheckboxChange}
                        class="absolute opacity-0 h-0 w-0"
                    />
                    <Star
                        class="w-10 h-10 transition-all duration-300 group-hover:scale-110"
                        classList={{
                            'fill-accent text-accent/80': isToDownloadLater(),
                            'fill-secondary-20 text-muted hover:fill-accent/30': !isToDownloadLater()
                        }}
                        stroke-width={1.5}
                    />
                </label>
            </div>
        </Show>
    );
}

export default HorizontalImagesCarousel;