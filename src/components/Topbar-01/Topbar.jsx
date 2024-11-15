import { createEffect, onMount, createSignal } from "solid-js";
import { appWindow } from '@tauri-apps/api/window';
import { listen, emit } from '@tauri-apps/api/event';
import { A } from "@solidjs/router";

import './Topbar.css'

// TODO: ADD TITLE BAR HERE.

function Topbar() {
    const [isDialogOpen, setIsDialogOpen] = createSignal(false);
    const [notificationMessage, setNotificationMessage] = createSignal('');
    
    function handleWindowClose() {
        let cdgStats = localStorage.getItem('CDG_Stats');
        console.log('Current CDG_Stats from localStorage:', cdgStats);

        try {
            cdgStats = JSON.parse(cdgStats);
            if (cdgStats) {
                cdgStats.state = 'paused';
                localStorage.setItem('CDG_Stats', JSON.stringify(cdgStats));
                console.log('Updated CDG_Stats saved in localStorage:', cdgStats);
            }
        } catch (error) {
            console.error('Error parsing CDG_Stats:', error);
        }
        
        appWindow.close();
    }

    function closeDialog() {
        setIsDialogOpen(false);
    }

    onMount(() => {
        console.log('App mounted. Setting up event listeners...');
        
        // Emit that the frontend is ready
        //TODO: This will be used to trigger reloading the UI components when the frontend is ready
        emit('frontend-ready');

        // Get the image path from localStorage and set the background image accordingly
        // TODO: Add it later
          
        // Add event listeners for Tauri app window controls
        document
            .getElementById('titlebar-minimize')
            ?.addEventListener('click', () => appWindow.minimize());
        document
            .getElementById('titlebar-maximize')
            ?.addEventListener('click', () => appWindow.toggleMaximize());
        document
            .getElementById('titlebar-close')
            ?.addEventListener('click', () => handleWindowClose());

        // Listen for network failure event and handle it
        listen('network-failure', (event) => {
            setNotificationMessage(`Network failure: ${event.payload.message}`);
            setIsDialogOpen(true);
        });

        listen('scraping_failed_event', (event) => {
            setNotificationMessage(`Scraping failed: ${event.payload.message}`);
            setIsDialogOpen(true);
            console.log('Scraping failed:', event.payload.message);
        });
    });
    return (
        <div className='top-bar-container'>
            <div data-tauri-drag-region class="titlebar">
                <div class="titlebar-button" id="titlebar-minimize">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="1em"
                        height="1em"
                        viewBox="0 0 16 16"
                    >
                        <path
                            fill="currentColor"
                            d="M14 8v1H3V8z"
                        ></path>
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
                            d="m7.116 8-4.558 4.558.884.884L8 8.884l4.558 4.558.884-.884L8.884 8l4.558-4.558-.884-.884L8 7.116 3.442 2.558l-.884.884z"
                            clipRule="evenodd"
                        ></path>
                    </svg>
                </div>
            </div>

            <img id='fitgirl-logo' src='/Square310x310Logo.png'  alt='fitgirl repack logo' />
            
            <div className='search-bar'>
                <svg width="24" xmlns="http://www.w3.org/2000/svg" height="24" viewBox="-543 241.4 24 24" style="-webkit-print-color-adjust::exact" fill="none"><g data-testid="search"><g class="fills"><rect rx="0" ry="0" x="-543" y="241.4" width="24" height="24" class="frame-background"/></g><g class="frame-children"><g data-testid="svg-circle"><circle cx="-532" cy="252.4" style="fill:none" class="fills" r="8"/><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><circle cx="-532" cy="252.4" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:1" class="stroke-shape" r="8"/></g></g><g data-testid="svg-path"><path d="m-522 262.4-4.3-4.3" style="fill:none" class="fills"/><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="m-522 262.4-4.3-4.3" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:1" class="stroke-shape"/></g></g></g></g></svg>
                <input type='text' placeholder='Search Game'/>
            </div>
            
            <A href="/" class="clickable-link" link="" aria-current="page">
                <p id="link-gamehub" className="links-texts">GameHub</p>
            </A>

            <A href="/library" className="clickable-link" link="" aria-current="page">
                <p id="link-library" className="links-texts">Library</p>
            </A>
            
            <A href="/downloads" className="clickable-link" link="" aria-current="page">
                <p id="link-downloads" className="links-texts">Downloads</p>
            </A>

            <A href="/settings" className="clickable-link" link="" aria-current="page">
                <p id="link-settings" className="links-texts">Settings</p>
            </A>


        </div>
    )

}

//<Route path="*404" component={NotFound} />

export default Topbar;