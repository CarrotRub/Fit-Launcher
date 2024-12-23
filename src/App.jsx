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
import { check } from '@tauri-apps/plugin-updater';
import { confirm, message } from '@tauri-apps/plugin-dialog';

const appDir = await appDataDir()
async function userCollectionPath() {
    return await join(appDir, 'library', 'collections');
}

function App() {

    //TODO: Add option to remove auto check update
    async function handleCheckUpdate() {
        let update = await check();
    
        if (update) {
            console.log(
              `found update ${update.version} from ${update.date} with notes ${update.body}`
            );
            const confirm_update = await confirm(`Update "${update.version} was found, do you want to download it ?" `, {title: 'FitLauncher', kind:'info'})
            if (confirm_update) {
                let downloaded = 0;
                let contentLength = 0;
                // alternatively we could also call update.download() and update.install() separately
                await update.downloadAndInstall((event) => {
                  switch (event.event) {
                    case 'Started':
                      contentLength = event.data.contentLength;
                      console.log(`started downloading ${event.data.contentLength} bytes`);
                      break;
                    case 'Progress':
                      downloaded += event.data.chunkLength;
                      console.log(`downloaded ${downloaded} from ${contentLength}`);
                      break;
                    case 'Finished':
                      console.log('download finished');
                      
                      break;
                  }
                });
                await message(`Update has been installed correctly ! close and re-open the app.`)
            }
        }
    }

    onMount(() => {
        //TODO: Check this
        handleCheckUpdate();
    })

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
