import { createEffect, createSignal, onCleanup, onMount } from "solid-js";
import "./Download-PopUp.css";
import { message, open } from "@tauri-apps/plugin-dialog";
import { makePersisted } from "@solid-primitives/storage";
import { readDir } from "@tauri-apps/plugin-fs";
import { render } from "solid-js/web";
import { invoke } from "@tauri-apps/api/core";
import { appCacheDir, appDataDir } from "@tauri-apps/api/path";
import { addGlobalTorrentsInfo, globalTorrentsInfo } from "../../components/functions/dataStoreGlobal";
import { setInstallationConfigurations, installationConfigurations } from "../../components/functions/dataStoreGlobal";
import * as fs from "@tauri-apps/plugin-fs"
import { useNavigate } from "@solidjs/router";

const cacheDir = await appCacheDir();
const cacheDirPath = cacheDir;

const appDir = await appDataDir();
const dirPath = appDir;

const DownloadPopup = ({ closePopup, gameTitle, gameMagnet, externFullGameInfo }) => {
    const [downloadPath, setDownloadPath] = createSignal('')
    const [isPathValid, setIsPathValid] = createSignal(false);
    const [isFinalStep, setIsFinalStep] = createSignal(false);
    const [twoGBLimit, setTwoGBLimit] = createSignal(false)
    const [directXInstall, setDirectXInstall] = createSignal(false)
    const [microsoftCPPInstall, setMicrosoftCPPInstall] = createSignal(false)

    const handleCheckboxChange = (setter, configKey, value) => {
        setter(value);  // Update the signal
        setInstallationConfigurations(configKey, value);  // Save the configuration
    };

    onMount(() => {
        setTwoGBLimit(installationConfigurations.two_gb_limit);
        setDirectXInstall(installationConfigurations.directx_install)
        setMicrosoftCPPInstall(installationConfigurations.microsoftcpp_install)
    })

    onMount(async () => {
        let fullTorrentConfig = await invoke('get_torrent_full_config');

        setDownloadPath(fullTorrentConfig.default_download_location);
        console.warn(fullTorrentConfig.default_download_location)
    })

    onMount(() => {
        const downloadPageContent = document.querySelector(".download-game.content-page");
        if (downloadPageContent) {
            downloadPageContent.style.overflowY = 'clip'
        }
    })

    createEffect(() => {

        const labelElement = document.querySelector('.popup-input-label');

        labelElement.addEventListener("mousedown", async function (event) {

            const rect = labelElement.getBoundingClientRect();
            const clickPosition = event.clientX;
            const iconBoundary = rect.right - 30;

            if (clickPosition >= iconBoundary) {
                let chosenPath = await open({
                    directory: true,
                    multiple: false,
                });
                if (chosenPath) {
                    setDownloadPath(chosenPath);
                }
            }
        })
    })

    onMount(async () => {
        try {
            let fullTorrentConfig = await invoke('get_torrent_full_config');
            const savedPath = fullTorrentConfig.default_download_location;
            setDownloadPath(savedPath);

            if (savedPath) {
                try {
                    let dirExists = await fs.exists(savedPath)
                    console.log(dirExists)
                    setIsPathValid(dirExists);
                } catch (err) {
                    setIsPathValid(false);
                }
            } else {
                setIsPathValid(false);
            }
        } catch (err) {
            console.error("Error loading saved path:", err);
            setIsPathValid(false);
        }
    });

    createEffect(async () => {
        let pathToDownloadFolder = downloadPath();
        console.log("got changed to : ", pathToDownloadFolder)
        if (pathToDownloadFolder) {
            try {
                console.log("now works :", pathToDownloadFolder)
                const dirExists = await fs.exists(pathToDownloadFolder)
                console.log("does ", dirExists)
                setIsPathValid(dirExists);
            } catch (err) {
                console.error("Error trying to get exists", err)
                setIsPathValid(false);
            }
        } else {
            setIsPathValid(false);
        }
    });


    onCleanup(() => {
        const downloadPageContent = document.querySelector(".download-game.content-page");
        if (downloadPageContent) {
            downloadPageContent.style.overflowY = 'visible'
        }
    })

    async function placePathIntoConfig() {
        try {
            await invoke('config_change_only_path', { downloadPath: downloadPath() });
            console.log("placed into config file")
        } catch (error) {
            console.error("error placing into config file")
        }

    }
    return (
        <div className="popup-overlay">
            <div className="download-popup">
                {!isFinalStep() ?
                    <>
                        <div className="popup-content">
                            <div className="popup-text-title">
                                <p className="popup-main-title">Download Game</p>
                                <p className="popup-secondary-title">Do you really want to download {gameTitle} ?</p>
                            </div>
                            <div className="popup-choose-path">
                                <p className="popup-h2-title">Choose where you want to download the game :</p>
                                <div className="popup-path-input-container">
                                    <label className="popup-input-label">
                                        <input
                                            className="popup-path-input"
                                            placeholder="Path for your game"
                                            style={{ fontSize: '14px' }}
                                            value={downloadPath()}
                                            onInput={(e) => setDownloadPath(e.target.value)}
                                        />
                                    </label>
                                    <span className="path-icon">
                                        {isPathValid() ?
                                            <svg width="24" xmlns="http://www.w3.org/2000/svg" height="24" viewBox="-1179 552 24 24" style="-webkit-print-color-adjust::exact" fill="none"><g class="fills"><rect rx="0" ry="0" x="-1179" y="552" width="24" height="24" class="frame-background" /></g><g class="frame-children"><path d="M-1175.15 560.62a4 4 0 0 1 4.78-4.77 3.998 3.998 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 3.998 3.998 0 0 1 0 6.74 4.002 4.002 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4.002 4.002 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76" style="fill:none" class="fills" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M-1175.15 560.62a4 4 0 0 1 4.78-4.77 3.998 3.998 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 3.998 3.998 0 0 1 0 6.74 4.002 4.002 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4.002 4.002 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76" style="fill:none;fill-opacity:none;stroke-width:2;stroke:var(--accent-color);stroke-opacity:1" class="stroke-shape" /></g><path d="m-1170 564 2 2 4-4" style="fill:none" class="fills" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="m-1170 564 2 2 4-4" style="fill:none;fill-opacity:none;stroke-width:2;stroke:var(--accent-color);stroke-opacity:1" class="stroke-shape" /></g></g></svg>
                                            :
                                            <>
                                                <svg width="24" xmlns="http://www.w3.org/2000/svg" height="24" viewBox="-1113 552 24 24" style="-webkit-print-color-adjust::exact" fill="none"><g class="fills"><rect rx="0" ry="0" x="-1113" y="552" width="24" height="24" class="frame-background" /></g><g class="frame-children"><path d="M-1109.15 560.62a4 4 0 0 1 4.78-4.77 3.998 3.998 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 3.998 3.998 0 0 1 0 6.74 4.002 4.002 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4.002 4.002 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76" style="fill:none" class="fills" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M-1109.15 560.62a4 4 0 0 1 4.78-4.77 3.998 3.998 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 3.998 3.998 0 0 1 0 6.74 4.002 4.002 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4.002 4.002 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76" style="fill:none;fill-opacity:none;stroke-width:2;stroke:var(--primary-color);stroke-opacity:1" class="stroke-shape" /></g><path d="m-1098 561-6 6" style="fill:none" class="fills" /><g stroke-linejoin="round" stroke-linecap="round" class="strokes"><path d="m-1098 561-6 6" style="fill:none;fill-opacity:none;stroke-width:2;stroke:var(--primary-color);stroke-opacity:1" class="stroke-shape" /></g><path d="m-1104 561 6 6" style="fill:none" class="fills" /><g stroke-linejoin="round" stroke-linecap="round" class="strokes"><path d="m-1104 561 6 6" style="fill:none;fill-opacity:none;stroke-width:2;stroke:var(--primary-color);stroke-opacity:1" class="stroke-shape" /></g></g></svg>
                                                <p style={{ 'color': 'red', 'font-size': '12px', 'position': 'absolute', 'left': '3%', 'top': '105%' }}>Please enter a valid path !</p>
                                            </>
                                        }
                                    </span>
                                </div>
                            </div>
                            <div className="popup-choose-options">
                                <p className="popup-h2-title">Choose the installation options :</p>
                                <ul className="popup-list-options">
                                    <li className="popup-item-options">
                                        <label className="custom-checkbox">
                                            <input type="checkbox" checked={twoGBLimit()} onChange={(e) => handleCheckboxChange(setTwoGBLimit, 'two_gb_limit', e.target.checked)} />
                                            <span className="checkbox-mark"></span>
                                            Limit to 2GB of RAM
                                            <i>If you have 8GB or less, it <b>will</b> be checked at installation</i>
                                        </label>
                                    </li>
                                    <li className="popup-item-options">
                                        <label className="custom-checkbox">
                                            <input type="checkbox" checked={directXInstall()} onChange={(e) => handleCheckboxChange(setDirectXInstall, 'directx_install', e.target.checked)} />
                                            <span className="checkbox-mark"></span>
                                            Download and Install DirectX
                                        </label>
                                    </li>
                                    <li className="popup-item-options">
                                        <label className="custom-checkbox">
                                            <input type="checkbox" checked={microsoftCPPInstall()} onChange={(e) => handleCheckboxChange(setMicrosoftCPPInstall, 'microsoftcpp_install', e.target.checked)} />
                                            <span className="checkbox-mark"></span>
                                            Download and Install any VCRedist {'(Microsoft C++ 20XX)'}
                                        </label>
                                    </li>
                                </ul>
                            </div>
                        </div>
                        <div className="popup-buttons">
                            <button id="popup-cancel-button" onClick={closePopup}>Cancel</button>
                            <button id="popup-confirm-button"
                                onClick={async () => {
                                    setIsFinalStep(true);
                                    await placePathIntoConfig();
                                }}
                                disabled={!isPathValid()}
                            >
                                Next
                            </button>
                        </div>
                    </>
                    : (
                        <LastStep closePopup={closePopup} gameMagnet={gameMagnet} downloadGamePath={downloadPath()} externFullGameInfo={externFullGameInfo} />
                    )
                }

            </div>
        </div>

    );
};

