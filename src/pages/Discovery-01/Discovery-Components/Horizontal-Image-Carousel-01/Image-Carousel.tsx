import { createSignal, onMount, Show, JSX } from 'solid-js';

import { appDataDir, join } from '@tauri-apps/api/path';
import { mkdir, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { setDownloadGamePageInfo } from '../../../../components/functions/dataStoreGlobal';
import { useNavigate } from '@solidjs/router';
import type { DiscoveryGame } from '../../../../bindings';
import { commands } from '../../../../bindings';
import { CircleArrowLeft, CircleArrowRight, Star } from 'lucide-solid';

// todo: make a subcrate that handles library logic
const defaultPath: string = await commands.getNewlyAddedGamesPath();

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

    onMount(async () => {
        const appDir = await appDataDir();
        const userToDownloadGamesPath = await join(appDir, 'library', 'games_to_download.json');
        setImagesList(gameItemObject.game_secondary_images);
        extractDetails(gameItemObject.game_description);

        try {
            const fileContent = await readTextFile(userToDownloadGamesPath);
            const currentData: { title: string }[] = JSON.parse(fileContent);
            const gameExists = currentData.some(game => game.title === gameItemObject.game_title);
            setToDownloadLater(gameExists);
        } catch {
            setToDownloadLater(false);
        }
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

    function transformGameData(gameData: DiscoveryGame) {
        return {
            title: gameData.game_title,
            img: gameData.game_main_image,
            desc: gameData.game_description,
            magnetlink: gameData.game_magnetlink,
            href: gameData.game_href,
            tag: gameData.game_tags,
            filePath: defaultPath
        };
    }

    async function handleAddToDownloadLater(gameData: DiscoveryGame, isChecked: boolean) {
        const appDir = await appDataDir();
        const filePath = await join(appDir, 'library', 'games_to_download.json');
        const libraryDir = await join(appDir, 'library');

        try {
            await mkdir(libraryDir, { recursive: true });
        } catch (error) {
            console.error('Error creating directory:', error);
        }

        let currentData: any[] = [];
        try {
            const content = await readTextFile(filePath);
            currentData = JSON.parse(content);
        } catch { }

        const transformed = transformGameData(gameData);
        const gameExists = currentData.some(g => g.title === transformed.title);

        if (isChecked && !gameExists) {
            currentData.push(transformed);
        } else if (!isChecked && gameExists) {
            currentData = currentData.filter(g => g.title !== transformed.title);
        }

        try {
            await writeTextFile(filePath, JSON.stringify(currentData, null, 2));
        } catch (err) {
            console.error('Error writing to file', err);
        }
    }

    async function handleCheckboxChange(e: Event) {
        const target = e.target as HTMLInputElement;
        const isChecked = target.checked;
        setToDownloadLater(isChecked);
        await handleAddToDownloadLater(gameItemObject, isChecked);
    }

    function handleGoToGamePage(title: string, filePath: string, href: string) {
        if (!clicked()) {
            setClicked(true);
            const uuid = crypto.randomUUID();
            setDownloadGamePageInfo({ gameTitle: title, gameHref: href, filePath });
            window.location.href = `/game/${uuid}`;
        }
    }

    return (
        <Show when={imagesList().length > 0}>
            <div class="relative w-4/5 xl:w-3/5 mx-auto py-4 px-8 flex flex-col items-center justify-center mt-8 border border-accent rounded-md transition-transform will-change-transform">
                <label class="absolute top-0 right-0 cursor-pointer select-none z-10">
                    <input
                        type="checkbox"
                        checked={isToDownloadLater()}
                        onChange={handleCheckboxChange}

                        class="absolute opacity-0 h-0 w-0"
                    />
                    <Star class="w-12 h-12 fill-neutral-500 hover:scale-110 transition-transform " style={{
                        fill: isToDownloadLater() ? 'var(--color-accent)' : '#666'
                    }} stroke-width={0} />
                </label>

                <div class="relative flex justify-center h-80 w-full overflow-hidden mb-4 will-change-transform">
                    {imagesList().map((image, index) => (
                        <div
                            class={`absolute top-0 w-[40%] h-full flex items-center justify-center transition-all duration-500 ${getSlideClass(index) === 'active'
                                ? 'translate-x-0 scale-140 opacity-100 z-30'
                                : getSlideClass(index) === 'left'
                                    ? '-translate-x-[110%] scale-95 opacity-60 z-20'
                                    : getSlideClass(index) === 'right'
                                        ? 'translate-x-[110%] scale-95 opacity-60 z-20'
                                        : 'opacity-0 pointer-events-none z-10'
                                }`}
                        >
                            <img
                                src={image}
                                alt={`Slide ${index}`}
                                loading="lazy"
                                class="w-full h-50 rounded-xl object-cover shadow-lg cursor-pointer transition-transform hover:scale-105"
                                onClick={() =>
                                    handleGoToGamePage(
                                        gameItemObject.game_title,
                                        defaultPath,
                                        gameItemObject.game_href
                                    )
                                }
                            />
                        </div>
                    ))}
                </div>

                <div class="absolute top-1/2 w-full flex justify-between transform -translate-y-1/2 pointer-events-none z-40">
                    <div
                        class="text-accent p-1 cursor-pointer pointer-events-auto flex hover:scale-110 transition-transform"
                        onClick={prevSlide}
                    >
                        <CircleArrowLeft stroke-width={1} />
                    </div>
                    <div
                        class="text-accent p-1 cursor-pointer pointer-events-auto flex hover:scale-110 transition-transform"
                        onClick={nextSlide}
                    >
                        <CircleArrowRight stroke-width={1} />
                    </div>
                </div>

                <div class="flex flex-row justify-between w-full gap-2 pt-4 relative">
                    <div class="absolute top-0 left-1/2 transform -translate-x-1/2 w-4/5 h-px bg-accent" />
                    <div class="flex flex-col">
                        <p class="text-lg font-semibold font-mulish">
                            {extractMainTitle(gameItemObject.game_title)}
                        </p>
                        <p class="text-sm italic text-muted font-light font-mulish">
                            {gameItemObject.game_title}
                        </p>
                        <p class="mt-4">
                            <b>Tags:</b>{' '}
                            <span class="italic font-light">{gameItemObject.game_tags}</span>
                        </p>
                    </div>
                    <div class="flex flex-col text-right">
                        <p>
                            <b>Repack Size:</b>{' '}
                            <span class="italic font-light">{repackSize()}</span>
                        </p>
                        <p>
                            <b>Original Size:</b>{' '}
                            <span class="italic font-light">{originalSize()}</span>
                        </p>
                    </div>
                </div>
            </div>
        </Show>
    );
}

export default HorizontalImagesCarousel;
