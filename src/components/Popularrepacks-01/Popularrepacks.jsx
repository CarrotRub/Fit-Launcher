import './Popularrepacks.css'
import { createEffect, createSignal, onMount } from 'solid-js'
import { appDataDir } from '@tauri-apps/api/path'
import readFile from '../functions/readFileRust'
import Slider from '../Slider-01/Slider'

const appDir = await appDataDir()
const dirPath = appDir

const popularRepacksPath = `${dirPath}tempGames/popular_games.json`

/**
 * Get newly added games into the GameHub.
 */
async function parseNewGameData() {
    try {
        const fileContent = await readFile(popularRepacksPath)
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

function extractMainTitle(title) {
    const regex = /^(.+?)(?=[:,-])/ // Regular expression to match text before the first colon, comma, or hyphen
    const match = title.match(regex)
    return match ? match[0].trim() : title // Extracted main title or the original title if no match
}

function extractSecondaryTitle(title) {
    const regex = /[:,-](.+)/ // Regular expression to match text after the first colon, comma, or hyphen
    const match = title.match(regex)
    return match ? match[1].trim() : title // Extracted secondary title or the original title if no match
}

function Popularrepacks() {
    const [imagesObject, setImagesObject] = createSignal(null)
    const [firstGameTitle, setFirstGameTitle] = createSignal('')
    const [tags, setTags] = createSignal([]) // All unique tags
    const [selectedTags, setSelectedTags] = createSignal([]) // Selected tags
    const [filteredImages, setFilteredImages] = createSignal([]) // Images after filtering
    const [sliderComponent, setSliderComponent] = createSignal(null) // Hold slider component

    onMount(async () => {
        console.log('Popularrepacks component mounted')
        try {
            const data = await parseNewGameData()
            setImagesObject(data)
            const titles = data.map((game) => extractMainTitle(game.title))
            setFirstGameTitle(titles[0] || '') // Set the title of the first game
            const firstSlide = document.querySelector(
                `.games-container-pop .slide:first-child`
            )
            if (firstSlide) {
                const titlesNo = data.map((game) =>
                    extractSecondaryTitle(game.title)
                )
                const firstGameTitleElement = document.createElement('h4')
                firstGameTitleElement.id = 'first-game-title'
                firstGameTitleElement.textContent = titles[0] || ''
                const firstLongGameTitleElement = document.createElement('h5')
                firstLongGameTitleElement.id = 'first-long-game-title'
                firstLongGameTitleElement.textContent = titlesNo[0]
                firstSlide.appendChild(firstGameTitleElement)
                firstSlide.appendChild(firstLongGameTitleElement)
            }

            const slide0 = document.querySelector(
                `.games-container-pop .slide:first-child img`
            )
            const slide1 = document.querySelector(
                `.games-container-pop .slide:nth-child(2) img`
            )

            if (slide0) {
                const imgSrc0 = data.map((game) => game.img)
                //console.log(imgSrc0) // Comment out - takes up a lot of space in the console
                const srcParts0 = imgSrc0[0].split(',')
                slide0.src = srcParts0[0].trim()
            }

            if (slide1) {
                const imgSrc1 = data.map((game) => game.img)
                const srcParts1 = imgSrc1[1].split(',')

                // Check if the string contains a comma
                if (srcParts1.length > 1) {
                    // If there is a comma, use the part after the comma
                    slide1.src = srcParts1[1].trim()
                } else {
                    // If there is no comma, use the whole string
                    slide1.src = srcParts1[0].trim()
                }
            }

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
            console.error('Error during component mount:', error)
        }
    })

    createEffect(() => {
        const currentImages = imagesObject()
        const currentSelectedTags = selectedTags()

        // If no tags are selected, set filtered images to all images
        if (currentSelectedTags.length === 0) {
            setFilteredImages(currentImages)
            console.log(filteredImages())
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
            filteredImages()?.length > 0 ? (
                <Slider
                    containerClassName="popular-games"
                    imageContainerClassName="games-container-pop"
                    slides={filteredImages()}
                    filePath={popularRepacksPath}
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

    return (
        <>
            <div className="title-category poprepacks">
                <h2>Popular Repacks</h2>
                <div className="filter-box">
                    <details
                        className="filter-details poprepacks"
                        onToggle={(e) => e.preventDefault()}
                    >
                        <summary
                            onClick={(e) => {
                                e.preventDefault()
                                const details = document.querySelector(
                                    '.filter-details.poprepacks'
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

export default Popularrepacks
