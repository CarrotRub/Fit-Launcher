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

    onMount(async () => {
        const settingsPath = await join(appDir,'fitgirlConfig', 'settings.json');
        const collectionPath = await userCollectionPath();
        ensureDirectoryExists(collectionPath)
        try {
          const fileExists = await exists(settingsPath);
          if (!fileExists) {
            // If file doesn't exist, create it
            const defaultSettings = JSON.stringify({ key: '' });  // Adjust the default settings as needed
            await writeFile({ path: settingsPath, contents: defaultSettings });
            console.log('File created successfully');
          } else {
            console.log('File already exists');
          }
        } catch (error) {
          console.error('Error checking or creating the directory/file:', error);
        }
      });

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
            path: '/downloads-page',
            component: lazy(() => import('./pages/Downloads-01/Downloads-Page'))
        },
        {
            path: '/library',
            component: lazy(() => import('./pages/Library-01/Library')),
        },
        // {
        //     path: '/settings',
        //     component: lazy(() => import('./templates/Settings-01/Settings')),
        // },
    ];

    return (
        <div id='router-page'>


            <Router root={(props) => {
                const location = useLocation();
                return (
                    <>
                        <div className='main-layout'>
                            <Topbar />
                            <div className='content-page'>
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
