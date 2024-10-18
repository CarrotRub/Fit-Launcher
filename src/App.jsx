import { onMount, createSignal } from 'solid-js';
import { appWindow } from '@tauri-apps/api/window';
import { listen, emit } from '@tauri-apps/api/event';
import { Router, useLocation } from '@solidjs/router';
import { lazy } from 'solid-js';

import Sidebar from './components/Sidebar-01/Sidebar';
import Searchbar from './components/Searchbar-01/Searchbar';
import Notification from './components/Notification-01/Notification';
import ChangelogPopup from './components/Changelog-01/ChangelogPopup';

// Supports weights 100-900
import '@fontsource-variable/overpass';

import './App.css';
import './templates/titlebar-01/titlebar.css';

function App() {
    const [isDialogOpen, setIsDialogOpen] = createSignal(false);
    const [notificationMessage, setNotificationMessage] = createSignal('');

    onMount(() => {
        console.log('App mounted. Setting up event listeners...');
        
        // Emit that the frontend is ready
        //TODO: This will be used to trigger reloading the UI components when the frontend is ready
        emit('frontend-ready');

        // Get the image path from localStorage and set the background image accordingly
        const backgroundImagePath = localStorage.getItem("LBIP_PATH_64");
       // console.log('Retrieved background_image_path from localStorage:', backgroundImagePath); // It's hella long output
        
        try {
            setBackgroundImage(backgroundImagePath);
            // console.log('Background image set to:', backgroundImagePath); //It's hella long output
        } catch (error) {
            console.error('Error setting background image:', error);
            setNotificationMessage('Error setting background image.');
            setIsDialogOpen(true);
        }
            
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

    function setBackgroundImage(imagePath) {
        //console.log('setBackgroundImage function called. Image path:', imagePath); // Uncomment if needed for debugging
        if (imagePath) {
            // Set background image on body directly
            document.body.style.backgroundImage = `url(${imagePath})`;
            document.body.style.backgroundSize = 'cover';
            document.body.style.backgroundPosition = 'center';
            document.body.style.backgroundRepeat = 'no-repeat';
            document.body.style.backgroundAttachment = 'fixed';
           // console.log('Background image set to:', imagePath); //It's hella long output
        } else {
            // Remove background if no image is set
            document.body.style.backgroundImage = '';
            console.log('No background image set.');
        }
    }

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

    const sidebarRoutes = [
        {
            path: '/',
            component: lazy(() => import('./templates/Gamehub-01/Gamehub')),
        },
        {
            path: '/my-library',
            component: lazy(() => import('./templates/mylibrary-01/Mylibrary')),
        },
        {
            path: '/settings',
            component: lazy(() => import('./templates/Settings-01/Settings')),
        },
    ];

    return (
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
        </div>

            <Router root={(props) => {
                const location = useLocation();
                return (
                    <>
                        <div className="sidebar">
                            <Sidebar />
                        </div>
                        <div className="app-container">
                            <ChangelogPopup />
                            <div className="main-content">
                                {location.pathname !== '/settings' && (
                                    <div className="searchbar">
                                        <Searchbar />
                                    </div>
                                )}
                                <div className={`notification-wrapper ${!isDialogOpen() ? 'hidden' : ''}`}>
                                    {isDialogOpen() && (
                                        <Notification
                                            message={notificationMessage()}
                                            type="error"
                                            onClose={closeDialog}
                                        />
                                    )}
                                </div>
                                {props.children}
                            </div>
                        </div>
                    </>
                );
            }}>
                {sidebarRoutes}
            </Router>
        </div>
    );
}

export default App;
