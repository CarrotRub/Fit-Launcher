import './Newgames.css'
import { createEffect, createSignal, onMount } from 'solid-js'
import { appDataDir } from '@tauri-apps/api/path'
import readFile from '../functions/readFileRust'
import Slider from '../Slider-01/Slider'
import Swal from 'sweetalert2'

const appDir = await appDataDir()
const dirPath = appDir
const newlyAddedGamesPath = `${dirPath}tempGames/newly_added_games.json`

/**
 * Get newly added games into the GameHub.
 */
async function parseNewGameData() {
    try {
        const fileContent = await readFile(newlyAddedGamesPath)
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

        return filteredGameData
    } catch (error) {
        console.error('Error parsing game data:', error)
        throw error
    }
}

function Newgames() {
    const [imagesObject, setImagesObject] = createSignal([])
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
            Swal.fire({
                title: 'Error',
                html: `
                    <p>Error parsing game data, please close the app and open it again. If it still doesn't work, try a VPN.</p>
                    <p>This is a list of countries and/or ISPs that are known to block access to fitgirl-repacks:</p>
                    <ul>
                        <li><strong>Italy</strong></li>
                        <li><strong>Verizon</strong></li>
                        <li><strong>Germany</strong> (<em>ALWAYS USE A VPN IN GERMANY !</em>)</li>
                        <li><strong><em>Free Proton VPN may block P2P</em></strong></li>
                    </ul>
                    <p>If you know any more countries or ISP that blocks fitgirls repack website or P2P, please contact us on Discord, link in the settings.</p>
                `,
                footer: `Error: ${error}`,
                icon: 'error',
                confirmButtonText: 'Ok',
            })
        }
    })

    // Effect to filter images whenever selectedTags change
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
                    containerClassName="newly-added"
                    imageContainerClassName="games-container"
                    slides={filteredImages()} // Pass the filtered images
                    filePath={newlyAddedGamesPath}
                    showPrevNextButtons={true}
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

    return (
        <>
            <div className="title-category newgames">
                <h2>Newly Added Games</h2>
                <div className="filter-box">
                    <details className="filter-details newgames">
                        <summary
                            onClick={(e) => {
                                e.preventDefault()
                                const details = document.querySelector(
                                    '.filter-details.newgames'
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

export default Newgames
