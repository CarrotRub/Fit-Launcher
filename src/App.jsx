import { onMount, createSignal } from 'solid-js';
import { appWindow } from '@tauri-apps/api/window';
import { listen, emit } from '@tauri-apps/api/event';
import { Router, useLocation } from '@solidjs/router';
import { lazy } from 'solid-js';

import Notification from './components/Notification-01/Notification';
import ChangelogPopup from './components/Changelog-01/ChangelogPopup';

import '@fontsource-variable/mulish';
import '@fontsource-variable/lexend'

import './App.css';
import Topbar from './components/Topbar-01/Topbar';

function App() {


    const sidebarRoutes = [
        {
            path: '/',
            component: lazy(() => import('./pages/Gamehub-01/Gamehub')),
        },
        {
            path: '/game/:uuid', 
            component: lazy(() => import('./pages/Download-Game-01/Download-Game')),
        },
        // {
        //     path: '/my-library',
        //     component: lazy(() => import('./templates/mylibrary-01/Mylibrary')),
        // },
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
                            <Topbar/>
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
