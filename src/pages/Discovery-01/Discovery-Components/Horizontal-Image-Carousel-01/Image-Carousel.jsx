import { createSignal, onMount, Show } from 'solid-js';
import './Image-Carousel.css';
import { appDataDir, join } from '@tauri-apps/api/path';
import { mkdir, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { setDownloadGamePageInfo } from '../../../../components/functions/dataStoreGlobal';
import { useNavigate } from '@solidjs/router';
const appDir = await appDataDir();

const userToDownloadGamesPath = await join(appDir, 'library', 'games_to_download.json');
const defaultPath = await join(appDir, 'tempGames', 'newly_added_games.json');

function HorizontalImagesCarousel({ gameItemObject }) {
    const navigate = useNavigate();
    const [clicked, setClicked] = createSignal(false)
    const [imagesList, setImagesList] = createSignal([])
    const [currentImage, setCurrentImage] = createSignal(0); // Start with the first image
    const [isThrottled, setIsThrottled] = createSignal(false); // Throttle state
    const [isToDownloadLater, setToDownloadLater] = createSignal(false);

    const [gameCompanies, setCompanies] = createSignal('N/A');
    const [gameLanguages, setLanguage] = createSignal('N/A');
    const [originalSize, setOriginalSize] = createSignal('N/A');
    const [repackSize, setRepackSize] = createSignal('N/A');

    onMount(async () => {
        setImagesList(gameItemObject.game_secondary_images)

        extractDetails(gameItemObject.game_description)

        try {
            const fileContent = await readTextFile(userToDownloadGamesPath);
            let currentData = JSON.parse(fileContent);
            const gameExists = currentData.some(game => game.title === gameItemObject.game_title);

            if (gameExists) {
                setToDownloadLater(true);
            } else {
                setToDownloadLater(false);
            }
        } catch (error) {
            // Handle case where the file does not exist yet (initialize with an empty array)
            setToDownloadLater(false);
        }
    })

    const throttle = (callback, delay) => {
        if (isThrottled()) return; // Ignore if already throttled
        setIsThrottled(true);
        callback(); // Execute the navigation callback
        setTimeout(() => setIsThrottled(false), delay); // Reset throttle after delay
    };

    const prevSlide = () => {
        throttle(() => {
            setCurrentImage((current) => (current - 1 + imagesList().length) % imagesList().length);
        }, 400);
    };

    const nextSlide = () => {
        throttle(() => {
            setCurrentImage((current) => (current + 1) % imagesList().length);
        }, 400);
    };

    const getSlideClass = (index) => {
        const total = imagesList().length;
        if (index === currentImage()) return 'active';
        if (index === (currentImage() - 1 + total) % total) return 'left';
        if (index === (currentImage() + 1) % total) return 'right';
        return 'hidden';
    };


    function extractMainTitle(title) {
        const simplifiedTitle = title
            ?.replace(/\s*[:\-]\s*$/, '')
            ?.replace(/\(.*?\)/g, '')
            ?.replace(/\s*[:\–]\s*$/, '') // Clean up any trailing colons or hyphens THIS IS A FKCNG EN DASH AND NOT A HYPHEN WTF
            ?.replace(/[\–].*$/, '')

        return simplifiedTitle
    }

    function extractDetails(description) {
        let genresTagsMatch = description?.match(/Genres\/Tags:\s*([^\n]+)/);
        let companiesMatch = description?.match(/Company:\s*([^\n]+)/);
        if (companiesMatch === null) {
            companiesMatch = description?.match(/Companies:\s*([^\n]+)/);
        }
        const languageMatch = description?.match(/Languages:\s*([^\n]+)/);
        const originalSizeMatch = description?.match(/Original Size:\s*([^\n]+)/);
        const repackSizeMatch = description?.match(/Repack Size:\s*([^\n]+)/);

        setCompanies(companiesMatch ? companiesMatch[1]?.trim() : 'N/A');
        setLanguage(languageMatch ? languageMatch[1]?.trim() : 'N/A');
        setOriginalSize(originalSizeMatch ? originalSizeMatch[1]?.trim() : 'N/A');
        setRepackSize(repackSizeMatch ? repackSizeMatch[1]?.trim() : 'N/A');
    }

    //** 
    // Helper function to transform the data from this pretty formatting and structuring to the other weird disgusting shit, but this will be useless anyways when I'll change (yet again) the whole scraping system.
    // 
    // */
    function transformGameData(gameData) {
        return {
            title: gameData.game_title,
            img: gameData.game_main_image,
            desc: gameData.game_description,
            magnetlink: gameData.game_magnetlink,
            href: gameData.game_href,
            tag: gameData.game_tags,
        };
    }


    async function handleAddToDownloadLater(gameData, isChecked) {
        let currentData = [];
        gameData = transformGameData(gameData)
        try {
            let toDownloadDirPath = await join(appDir, 'library');
            await mkdir(toDownloadDirPath, { recursive: true });
        } catch (error) {
            console.error('Error creating directory:', error);
        }

        try {
            const fileContent = await readTextFile(userToDownloadGamesPath);
            currentData = JSON.parse(fileContent);
        } catch (error) {
            console.log('No existing file found, starting fresh...');
        }

        const gameExists = currentData.some(game => game.title === gameData.title);

        if (isChecked && !gameExists) {
            gameData.filePath = defaultPath;
            currentData.push(gameData);

        } else if (!isChecked && gameExists) {
            currentData = currentData.filter(game => game.title !== gameData.title);
        }

        try {
            await writeTextFile(userToDownloadGamesPath, JSON.stringify(currentData, null, 2));
        } catch (error) {
            console.error('Error writing to file', error);
        }
    }

    const handleCheckboxChange = async (e) => {
        const isChecked = e.target.checked;
        setToDownloadLater(isChecked);

        await handleAddToDownloadLater(gameItemObject, isChecked);
    };
    const handleGoToGamePage = (title, filePath, href) => {
        if (!clicked()) {
            console.log(href)
            setClicked(true);
            const uuid = crypto.randomUUID();
            setDownloadGamePageInfo({
                gameTitle: title,
                gameHref: href,
                filePath: filePath
            })
            navigate(`/game/${uuid}`);
        }
    };
    return (
        <Show when={imagesList().length > 0}>
            <div className="horizontal-images-slider-container">
                <label class="container-star-horinzontal-image-slider">
                    <input
                        type="checkbox"
                        checked={isToDownloadLater()}
                        onChange={handleCheckboxChange} />
                    <svg height="24px" id="Layer_1" version="1.2" viewBox="0 0 24 24" width="24px" xml:space="preserve" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><g><g><path d="M9.362,9.158c0,0-3.16,0.35-5.268,0.584c-0.19,0.023-0.358,0.15-0.421,0.343s0,0.394,0.14,0.521    c1.566,1.429,3.919,3.569,3.919,3.569c-0.002,0-0.646,3.113-1.074,5.19c-0.036,0.188,0.032,0.387,0.196,0.506    c0.163,0.119,0.373,0.121,0.538,0.028c1.844-1.048,4.606-2.624,4.606-2.624s2.763,1.576,4.604,2.625    c0.168,0.092,0.378,0.09,0.541-0.029c0.164-0.119,0.232-0.318,0.195-0.505c-0.428-2.078-1.071-5.191-1.071-5.191    s2.353-2.14,3.919-3.566c0.14-0.131,0.202-0.332,0.14-0.524s-0.23-0.319-0.42-0.341c-2.108-0.236-5.269-0.586-5.269-0.586    s-1.31-2.898-2.183-4.83c-0.082-0.173-0.254-0.294-0.456-0.294s-0.375,0.122-0.453,0.294C10.671,6.26,9.362,9.158,9.362,9.158z"></path></g></g></svg>
                </label>
                <div className="images-wrapper">
                    {imagesList().map((image, index) => (
                        <div key={index} className={`slide ${getSlideClass(index)}`}>
                            <img
                                src={image}
                                data-src={image}
                                alt={`Slide ${index}`}
                                loading="lazy"
                                onClick={() => handleGoToGamePage(gameItemObject.game_title, defaultPath, gameItemObject.game_href)}
                            />
                        </div>
                    ))}
                </div>
                <div className="carousel-skipper-slider-container">
                    <div
                        className="carousel-skipper left"
                        onClick={prevSlide}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M16 12H8m4-4-4 4 4 4" />
                        </svg>
                    </div>
                    <div
                        className="carousel-skipper right"
                        onClick={nextSlide}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M8 12h8m-4 4 4-4-4-4" />
                        </svg>
                    </div>
                </div>

                <div className="discovery-game-item-info-container">
                    <div className="discovery-game-item-main-info">
                        <p className="discovery-game-main-title">{extractMainTitle(gameItemObject.game_title)}</p>
                        <p className="discovery-game-secondary-title">{gameItemObject.game_title}</p>
                        <p className="discovery-game-tags"><b>Tags : </b><span>{gameItemObject.game_tags}</span></p>
                    </div>
                    <div className="discovery-game-item-secondary-info">
                        <p className="discovery-game-tags"><b>Repack Size : </b><span>{repackSize()}</span></p>
                        <p className="discovery-game-tags"><b>Original Size : </b><span>{originalSize()}</span></p>
                    </div>
                </div>
            </div>
        </Show>
    );
}

export default HorizontalImagesCarousel;
