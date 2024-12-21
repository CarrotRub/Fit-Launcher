
import { createEffect, createSignal, onMount } from 'solid-js';
import './Settings.css'
import TorrentingPage from './Settings-Categories/Torrenting/Torrenting';
import GlobalSettingsPage from './Settings-Categories/Global/GlobalSettingsPage';

function Settings() {
    const [activeCategory, setActiveCategory] = createSignal('dht');
    const [activeGroup, setActiveGroup] = createSignal('global')

    return (
        <div className="settings content-page">
            <SettingsSidebar setActiveCategory={setActiveCategory} setActiveGroup={setActiveGroup} />
            <div className="settings-content">
                {activeGroup() === 'torrent' ? (
                    <TorrentingPage settingsPart={activeCategory()} />
                ) : (
                    <GlobalSettingsPage settingsPart={activeCategory()} />
                )}
            </div>
        </div>
    )
}

function SettingsSidebar({ setActiveCategory, setActiveGroup }) {

    onMount(() => {
        // Activate the first DHT element by default
        handleActivateElem('settings-display', 'global-display');
    });

    // Helper function to reset all backgrounds to transparent
    function changeAllToDefault() {
        const allDivs = document.querySelectorAll('.settings-sidebar-group-list-category a');
        allDivs.forEach((elem) => {
            elem.style.backgroundColor = 'transparent';
        });
    }

    function handleActivateElem(elemID, category) {
        changeAllToDefault();
        const selectedElem = document.getElementById(elemID);
        if (selectedElem) {
            selectedElem.style.backgroundColor = 'var(--secondary-30-selected-color)';
        }

        if (category.startsWith('global')) {
            setActiveGroup('global')
            console.log('GLOBAL')
        } else {
            setActiveGroup('torrent')
        }
        // Update the active category state
        setActiveCategory(category);
    }

    return (
        <div className="settings-sidebar">
            <div className="settings-sidebar-group">
                <ul className="settings-sidebar-group-list-category">
                    <p className="settings-sidebar-group-title">
                        Global
                    </p>
                    <a id="settings-display" onClick={() => handleActivateElem("settings-display", "global-display")}>
                        <svg width="24" xmlns="http://www.w3.org/2000/svg" height="24" viewBox="-196 798.3 24 24" style="-webkit-print-color-adjust::exact" fill="none"><g class="fills"><rect rx="0" ry="0" x="-196" y="798.3" width="24" height="24" class="frame-background" /></g><g class="frame-children"><path d="M-176 805.3h-9" style="fill:none" class="fills" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M-176 805.3h-9" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:1" class="stroke-shape" /></g><path d="M-182 815.3h-9" style="fill:none" class="fills" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M-182 815.3h-9" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:1" class="stroke-shape" /></g><circle cx="-179" cy="815.3" style="fill:none" class="fills" r="3" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><circle cx="-179" cy="815.3" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:1" class="stroke-shape" r="3" /></g><circle cx="-189" cy="805.3" style="fill:none" class="fills" r="3" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><circle cx="-189" cy="805.3" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:1" class="stroke-shape" r="3" /></g></g></svg>
                        <span>Display Settings</span>
                    </a>
                    <a id="settings-dns" onClick={() => handleActivateElem("settings-dns", "global-dns")}>
                        <svg width="24" xmlns="http://www.w3.org/2000/svg" height="24" viewBox="-196 873.3 24 24" style="-webkit-print-color-adjust::exact" fill="none"><g class="fills"><rect rx="0" ry="0" x="-196" y="873.3" width="24" height="24" class="frame-background" /></g><g class="frame-children"><circle cx="-184" cy="885.3" style="fill:none" class="fills" r="10" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><circle cx="-184" cy="885.3" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:1" class="stroke-shape" r="10" /></g><path d="M-184 875.3c-5.333 5.6-5.333 14.4 0 20 5.333-5.6 5.333-14.4 0-20" style="fill:none" class="fills" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M-184 875.3c-5.333 5.6-5.333 14.4 0 20 5.333-5.6 5.333-14.4 0-20" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:1" class="stroke-shape" /></g><path d="M-194 885.3h20" style="fill:none" class="fills" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M-194 885.3h20" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:1" class="stroke-shape" /></g></g></svg>
                        <span>DNS Settings</span>
                    </a>
                    <a id="settings-install" onClick={() => handleActivateElem("settings-install", "global-install")}>
                        <svg width="24" xmlns="http://www.w3.org/2000/svg" height="24" viewBox="-196 948.3 24 24" style="-webkit-print-color-adjust::exact" fill="none"><g class="fills"><rect rx="0" ry="0" x="-196" y="948.3" width="24" height="24" class="frame-background" /></g><g class="frame-children"><path d="M-181.3 954.6a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a5.999 5.999 0 0 1-7.94 7.94l-6.91 6.91a2.122 2.122 0 0 1-3-3l6.91-6.91a5.999 5.999 0 0 1 7.94-7.94z" style="fill:none" class="fills" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M-181.3 954.6a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a5.999 5.999 0 0 1-7.94 7.94l-6.91 6.91a2.122 2.122 0 0 1-3-3l6.91-6.91a5.999 5.999 0 0 1 7.94-7.94z" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:1" class="stroke-shape" /></g></g></svg>
                        <span>Install Settings</span>
                    </a>
                    <a id="settings-cache" onClick={() => handleActivateElem("settings-cache", "global-cache")}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-database"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/></svg>
                        <span>Cache & Logs Settings</span>
                    </a>


                </ul>
                <ul className="settings-sidebar-group-list-category">
                    <p className="settings-sidebar-group-title">
                        Torrenting
                    </p>
                    <a id="settings-dht" onClick={() => handleActivateElem("settings-dht", "dht")}>
                        <svg width="24" xmlns="http://www.w3.org/2000/svg" height="24" viewBox="-196 432.3 24 24" style="-webkit-print-color-adjust::exact" fill="none"><g class="fills"><rect rx="0" ry="0" x="-196" y="432.3" width="24" height="24" class="frame-background" /></g><g class="frame-children"><rect rx="1" ry="1" x="-180" y="448.3" width="6" height="6" style="fill:none" class="fills" /><g stroke-linejoin="round" stroke-linecap="round" class="strokes"><rect rx="1" ry="1" x="-180" y="448.3" width="6" height="6" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:1" class="stroke-shape" /></g><rect rx="1" ry="1" x="-194" y="448.3" width="6" height="6" style="fill:none" class="fills" /><g stroke-linejoin="round" stroke-linecap="round" class="strokes"><rect rx="1" ry="1" x="-194" y="448.3" width="6" height="6" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:1" class="stroke-shape" /></g><rect rx="1" ry="1" x="-187" y="434.3" width="6" height="6" style="fill:none" class="fills" /><g stroke-linejoin="round" stroke-linecap="round" class="strokes"><rect rx="1" ry="1" x="-187" y="434.3" width="6" height="6" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:1" class="stroke-shape" /></g><path d="M-191 448.3v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3" style="fill:none" class="fills" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M-191 448.3v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:1" class="stroke-shape" /></g><path d="M-184 444.3v-4" style="fill:none" class="fills" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M-184 444.3v-4" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:1" class="stroke-shape" /></g></g></svg>
                        <span>DHT</span>
                    </a>
                    <a id="settings-tcp" onClick={() => handleActivateElem("settings-tcp", "tcp")}>
                        <svg width="24" xmlns="http://www.w3.org/2000/svg" height="24" viewBox="-196 507.3 24 24" style="-webkit-print-color-adjust::exact" fill="none"><g class="fills"><rect rx="0" ry="0" x="-196" y="507.3" width="24" height="24" class="frame-background" /></g><g class="frame-children"><circle cx="-184" cy="511.8" style="fill:none" class="fills" r="2.5" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><circle cx="-184" cy="511.8" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:1" class="stroke-shape" r="2.5" /></g><path d="m-185.8 513.6-3.9 3.9" style="fill:none" class="fills" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="m-185.8 513.6-3.9 3.9" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:1" class="stroke-shape" /></g><circle cx="-191.5" cy="519.3" style="fill:none" class="fills" r="2.5" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><circle cx="-191.5" cy="519.3" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:1" class="stroke-shape" r="2.5" /></g><path d="M-189 519.3h10" style="fill:none" class="fills" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M-189 519.3h10" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:1" class="stroke-shape" /></g><circle cx="-176.5" cy="519.3" style="fill:none" class="fills" r="2.5" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><circle cx="-176.5" cy="519.3" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:1" class="stroke-shape" r="2.5" /></g><path d="m-182.2 525 3.9-3.9" style="fill:none" class="fills" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="m-182.2 525 3.9-3.9" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:1" class="stroke-shape" /></g><circle cx="-184" cy="526.8" style="fill:none" class="fills" r="2.5" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><circle cx="-184" cy="526.8" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:1" class="stroke-shape" r="2.5" /></g></g></svg>
                        <span>TCP</span>
                    </a>
                    <a id="settings-persistence" onClick={() => handleActivateElem("settings-persistence", "persistence")}>
                        <svg width="24" xmlns="http://www.w3.org/2000/svg" height="24" viewBox="-196 582.3 24 24" style="-webkit-print-color-adjust::exact" fill="none"><g class="fills"><rect rx="0" ry="0" x="-196" y="582.3" width="24" height="24" class="frame-background" /></g><g class="frame-children"><circle cx="-184" cy="594.3" style="fill:none" class="fills" r="3" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><circle cx="-184" cy="594.3" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:1" class="stroke-shape" r="3" /></g><path d="M-191.5 592.3h-.5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-.5" style="fill:none" class="fills" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M-191.5 592.3h-.5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-.5" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:1" class="stroke-shape" /></g><path d="M-191.5 596.3h-.5a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2h-.5" style="fill:none" class="fills" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M-191.5 596.3h-.5a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2h-.5" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:1" class="stroke-shape" /></g><g stroke-linecap="round" stroke-linejoin="round" class="strokes" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes" /><path d="m-180.3 595.7-.9-.3" style="fill:none" class="fills" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="m-180.3 595.7-.9-.3" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:1" class="stroke-shape" /></g><path d="m-186.8 593.2-.9-.3" style="fill:none" class="fills" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="m-186.8 593.2-.9-.3" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:1" class="stroke-shape" /></g><path d="m-185.4 598 .3-.9" style="fill:none" class="fills" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="m-185.4 598 .3-.9" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:1" class="stroke-shape" /></g><path d="m-182.4 598-.4-1" style="fill:none" class="fills" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="m-182.4 598-.4-1" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:1" class="stroke-shape" /></g><path d="m-185.2 591.6-.4-1" style="fill:none" class="fills" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="m-185.2 591.6-.4-1" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:1" class="stroke-shape" /></g><path d="m-187.7 595.9 1-.4" style="fill:none" class="fills" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="m-187.7 595.9 1-.4" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:1" class="stroke-shape" /></g><path d="m-181.3 593.1 1-.4" style="fill:none" class="fills" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="m-181.3 593.1 1-.4" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:1" class="stroke-shape" /></g><path d="m-182.6 590.6-.3.9" style="fill:none" class="fills" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="m-182.6 590.6-.3.9" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:1" class="stroke-shape" /></g></g></svg>
                        <span>Persistence</span>
                    </a>
                    <a id="settings-peers-opts" onClick={() => handleActivateElem("settings-peers-opts", "peer-opts")}>
                        <svg width="24" xmlns="http://www.w3.org/2000/svg" height="24" viewBox="-196 657.3 24 24" style="-webkit-print-color-adjust::exact" fill="none"><g class="fills"><rect rx="0" ry="0" x="-196" y="657.3" width="24" height="24" class="frame-background" /></g><g class="frame-children"><path d="M-192 666.3a2 2 0 0 1-2-2v-2h6v2a2 2 0 0 1-2 2Z" style="fill:none" class="fills" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M-192 666.3a2 2 0 0 1-2-2v-2h6v2a2 2 0 0 1-2 2Z" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:1" class="stroke-shape" /></g><path d="M-193 662.3v-2" style="fill:none" class="fills" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M-193 662.3v-2" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:1" class="stroke-shape" /></g><path d="M-189 662.3v-2" style="fill:none" class="fills" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M-189 662.3v-2" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:1" class="stroke-shape" /></g><path d="M-177 672.3v-8.5a3.5 3.5 0 1 0-7 0v11a3.5 3.5 0 1 1-7 0v-8.5" style="fill:none" class="fills" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M-177 672.3v-8.5a3.5 3.5 0 1 0-7 0v11a3.5 3.5 0 1 1-7 0v-8.5" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:1" class="stroke-shape" /></g><path d="M-179 678.3v-2" style="fill:none" class="fills" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M-179 678.3v-2" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:1" class="stroke-shape" /></g><path d="M-175 678.3v-2" style="fill:none" class="fills" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M-175 678.3v-2" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:1" class="stroke-shape" /></g><path d="M-174 676.3h-6v-2a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2Z" style="fill:none" class="fills" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M-174 676.3h-6v-2a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2Z" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:1" class="stroke-shape" /></g></g></svg>
                        <span>Peers Options</span>
                    </a>
                </ul>

            </div>
        </div>
    )
}

export default Settings;