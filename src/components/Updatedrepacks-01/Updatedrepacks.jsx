import './Updatedrepacks.css'
import { createEffect, createSignal, onMount } from 'solid-js'
import { appDataDir } from '@tauri-apps/api/path'

const appDir = await appDataDir()
const dirPath = appDir

const recentlyUpdatedGamesPath = `${dirPath}tempGames/recently_updated_games.json`
import readFile from '../functions/readFileRust'
import Slider from '../Slider-01/Slider'
import { translate } from '../../translation/translate'

/**
 * Get newly added games into the GameHub.
 */
async function parseNewGameData() {
    try {
        const fileContent = await readFile(recentlyUpdatedGamesPath)
        const gameData = JSON.parse(fileContent.content)

        // Load the user's settings to check if NSFW content should be hidden
        const settingsPath = `${dirPath}/fitgirlConfig/settings.json`
        const settingsContent = await readFile(settingsPath)
        const settings = JSON.parse(settingsContent.content)
        const hideNSFW = settings.hide_nsfw_content

        // Filter out NSFW games based on the "Adult" tag if the setting is enabled
        const filteredGameData = hideNSFW
            ? gameData.filter((game) => !game.tag.includes('Adult'))
            : gameData

        console.log(filteredGameData)
        return filteredGameData
    } catch (error) {
        console.error('Error parsing game data:', error)
        throw error
    }
}

function UpdatedGames() {
    const [imagesObject, setImagesObject] = createSignal(null)
    const [tags, setTags] = createSignal([]) // All unique tags
    const [selectedTags, setSelectedTags] = createSignal([]) // Selected tags
    const [filteredImages, setFilteredImages] = createSignal([]) // Images after filtering
    const [sliderComponent, setSliderComponent] = createSignal(null) // Hold slider component

    onMount(async () => {
        try {
            const data = await parseNewGameData()
            setImagesObject(data)

            const allTags = new Set()
            data.forEach((game) => {
                const tagsArray = game.tag.split(',').map((tag) => tag.trim())
                tagsArray.forEach((tag) => allTags.add(tag))
            })
            setTags(Array.from(allTags))

            // Initialize filtered images to show all initially
            setFilteredImages(data)
        } catch (error) {
            // Handle error if needed
        }
    })

    createEffect(() => {
        const currentImages = imagesObject()
        const currentSelectedTags = selectedTags()

        // If no tags are selected, set filtered images to all images
        if (currentSelectedTags.length === 0) {
            setFilteredImages(currentImages)
        } else {
            // Filter images based on selected tags
            const newFilteredImages = currentImages.filter(
                (game) =>
                    currentSelectedTags.every((tag) => game.tag.includes(tag)) // Change here to use 'every'
            )
            setFilteredImages(newFilteredImages)
        }

        // Render Slider when filteredImages changes
        setSliderComponent(
            filteredImages().length > 0 ? (
                <Slider
                    containerClassName="recently-updated"
                    imageContainerClassName="updated-games-container"
                    slides={filteredImages()}
                    filePath={recentlyUpdatedGamesPath}
                    showPrevNextButtons={true} // Set to false if you don't want to show prev/next buttons
                />
            ) : null
        )
    })

    const toggleTagSelection = (tag) => {
        setSelectedTags((prevTags) => {
            // If tag is already selected, remove it
            if (prevTags.includes(tag)) {
                return prevTags.filter((t) => t !== tag)
            }
            // If tag is not selected, add it
            return [...prevTags, tag]
        })
    }

    const resetFilters = () => {
        setSelectedTags([])
    }

    // Return the Slider component once the container is created and data is fetched
    return (
        <>
            <div className="title-category updatedgames">
                <h2>Recently Updated Games</h2>
                <div className="filter-box">
                    <details className="filter-details updatedgames">
                        <summary
                            onClick={(e) => {
                                e.preventDefault()
                                const details = document.querySelector(
                                    '.filter-details.updatedgames'
                                )
                                details.open = !details.open // Toggle the open state
                            }}
                        >
                            <svg
                                className="filter-icon"
                                xmlns="http://www.w3.org/2000/svg"
                                width="24"
                                height="24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                viewBox="0 0 24 24"
                            >
                                <polygon points="22 3 2 3 10 13 10 19 14 21 14 13 22 3"></polygon>
                            </svg>
                            {selectedTags().length > 0 && (
                                <span>({selectedTags().length})</span>
                            )}
                        </summary>
                        <ul className="tags-list">
                            {tags().map((tag) => (
                                <li
                                    key={tag}
                                    onClick={() => toggleTagSelection(tag)}
                                >
                                    <div className="checkbox-wrapper">
                                        <label>
                                            <input
                                                type="checkbox"
                                                checked={selectedTags().includes(
                                                    tag
                                                )}
                                                onChange={() =>
                                                    toggleTagSelection(tag)
                                                }
                                                className="custom-checkbox"
                                            />
                                            {tag}
                                        </label>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </details>
                    {/* <svg 
                        className='filter-reset-icon'
                        onClick={resetFilters}
                    >
                    </svg> */}
                </div>
            </div>
            {sliderComponent()} {/* Render Slider component here */}
        </>
    )
}

export default UpdatedGames
