import { createEffect, onMount, createSignal, onCleanup } from 'solid-js'
import { invoke } from '@tauri-apps/api'
import { appWindow } from '@tauri-apps/api/window'
import { Route, Router, A } from '@solidjs/router'


import Sidebar from './components/Sidebar-01/Sidebar'
import Searchbar from './components/Searchbar-01/Searchbar'
import Gamehub from './templates/gamehub-01/Gamehub'
import Mylibrary from './templates/mylibrary-01/Mylibrary'

import './App.css'
import './templates/titlebar-01/titlebar.css'

function App() {
    onMount(() => {
        invoke('close_splashscreen')
    })

    createEffect(() => {
        document
            .getElementById('titlebar-minimize')
            .addEventListener('click', () => appWindow.minimize())
        document
            .getElementById('titlebar-maximize')
            .addEventListener('click', () => appWindow.toggleMaximize())
        document
            .getElementById('titlebar-close')
            .addEventListener('click', () => {


                let cdgStats = localStorage.getItem('CDG_Stats')
                console.log('Current CDG_Stats from localStorage:', cdgStats)
        
                try {
                    cdgStats = JSON.parse(cdgStats)
                    console.log('Parsed CDG_Stats:', cdgStats)
        
                    if (cdgStats) {
                        cdgStats.state = 'paused'
                        console.log('Updated CDG_Stats:', cdgStats)
        
                        localStorage.setItem('CDG_Stats', JSON.stringify(cdgStats))
        
                        const updatedCdgStats = localStorage.getItem('CDG_Stats')
                        console.log(
                            'Updated CDG_Stats saved in localStorage:',
                            updatedCdgStats
                        )
                    } else {
                        console.error(
                            "CDG_Stats is not in the expected format or missing 'state' property:",
                            cdgStats
                        )
                    }
                } catch (error) {
                    console.error('Error parsing CDG_Stats:', error)
                }
                appWindow.close()
            })
    })

    return (
        <>
        <div>
            <div>
                <div data-tauri-drag-region class="titlebar">
                    <div class="titlebar-button" id="titlebar-minimize">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="1em"
                            height="1em"
                            viewBox="0 0 16 16"
                        >
                            <path fill="currentColor" d="M14 8v1H3V8z"></path>
                        </svg>
                    </div>
                    <div class="titlebar-button" id="titlebar-maximize">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="1em"
                            height="1em"
                            viewBox="0 0 16 16"
                        >
                            <g fill="currentColor">
                                <path d="M3 5v9h9V5zm8 8H4V6h7z"></path>
                                <path
                                    fillRule="evenodd"
                                    d="M5 5h1V4h7v7h-1v1h2V3H5z"
                                    clipRule="evenodd"
                                ></path>
                            </g>
                        </svg>
                    </div>
                    <div class="titlebar-button" id="titlebar-close">
                        <svg
                            className="icon-id"
                            xmlns="http://www.w3.org/2000/svg"
                            width="1em"
                            height="1em"
                            viewBox="0 0 16 16"
                        >
                            <path
                                fill="currentColor"
                                fillRule="evenodd"
                                d="m7.116 8l-4.558 4.558l.884.884L8 8.884l4.558 4.558l.884-.884L8.884 8l4.558-4.558l-.884-.884L8 7.116L3.442 2.558l-.884.884z"
                                clipRule="evenodd"
                            ></path>
                        </svg>
                    </div>
                </div>
            </div>

            {/* Contains the sidebar. DO NOT REMOVE. */}
            <div className="sidebar">
                <Sidebar />
            </div>

            <div className="app-container">
                <div className="main-content">
                    <div className="searchbar">
                        <Searchbar />
                    </div>
                    <Router>
                        <Route path="/" component={Gamehub}/>
                        <Route path="/my-library" component={Mylibrary}/>
                    </Router>
                </div>
            </div>
            
        </div>
        </>
    )
}

export default App