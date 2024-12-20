import { createEffect, onMount, createSignal } from "solid-js";
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { listen, emit } from '@tauri-apps/api/event';
import { A, useLocation } from "@solidjs/router";
import { globalTorrentsInfo, setGlobalTorrentsInfo } from "../functions/dataStoreGlobal";
import './Topbar.css'
import { invoke } from "@tauri-apps/api/core";
import Searchbar from "./Topbar-Components-01/Searchbar-01/Searchbar";
const appWindow = getCurrentWebviewWindow()

function Topbar() {
    const [isDialogOpen, setIsDialogOpen] = createSignal(false);
    const [notificationMessage, setNotificationMessage] = createSignal('');

    function handleWindowClose() {
        // Iterate through all torrents and pause them
        const { torrents } = globalTorrentsInfo;
        torrents.forEach(async (torrent) => {
            const { torrentIdx } = torrent;
            await invoke('torrent_action_pause', { id: torrentIdx })
                .then(() => {
                    console.log(`Paused torrent with idx: ${torrentIdx}`);
                })
                .catch((error) => {
                    console.error(`Failed to pause torrent with idx: ${torrentIdx}`, error);
                });
        });

        // Close the app window
        appWindow.close();
    }

    function closeDialog() {
        setIsDialogOpen(false);
    }
    const location = useLocation();
    const isActive = (path) => location.pathname === path;
    onMount(() => {
        console.log('App mounted. Setting up event listeners...');

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

            <img id='fitgirl-logo' src='/Square310x310Logo.png' alt='fitgirl repack logo' />

            <Searchbar />

            <A
                href="/"
                classList={{
                    "clickable-link": true,
                    active: isActive("/"),
                }}
            >
                <p id="link-gamehub" className="links-texts">GameHub</p>
            </A>

            <A
                href="/discovery-page"
                classList={{
                    "clickable-link": true,
                    active: isActive("/discovery-page"),
                }}
            >
                <p id="link-discovery" className="links-texts">Discovery</p>
            </A>

            <A
                href="/library"
                classList={{
                    "clickable-link": true,
                    active: isActive("/library"),
                }}
            >
                <p id="link-library" className="links-texts">Library</p>
            </A>

            <A
                href="/downloads-page"
                classList={{
                    "clickable-link": true,
                    active: isActive("/downloads-page"),
                }}
            >
                <p id="link-downloads" className="links-texts">Downloads</p>
            </A>

            <A
                href="/settings"
                classList={{
                    "clickable-link": true,
                    active: isActive("/settings"),
                }}
            >
                <p id="link-settings" className="links-texts">Settings</p>
            </A>


        </div>
    )

}

//<Route path="*404" component={NotFound} />

export default Topbar;