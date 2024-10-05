import { onMount, createSignal } from 'solid-js'
import { appWindow } from '@tauri-apps/api/window'
import { listen } from '@tauri-apps/api/event'
import { Router } from '@solidjs/router'
import { lazy } from 'solid-js'
import { emit } from '@tauri-apps/api/event'

import Sidebar from './components/Sidebar-01/Sidebar'
import Searchbar from './components/Searchbar-01/Searchbar'
import Notification from './components/Notification-01/Notification'
import ChangelogPopup from './components/Changelog-01/ChangelogPopup'

import './App.css'
import './templates/titlebar-01/titlebar.css'

function App() {
    const [isDialogOpen, setIsDialogOpen] = createSignal(false)
    const [notificationMessage, setNotificationMessage] = createSignal('')

    onMount(() => {
        console.log('App mounted. Setting up event listeners...')
        // Emit an event to the backend indicating that the frontend is ready
        emit('frontend-ready')

        // Listen for the network failure event
        listen('network-failure', (event) => {
            setNotificationMessage(`Network failure: ${event.payload.message}`)
            setIsDialogOpen(true)
        })

        // Event listeners for window controls
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

                        localStorage.setItem(
                            'CDG_Stats',
                            JSON.stringify(cdgStats)
                        )

                        const updatedCdgStats =
                            localStorage.getItem('CDG_Stats')
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

    function closeDialog() {
        setIsDialogOpen(false)
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
    ]

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

                <Router
                    root={(props) => (
                        <>
                            <div>
                                <div className="sidebar">
                                    <Sidebar />
                                </div>
                                <div className="app-container">
                                    <ChangelogPopup />
                                    <div className="main-content">
                                        <div className="searchbar">
                                            <Searchbar />
                                        </div>
                                        <div
                                            className={`notification-wrapper ${
                                                !isDialogOpen() ? 'hidden' : ''
                                            }`}
                                        >
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
                            </div>
                        </>
                    )}
                >
                    {sidebarRoutes}
                </Router>
            </div>
        </>
    )
}

export default App
