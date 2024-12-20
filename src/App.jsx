import { onMount, createSignal } from 'solid-js';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { listen, emit } from '@tauri-apps/api/event';
import { Router, useLocation } from '@solidjs/router';
import { lazy } from 'solid-js';

import Notification from './components/Notification-01/Notification';
import ChangelogPopup from './components/Changelog-01/ChangelogPopup';

import '@fontsource-variable/mulish';
import '@fontsource-variable/lexend'

import './App.css';
import Topbar from './components/Topbar-01/Topbar';
import { appDataDir, dirname, join } from '@tauri-apps/api/path';
import { exists, mkdir, readDir, writeFile } from '@tauri-apps/plugin-fs';
import { invoke } from '@tauri-apps/api/core';

const appDir = await appDataDir()
async function userCollectionPath() {
    return await join(appDir, 'library', 'collections');
}

function App() {

    const ensureDirectoryExists = async (path) => {
        try {
            // Check if the directory exists
            await readDir(path);
        } catch (error) {
            await mkdir(path, { recursive: true });
        }
    };

    const sidebarRoutes = [
        {
            path: '/',
            component: lazy(() => import('./pages/Gamehub-01/Gamehub')),
        },
        {
            path: '/game/:uuid',
            component: lazy(() => import('./pages/Download-Game-UUID-01/Download-Game-UUID')),
        },
        {
            path: '/discovery-page',
            component: lazy(() => import('./pages/Discovery-01/Discovery'))
        },
        {
            path: '/downloads-page',
            component: lazy(() => import('./pages/Downloads-01/Downloads-Page'))
        },
        {
            path: '/library',
            component: lazy(() => import('./pages/Library-01/Library')),
        },
        {
            path: '/settings',
            component: lazy(() => import('./pages/Settings-01/Settings')),
        },
    ];

    return (
        <>


            <Router root={(props) => {
                const location = useLocation();
                return (
                    <>
                        <div className='main-layout'>
                            <Topbar /> {/* This is the .topbar */}

                            {props.children} {/* This is the .content-page */}
                        </div>
                    </>
                );
            }}>
                {sidebarRoutes}
            </Router>
        </>
    );
}

export default App;