const LastStep = ({ closePopup, gameMagnet, downloadGamePath, externFullGameInfo }) => {
    const [isLoading, setLoading] = createSignal(true);
    const [mainTorrentDetails, setMainTorrentDetails] = createSignal({});
    const [categorizedFilesList, setCategorizedFilesList] = createSignal({})
    const [uncategorizedFilesList, setUncategorizedFilesList] = createSignal([])
    const [rawFileList, setRawFileList] = createSignal([])
    const [rawIdFileList, setRawIdFileList] = createSignal([])
    const [completeFileList, setCompleteFileList] = createSignal([])
    const [completeIDFileList, setCompleteIDFileList] = createSignal([]);
    const [toBeDeletedFiles, setToBeDeletedFiles] = createSignal([]);
    const [checkboxesListComponents, setCheckboxesListComponents] = createSignal([])
    const [gameStartedDownload, setGameStartedDownload] = createSignal(false)
    const navigate = useNavigate();
    function toUpperFirstLetters(str) {
        return str
            .toLowerCase()
            .split(' ')
            .map(function (word) {
                return word[0].toUpperCase() + word.substr(1);
            })
            .join(' ');
    }

    const classifyFiles = (files) => {
        const languageMap = {
            chinese: "Chinese",
            french: "French",
            german: "German",
            japanese: "Japanese",
            russian: "Russian",
            spanish: "Spanish",
            arabic: "Arabic",
            italian: "Italian",
            portuguese: "Portuguese",
            dutch: "Dutch",
            korean: "Korean",
            hindi: "Hindi",
            turkish: "Turkish",
            swedish: "Swedish",
            greek: "Greek",
            polish: "Polish",
            hebrew: "Hebrew",
            norwegian: "Norwegian",
            danish: "Danish",
            finnish: "Finnish",
            swahili: "Swahili",
            bengali: "Bengali",
            vietnamese: "Vietnamese",
            tamil: "Tamil",
            malay: "Malay",
            thai: "Thai",
            czech: "Czech",
            filipino: "Filipino",
            ukrainian: "Ukrainian",
            hungarian: "Hungarian",
            romanian: "Romanian",
            indonesian: "Indonesian",
            slovak: "Slovak",
            serbian: "Serbian",
            bulgarian: "Bulgarian",
            catalan: "Catalan",
            croatian: "Croatian",
            nepali: "Nepali",
            estonian: "Estonian",
            latvian: "Latvian",
            lithuanian: "Lithuanian"
        };

        const categorizedFiles = { Languages: {}, Others: {} };
        const uncategorizedFiles = [];

        files.forEach(file => {
            const lowerFile = file.toLowerCase();

            // Check if file matches any language
            const matchedLanguage = Object.keys(languageMap).find(language =>
                lowerFile.includes(language)
            );

            if (matchedLanguage) {
                // Use the language name from languageMap and add "Language" suffix
                let formattedFile = `${languageMap[matchedLanguage]} Language`;
                if (lowerFile.includes("vo")) {
                    formattedFile += " VO";
                }
                categorizedFiles.Languages[file] = formattedFile; // Key is original name, value is the new name
            } else if (lowerFile.includes("optional") || lowerFile.includes("selective")) {
                // Create a human-readable label for optional files
                const fileLabel = file
                    .replace(/fg-optional-/i, "")
                    .replace(/-/g, " ")
                    .replace(/\..*$/, "");
                categorizedFiles.Others[file] = fileLabel;
            } else {
                uncategorizedFiles.push(file);
            }
        });

        setUncategorizedFilesList(uncategorizedFiles);
        console.log("pure raw", rawFileList());
        return categorizedFiles;
    };

    const handleUnselectedFiles = (updatedList) => {
        const catFileList = Object.keys(categorizedFilesList().Languages).concat(
            Object.keys(categorizedFilesList().Others)
        );

        // Find files in categorizedFilesList but not in completeFileList
        const missingFiles = catFileList.filter(
            file => !updatedList.includes(file)
        );

        setToBeDeletedFiles(missingFiles);
        return missingFiles;
    };

    //This function is there because of some issues in librqbit that create a placeholder for the files that aren't selected but doesn't download anything inside of it.
    async function deleteUselessFiles(fileList) {
        const torrentOutputFolder = mainTorrentDetails().output_folder; // Get the folder path
        const missingFileList = handleUnselectedFiles(fileList);
        // Block to allow a specified path.
        try {
            await invoke('allow_dir', { path: torrentOutputFolder })
        } catch (error) {
            await message('App Was not able to delete useless files, please, when the game is done downloading, delete the files that you haven\'t chosen, we apologize.', { title: 'Tauri', kind: 'error' });
        }
        for (const file of missingFileList) {
            const filePath = `${torrentOutputFolder}\\${file}`; // Construct the full path
            console.warn(missingFileList)
            try {
                const fileExists = await fs.exists(filePath);

                if (fileExists) {
                    await fs.remove(filePath);
                    console.log(`Deleted file: ${filePath}`);
                } else {
                    console.log(`File does not exist: ${filePath}`);
                }
            } catch (error) {
                console.error(`Error deleting file: ${filePath}`, error);
            }
        }
    }

    async function handleChangeFileList(originalFileName) {
        setCompleteFileList((prevList) => {
            if (originalFileName != null) {
                const isAlreadyIncluded = prevList.includes(originalFileName);
                let updatedList = isAlreadyIncluded
                    ? prevList.filter(file => file !== originalFileName)
                    : [...prevList, originalFileName];

                updateCompleteIDFileList(updatedList);
                console.log(updatedList)
                // Call to handle unselected files whenever the file list changes
                return updatedList;
            } else {
                updateCompleteIDFileList(completeFileList());
                return completeFileList();
            }

        });
    };

    const updateCompleteIDFileList = (updatedFileList) => {
        const idList = updatedFileList.map(file => {
            const fileIndex = rawFileList().indexOf(file);
            return rawIdFileList()[fileIndex];
        });

        const uncategorizedIDs = uncategorizedFilesList().map(file => {
            const fileIndex = rawFileList().indexOf(file);
            return rawIdFileList()[fileIndex];
        });

        // Merge both idList and uncategorizedIDs, remove duplicates using Set, and sort the result
        const completeList = [...new Set([...idList, ...uncategorizedIDs])];

        const sortedList = completeList.sort((a, b) => a - b);

        setCompleteIDFileList(sortedList);
    };



    onMount(async () => {
        setLoading(true);
        const torrentDetails = await invoke('torrent_create_from_url', {
            url: gameMagnet,
            opts: { list_only: true },
        });
        console.log(torrentDetails)
        // Extract the file names from the files array
        const torrentFilesNames = torrentDetails.details.files.map(file => file.name);

        // Create raw IDs based on file indices
        const rawID = torrentFilesNames.map((_, index) => index);

        // Use extracted data in the functions
        setMainTorrentDetails(torrentDetails);
        const categorizedFiles = classifyFiles(torrentFilesNames);
        console.log(torrentFilesNames);
        setCategorizedFilesList(categorizedFiles);
        setRawFileList(torrentFilesNames);
        setRawIdFileList(rawID);
        setCompleteFileList(torrentFilesNames)
        setLoading(false);
    });

    async function handleStartDownloadingTorrent() {

        setLoading(true);

        console.log(completeIDFileList())
        await invoke("torrent_create_from_url", {
            url: gameMagnet,
            opts: { only_files: completeIDFileList(), overwrite: true }
        });
        if (installationConfigurations) {
            const checkedOptions = [];

            if (installationConfigurations.directx_install) {
                // becuz due to how I made the auto install, it needs to be lowercase directx and/or lowercase microsoft as components needed to be sent. - CarrotRub
                checkedOptions.push("directx")
            } else {
                checkedOptions.push("")
            }

            if (installationConfigurations.microsoftcpp_install) {
                // Same here but no need to worry becuz even if the microsoft components sometimes doesn't exist in the setup installer source code it won't cause any issues. - CarrotRub
                checkedOptions.push("microsoft")
            } else {
                checkedOptions.push("")
            }

            setCheckboxesListComponents(checkedOptions);
        }
        deleteUselessFiles(completeFileList());
        console.log(mainTorrentDetails().details)
        addGlobalTorrentsInfo(externFullGameInfo, mainTorrentDetails().details.info_hash, mainTorrentDetails().output_folder, downloadGamePath, checkboxesListComponents(), installationConfigurations.two_gb_limit)
        setGameStartedDownload(true)
        setLoading(false)

        const popupMainTitle = document.querySelector(".popup-main-title");
        popupMainTitle.textContent = 'Download Started !'
        const popupSecondaryTitle = document.querySelector(".popup-secondary-title");
        popupSecondaryTitle.textContent = 'Your download started, go check the download page !'

        const popupAdditionalFiles = document.querySelector(".torrent-additional-files-details");
        popupAdditionalFiles.style.display = 'none'

        navigate(`/downloads-page`)
    }

    return (
        <>
            <div className="popup-content">
                <div className="popup-text-title">
                    <p className="popup-main-title">One Last Step !</p>
                    <p className="popup-secondary-title">
                        Yup this is really the last step before downloading {':)'}
                    </p>
                </div>
                {isLoading() ? (
                    <div className="loading-icon-popup">
                        <svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="var(--secondary-color)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-loader-circle"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                    </div>
                ) : (
                    <div className="torrent-additional-files-details">
                        <p className="popup-h2-title">Choose what additional files to download :</p>
                        <div className="popup-additional-files-container">

                            <li className="popup-category-list-item" id="popup-languages-title">
                                <svg width="24" xmlns="http://www.w3.org/2000/svg" height="24" viewBox="-1586 1719 24 24" style="-webkit-print-color-adjust::exact" fill="none"><g class="fills"><rect rx="0" ry="0" x="-1586" y="1719" width="24" height="24" class="frame-background" /></g><g class="frame-children"><path d="m-1583 1735 4 4 4-4" style="fill:none" class="fills" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="m-1583 1735 4 4 4-4" style="fill:none;fill-opacity:none;stroke-width:2;stroke:var(--primary-color);stroke-opacity:1" class="stroke-shape" /></g><path d="M-1579 1739v-16" style="fill:none" class="fills" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M-1579 1739v-16" style="fill:none;fill-opacity:none;stroke-width:2;stroke:var(--primary-color);stroke-opacity:1" class="stroke-shape" /></g><path d="M-1575 1723h4" style="fill:none" class="fills" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M-1575 1723h4" style="fill:none;fill-opacity:none;stroke-width:2;stroke:var(--primary-color);stroke-opacity:1" class="stroke-shape" /></g><path d="M-1575 1727h7" style="fill:none" class="fills" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M-1575 1727h7" style="fill:none;fill-opacity:none;stroke-width:2;stroke:var(--primary-color);stroke-opacity:1" class="stroke-shape" /></g><path d="M-1575 1731h10" style="fill:none" class="fills" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M-1575 1731h10" style="fill:none;fill-opacity:none;stroke-width:2;stroke:var(--primary-color);stroke-opacity:1" class="stroke-shape" /></g></g></svg>
                                Languages :
                            </li>
                            {Object.entries(categorizedFilesList()?.Languages || {}).length !== 0 ? (
                                Object.entries(categorizedFilesList().Languages).map(([originalName, friendlyName], index) => (
                                    <ul className="popup-category-list-options" key={originalName}>
                                        <li className="popup-category-list-item">
                                            <svg width="24" xmlns="http://www.w3.org/2000/svg" height="24" viewBox="-1538 1793 24 24" style="-webkit-print-color-adjust::exact" fill="none"><g class="fills"><rect rx="0" ry="0" x="-1538" y="1793" width="24" height="24" class="frame-background" /></g><g class="frame-children"><path d="m-1533 1801 6 6" style="fill:none" class="fills" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="m-1533 1801 6 6" style="fill:none;fill-opacity:none;stroke-width:2;stroke:var(--primary-color);stroke-opacity:1" class="stroke-shape" /></g><path d="m-1534 1807 6-6 2-3" style="fill:none" class="fills" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="m-1534 1807 6-6 2-3" style="fill:none;fill-opacity:none;stroke-width:2;stroke:var(--primary-color);stroke-opacity:1" class="stroke-shape" /></g><path d="M-1536 1798h12" style="fill:none" class="fills" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M-1536 1798h12" style="fill:none;fill-opacity:none;stroke-width:2;stroke:var(--primary-color);stroke-opacity:1" class="stroke-shape" /></g><path d="M-1531 1795h1" style="fill:none" class="fills" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M-1531 1795h1" style="fill:none;fill-opacity:none;stroke-width:2;stroke:var(--primary-color);stroke-opacity:1" class="stroke-shape" /></g><path d="m-1516 1815-5-10-5 10" style="fill:none" class="fills" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="m-1516 1815-5-10-5 10" style="fill:none;fill-opacity:none;stroke-width:2;stroke:var(--primary-color);stroke-opacity:1" class="stroke-shape" /></g><path d="M-1524 1811h6" style="fill:none" class="fills" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M-1524 1811h6" style="fill:none;fill-opacity:none;stroke-width:2;stroke:var(--primary-color);stroke-opacity:1" class="stroke-shape" /></g></g></svg>
                                            {friendlyName}
                                            <label className="switch">
                                                <input
                                                    type="checkbox"
                                                    checked={true}
                                                    onChange={() => handleChangeFileList(originalName)}
                                                />
                                                <span className="switch-slider round"></span>
                                            </label>
                                        </li>
                                    </ul>
                                ))
                            ) : (
                                <ul className="popup-category-list-options">
                                    <li className="popup-category-list-item" key={0}>
                                        <svg width="24" xmlns="http://www.w3.org/2000/svg" height="24" viewBox="-1538 1793 24 24" style="-webkit-print-color-adjust::exact" fill="none"><g class="fills"><rect rx="0" ry="0" x="-1538" y="1793" width="24" height="24" class="frame-background" /></g><g class="frame-children"><path d="m-1533 1801 6 6" style="fill:none" class="fills" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="m-1533 1801 6 6" style="fill:none;fill-opacity:none;stroke-width:2;stroke:var(--primary-color);stroke-opacity:1" class="stroke-shape" /></g><path d="m-1534 1807 6-6 2-3" style="fill:none" class="fills" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="m-1534 1807 6-6 2-3" style="fill:none;fill-opacity:none;stroke-width:2;stroke:var(--primary-color);stroke-opacity:1" class="stroke-shape" /></g><path d="M-1536 1798h12" style="fill:none" class="fills" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M-1536 1798h12" style="fill:none;fill-opacity:none;stroke-width:2;stroke:var(--primary-color);stroke-opacity:1" class="stroke-shape" /></g><path d="M-1531 1795h1" style="fill:none" class="fills" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M-1531 1795h1" style="fill:none;fill-opacity:none;stroke-width:2;stroke:var(--primary-color);stroke-opacity:1" class="stroke-shape" /></g><path d="m-1516 1815-5-10-5 10" style="fill:none" class="fills" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="m-1516 1815-5-10-5 10" style="fill:none;fill-opacity:none;stroke-width:2;stroke:var(--primary-color);stroke-opacity:1" class="stroke-shape" /></g><path d="M-1524 1811h6" style="fill:none" class="fills" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M-1524 1811h6" style="fill:none;fill-opacity:none;stroke-width:2;stroke:var(--primary-color);stroke-opacity:1" class="stroke-shape" /></g></g></svg>
                                        Nothing found here...
                                    </li>
                                </ul>
                            )

                            }
                            <li className="popup-category-list-item" id="popup-others-title">
                                <svg width="24" xmlns="http://www.w3.org/2000/svg" height="24" viewBox="-1586 1719 24 24" style="-webkit-print-color-adjust::exact" fill="none"><g class="fills"><rect rx="0" ry="0" x="-1586" y="1719" width="24" height="24" class="frame-background" /></g><g class="frame-children"><path d="m-1583 1735 4 4 4-4" style="fill:none" class="fills" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="m-1583 1735 4 4 4-4" style="fill:none;fill-opacity:none;stroke-width:2;stroke:var(--primary-color);stroke-opacity:1" class="stroke-shape" /></g><path d="M-1579 1739v-16" style="fill:none" class="fills" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M-1579 1739v-16" style="fill:none;fill-opacity:none;stroke-width:2;stroke:var(--primary-color);stroke-opacity:1" class="stroke-shape" /></g><path d="M-1575 1723h4" style="fill:none" class="fills" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M-1575 1723h4" style="fill:none;fill-opacity:none;stroke-width:2;stroke:var(--primary-color);stroke-opacity:1" class="stroke-shape" /></g><path d="M-1575 1727h7" style="fill:none" class="fills" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M-1575 1727h7" style="fill:none;fill-opacity:none;stroke-width:2;stroke:var(--primary-color);stroke-opacity:1" class="stroke-shape" /></g><path d="M-1575 1731h10" style="fill:none" class="fills" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M-1575 1731h10" style="fill:none;fill-opacity:none;stroke-width:2;stroke:var(--primary-color);stroke-opacity:1" class="stroke-shape" /></g></g></svg>
                                Others :
                            </li>
                            {Object.entries(categorizedFilesList()?.Others || {}).length !== 0 ? (
                                Object.entries(categorizedFilesList().Others).map(([originalName, friendlyName], index) => (
                                    <ul className="popup-category-list-options" key={originalName}>
                                        <li className="popup-category-list-item">
                                            <svg width="24" xmlns="http://www.w3.org/2000/svg" height="24" viewBox="-1536 2089 24 24" style="-webkit-print-color-adjust::exact" fill="none"><g class="fills"><rect rx="0" ry="0" x="-1536" y="2089" width="24" height="24" class="frame-background" /></g><g class="frame-children"><circle cx="-1524" cy="2101" style="fill:none" class="fills" r="1" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><circle cx="-1524" cy="2101" style="fill:none;fill-opacity:none;stroke-width:2;stroke:var(--primary-color);stroke-opacity:1" class="stroke-shape" r="1" /></g><path d="M-1515.8 2109.2c2.04-2.03.02-7.36-4.5-11.9-4.54-4.52-9.87-6.54-11.9-4.5-2.04 2.03-.02 7.36 4.5 11.9 4.54 4.52 9.87 6.54 11.9 4.5" style="fill:none" class="fills" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M-1515.8 2109.2c2.04-2.03.02-7.36-4.5-11.9-4.54-4.52-9.87-6.54-11.9-4.5-2.04 2.03-.02 7.36 4.5 11.9 4.54 4.52 9.87 6.54 11.9 4.5" style="fill:none;fill-opacity:none;stroke-width:2;stroke:var(--primary-color);stroke-opacity:1" class="stroke-shape" /></g><path d="M-1520.3 2104.7c4.52-4.54 6.54-9.87 4.5-11.9-2.03-2.04-7.36-.02-11.9 4.5-4.52 4.54-6.54 9.87-4.5 11.9 2.03 2.04 7.36.02 11.9-4.5" style="fill:none" class="fills" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M-1520.3 2104.7c4.52-4.54 6.54-9.87 4.5-11.9-2.03-2.04-7.36-.02-11.9 4.5-4.52 4.54-6.54 9.87-4.5 11.9 2.03 2.04 7.36.02 11.9-4.5" style="fill:none;fill-opacity:none;stroke-width:2;stroke:var(--primary-color);stroke-opacity:1" class="stroke-shape" /></g></g></svg>
                                            {toUpperFirstLetters(friendlyName)}
                                            <label className="switch">
                                                <input
                                                    type="checkbox"
                                                    checked={true}
                                                    onChange={() => handleChangeFileList(originalName)}
                                                />
                                                <span className="switch-slider round"></span>
                                            </label>
                                        </li>
                                    </ul>
                                ))
                            ) : (
                                <ul className="popup-category-list-options">
                                    <li className="popup-category-list-item" key={0}>
                                        <svg width="24" xmlns="http://www.w3.org/2000/svg" height="24" viewBox="-1536 2089 24 24" style="-webkit-print-color-adjust::exact" fill="none"><g class="fills"><rect rx="0" ry="0" x="-1536" y="2089" width="24" height="24" class="frame-background" /></g><g class="frame-children"><circle cx="-1524" cy="2101" style="fill:none" class="fills" r="1" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><circle cx="-1524" cy="2101" style="fill:none;fill-opacity:none;stroke-width:2;stroke:var(--primary-color);stroke-opacity:1" class="stroke-shape" r="1" /></g><path d="M-1515.8 2109.2c2.04-2.03.02-7.36-4.5-11.9-4.54-4.52-9.87-6.54-11.9-4.5-2.04 2.03-.02 7.36 4.5 11.9 4.54 4.52 9.87 6.54 11.9 4.5" style="fill:none" class="fills" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M-1515.8 2109.2c2.04-2.03.02-7.36-4.5-11.9-4.54-4.52-9.87-6.54-11.9-4.5-2.04 2.03-.02 7.36 4.5 11.9 4.54 4.52 9.87 6.54 11.9 4.5" style="fill:none;fill-opacity:none;stroke-width:2;stroke:var(--primary-color);stroke-opacity:1" class="stroke-shape" /></g><path d="M-1520.3 2104.7c4.52-4.54 6.54-9.87 4.5-11.9-2.03-2.04-7.36-.02-11.9 4.5-4.52 4.54-6.54 9.87-4.5 11.9 2.03 2.04 7.36.02 11.9-4.5" style="fill:none" class="fills" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M-1520.3 2104.7c4.52-4.54 6.54-9.87 4.5-11.9-2.03-2.04-7.36-.02-11.9 4.5-4.52 4.54-6.54 9.87-4.5 11.9 2.03 2.04 7.36.02 11.9-4.5" style="fill:none;fill-opacity:none;stroke-width:2;stroke:var(--primary-color);stroke-opacity:1" class="stroke-shape" /></g></g></svg>
                                        Nothing Found Here...
                                    </li>
                                </ul>
                            )

                            }

                        </div>
                    </div>
                )}
            </div>

            <div className="popup-buttons">
                <button id="popup-cancel-button" onClick={closePopup}>Cancel</button>
                <button
                    id="popup-confirm-button"
                    onClick={async () => {
                        if (!gameStartedDownload()) {
                            await handleChangeFileList(null)
                            handleStartDownloadingTorrent();
                        } else {
                            closePopup();
                        }
                    }}
                >
                    {!gameStartedDownload() ? 'Next' : 'Done'}
                </button>
            </div>
        </>
    );
};

export default DownloadPopup;
