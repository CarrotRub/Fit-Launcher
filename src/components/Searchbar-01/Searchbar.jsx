import { createEffect, createSignal, onMount } from 'solid-js';
import { render } from 'solid-js/web';
import readFile from '../functions/readFileRust';
import { invoke } from '@tauri-apps/api';
import { appConfigDir } from '@tauri-apps/api/path';
import { convertFileSrc } from '@tauri-apps/api/tauri';
import './Searchbar.css'; 
import { translate } from '../../translation/translate'; 
import GameHorizontalSlide from '../Gamehorizontal-01/Gamehorizontal';

function Searchbar() {
    const [searchTerm, setSearchTerm] = createSignal('');
    const [searchResults, setSearchResults] = createSignal([]);
    const [searchedGameTitle, setSearchedGameTitle] = createSignal('');
    const [selectedGameLink, setSelectedGameLink] = createSignal(null); 
    const [showDragonBallSVG, setShowDragonBallSVG] = createSignal(false);  // Signal for SVG display

    function clearSearch() {
        setSearchResults([]);
    }

    createEffect(() => {
        console.log(searchTerm());
        if (!searchTerm()) {
            console.log("empty");
            let searchResultsDiv = document.getElementById('search-results');
            searchResultsDiv.style.display = 'none';
        } else {
            let searchResultsDiv = document.getElementById('search-results');
            searchResultsDiv.style.display = 'flex';
        }

        // Check if searchTerm includes "dragon ball"
        if (searchTerm().toLowerCase().includes("dragon ball")) {
            setShowDragonBallSVG(true);  // Show SVG
        } else {
            setShowDragonBallSVG(false);  // Hide SVG
        }
    });

    async function showResults(query) {
        let requests = [];
        const appDir =  await appConfigDir();
        const dirPath = appDir.replace(/\\/g, '/');
        
        for (let i = 1; i <= 6; i++) {
            let sitemapURL = `${dirPath}sitemaps/post-sitemap${i}.xml`;
            let convertedSitemapURL = convertFileSrc(sitemapURL);
            requests.push(fetch(convertedSitemapURL));
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
        console.log(value);
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
        
        const mainContentDiv = document.querySelector('.main-content');
        getConfigDir().then(async (configDir) => {
            const fileContentObj = await readFile(configDir);
            const fileContent = fileContentObj.content;
            const gameData = JSON.parse(fileContent);
            gameData.forEach(game => {
                render(() => (
                    <GameHorizontalSlide 
                    gameTitlePromise={game.title} 
                    filePathPromise={configDir} 
                    gameLinkPromise={game.href} />),
                    mainContentDiv);
            });
        });
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
        const singularGameFilePath = `${dirPath}tempGames/singular_game_temp.json`;

        return singularGameFilePath;
    }

    return (
        <div className='searchbar-container'>
            <div className='searchbar-main'>
                {/* Conditionally render SVG */}
                {showDragonBallSVG() && (
                    <svg id='dragon-ball-svg' height="64px" width="64px" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 512 512" xml:space="preserve" fill="#000000">
                        <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
                        <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g>
                        <g id="SVGRepo_iconCarrier"> 
                            <g> 
                                <g> 
                                    <path style="fill:#F5BF41;" d="M511.993,256c0,141.377-114.608,256-255.993,256C114.613,512,0,397.377,0,256 C0,114.609,114.613,0,256,0C397.384,0,511.993,114.609,511.993,256z"></path> 
                                    <g> 
                                        <g> 
                                            <path style="fill:#E9AE3B;" d="M451.823,319.517c-20.442,62.928-70.588,112.753-133.704,132.757 c-6.949,2.207-10.797,9.63-8.591,16.572c2.2,6.943,9.623,10.79,16.566,8.583c71.297-22.633,127.699-78.677,150.827-149.76 c2.257-6.928-1.541-14.373-8.469-16.63C461.523,308.791,454.079,312.588,451.823,319.517L451.823,319.517z"></path> 
                                        </g> 
                                    </g> 
                                    <g> 
                                        <path style="fill:#F9D791;" d="M256,0C114.613,0,0,114.609,0,256c0,82.805,39.349,156.38,100.329,203.174l358.844-358.844 C412.38,39.349,338.804,0,256,0z"></path> 
                                        <g> 
                                            <path style="fill:#FFFFFF;" d="M199.047,30.816C117.969,51.35,53.872,114.451,31.897,194.949 c-1.92,7.029,2.225,14.294,9.257,16.206c7.029,1.921,14.287-2.228,16.207-9.257C76.767,130.644,133.76,74.535,205.516,56.402 c7.072-1.792,11.349-8.971,9.558-16.028C213.291,33.302,206.111,29.024,199.047,30.816z"></path> 
                                        </g> 
                                    </g> 
                                </g> 
                                <polygon style="fill:#E94C1A;" points="256,177.688 278.34,233.517 338.331,237.514 292.139,276.012 306.885,334.297 256,302.271 205.115,334.297 219.854,276.012 173.661,237.514 233.66,233.517 "></polygon> 
                            </g> 
                        </g>
                    </svg>
                )}
                <input 
                    id='searchbar-input' 
                    type="text" 
                    placeholder= "Search here..."
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
