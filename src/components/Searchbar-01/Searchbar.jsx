import { createEffect, createSignal, onMount } from 'solid-js';
import { render } from 'solid-js/web';
import readFile from '../functions/readFileRust';
import { invoke } from '@tauri-apps/api';
import { appConfigDir } from '@tauri-apps/api/path';
import './Searchbar.css'; 
import { translate } from '../../translation/translate'; 
import GameHorizontalSlide from '../Gamehorizontal-01/Gamehorizontal';

function Searchbar() {
    const [searchTerm, setSearchTerm] = createSignal('');
    const [searchResults, setSearchResults] = createSignal([]);
    const [searchedGameTitle, setSearchedGameTitle] = createSignal('');
    const [selectedGameLink, setSelectedGameLink] = createSignal(null); 

    function clearSearch() {
        setSearchResults([]);
    }

    createEffect(() => {
        console.log(searchTerm())
        if(!searchTerm()) {
            console.log("empty")
            let searchResultsDiv = document.getElementById('search-results');
            searchResultsDiv.style.display = 'none';
        } else {
            let searchResultsDiv = document.getElementById('search-results');
            searchResultsDiv.style.display = 'flex';
        }
    });

    async function showResults(query) {
        let requests = [];
        for (let i = 1; i <= 5; i++) {
            let sitemapURL = `../src/temp/sitemaps/post-sitemap${i}.xml`; // Adjust the path as per your directory structure
            requests.push(fetch(sitemapURL));
        }

        try {
            let responses = await Promise.all(requests);
            let postURLs = [];

            for (let response of responses) {
                if (response.ok) {
                    let text = await response.text();
                    let parser = new DOMParser();
                    let xmlDoc = parser.parseFromString(text, 'text/xml');
                    let urls = xmlDoc.getElementsByTagName('url');

                    for (let url of urls) {
                        let loc = url.getElementsByTagName('loc')[0].textContent;
                        postURLs.push(loc);
                    }
                } else {
                    console.error('Failed to fetch sitemap:', response.statusText);
                }
            }

            let results = postURLs.filter(postURL => {
                let title = getTitleFromUrl(postURL).toUpperCase().replace(/-/g, ' ');
                return title.includes(query.toUpperCase().trim());
            });

            setSearchResults(results.slice(0, 5));
        } catch (error) {
            console.error('Failed to fetch sitemap data:', error);
        }
    }

    function capitalizeTitle(title) {
        return title.replace(/-/g, ' ').toUpperCase();
    }

    function getTitleFromUrl(url) {
        var parts = url.split("/");
        var title = parts[3];
        return title;
    }

    function handleInputChange(event) {
        const value = event.target.value.toLowerCase();
        setSearchTerm(value);
        if (value !== '') {
            showResults(value);
        } else {
            clearSearch();
        }
    }
    async function handleResultClick(result) {
        invoke('get_games_images', { gameLink : result });
        await invoke('get_singular_game_info', { gameLink: result });
        
        const mainContentDiv = document.querySelector('.main-content')
        getConfigDir().then(async (configDir) => {

            
        })
        await getConfigDir().then(async (configDir) => {
            const fileContentObj = await readFile(configDir);
            const fileContent = fileContentObj.content;
            const gameData = JSON.parse(fileContent);
            gameData.forEach(game => {
                render(
                    <GameHorizontalSlide gameTitlePromise={game.title} filePathPromise={configDir} />,
                    mainContentDiv
                )
            })

            const gameHorizontalDiv = document.querySelector(".horizontal-slide");
            

        })
        setSelectedGameLink(result); // Set the selected game link
    }

    onMount(() => {
        const urlParameter = getUrlParameter('url');
        if (urlParameter !== '') {
            showResults(urlParameter);
        }
    });

    function getUrlParameter(name) {
        name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
        let regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
        let results = regex.exec(window.location.search);
        return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
    }

    async function getConfigDir() {
        const appDir =  await appConfigDir();
        const dirPath = appDir.replace(/\\/g, '/');
        const singularGameFilePath = `${dirPath}singular_game_temp.json`;

        return singularGameFilePath
    }

    return (
        <div className='searchbar-container'>
            <div className='searchbar-main'>
                <input 
                    id='searchbar-input' 
                    type="text" 
                    placeholder={translate('search_placeholder', {})} 
                    onInput={handleInputChange} 
                    value={searchTerm()} // Ensure the input value is controlled
                />
            </div>
            <div id="search-results" className="search-results">
                {searchResults().length === 0 ? (
                    <p>No results found.</p>
                ) : (
                    <ul>
                        {searchResults().map((result, index) => (
                            <li key={index}>
                                <a 
                                    href="#" 
                                    onClick={ async () => await handleResultClick(result)} // Add onClick event handler
                                    class="item-results"
                                >
                                    {async () => {
                                        getConfigDir().then(async (configDir) => {
                                            const fileContentObj = await readFile(configDir);
                                            const fileContent = fileContentObj.content;
                                            const gameData = JSON.parse(fileContent);
                                            gameData.forEach(game => {
                                                console.log(game.title)
                                                setSearchedGameTitle(game.title)
                                            })
                                            
                                        })

                                    }}
                                    {capitalizeTitle(getTitleFromUrl(result))}
                                </a>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}

export default Searchbar;
