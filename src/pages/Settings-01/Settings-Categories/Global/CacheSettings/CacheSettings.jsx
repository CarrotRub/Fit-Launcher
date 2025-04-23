import { createSignal } from "solid-js"
import '../GlobalSettingsPage.css'
import { invoke } from "@tauri-apps/api/core";
import { confirm, message } from "@tauri-apps/plugin-dialog";
import { check } from "@tauri-apps/plugin-updater";
import { getVersion } from "@tauri-apps/api/app";

function CacheSettings() {
    const [updateClicked, setUpdateClicked] =  createSignal(false);

    async function handleClearCache() {
        const confirmation = await confirm('This will delete every cache files, this action cannot be reverted, are you sure ?', {title: 'FitLauncher', kind: 'warning'})
        if (confirmation) {
            try {
                await invoke('clear_all_cache');
                await message('Cache cleared successfully !', {title: 'FitLauncher', kind: 'info'})
            } catch(error) {
                await message(error, {title: 'FitLauncher', kind: 'error'})
            }
        }
    }

    async function handleGoToLogs() {
        try {
            await invoke('open_logs_directory');
        } catch(error) {
            await message(error, {title: 'FitLauncher', kind: 'error'});
        }
    }

    async function handleCheckUpdate() {
        console.log("start")

        if(!updateClicked()) {
            await message('Please wait before clicking again it can take some time.', {title: 'FitLauncher', kind:'info'})
            setUpdateClicked(true)
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
                    setUpdateClicked(false)
                    await message(`Update has been installed correctly ! close and re-open the app.`)
                }
            } else {
                console.log("none")
                let current_ver = await getVersion();
                await message(`No update found, you are on the latest version ${current_ver}.`)
                setUpdateClicked(false);
            }
        } else if (updateClicked()) {
            await message("Can you please wait, that's quite not nice :(", {kind: 'warning'})
        }
    }

    return (

        <div className="global-page-group" id="global-display">
            <p className="global-page-group-title">Cache & Logs Settings</p>
            <ul className="global-page-group-list">
                <li>
                    <span>Clear All Cache Files <small><i>(This will remove images cache and all torrents cache, dht and session data. )</i></small>:</span>
                    <button className="clear-cache-settings-button" onClick={async () => { await handleClearCache() }}>
                        <span>Clear</span>
                    </button>
                </li>
                <li>
                    <span>Go To Logs <small><i>(Please do not share this with anyone except the official FitLauncher's Moderation !)</i></small>:</span>
                    <button className="go-to-logs-settings-button" onClick={async () => { await handleGoToLogs() }}>
                        <span>Go !</span>
                    </button>
                </li>
                <li>
                    <span>Check for Updates :</span>
                    <button className="go-to-logs-settings-button" onClick={async () => { await handleCheckUpdate() }}>
                        <span>Check !</span>
                    </button>
                </li>
            </ul>
        </div>

    );
}

export default CacheSettings;