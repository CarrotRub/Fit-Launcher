import { useNavigate } from "@solidjs/router";
import { invoke } from "@tauri-apps/api/core";
import { message } from "@tauri-apps/plugin-dialog";
import { AlertTriangle, Box, Check, ChevronDown, ChevronRight, Download, Info, Languages, Loader2, MemoryStick } from "lucide-solid";
import { Accessor, createEffect, createSignal, For, onMount, Show } from "solid-js";
import { render } from "solid-js/web";
import { DirectLink, DownloadedGame, FileInfo, InstallationSettings } from "../../bindings";
import { Modal } from "../Modal/Modal";
import { DownloadPopupProps } from "../../types/popup";
import { DownloadSettingsApi, GlobalSettingsApi } from "../../api/settings/api";
import TitleLabel from "../../pages/Settings-01/Settings-Categories/Components/UI/TitleLabel/TitleLabel";
import { TorrentApi } from "../../api/bittorrent/api";
import Checkbox from "../../components/UI/Checkbox/Checkbox";
import { formatBytes, toTitleCase, toTitleCaseExceptions } from "../../helpers/format";
import LoadingPage from "../../pages/LoadingPage-01/LoadingPage";
import { DownloadManagerApi } from "../../api/download/api";
import { DirectLinkWrapper } from "../../types/download";

const downloadSettingsInst = new DownloadSettingsApi();
const settingsInst = new GlobalSettingsApi();
const torrentInst = new TorrentApi();

export default function createLastStepDownloadPopup(props: DownloadPopupProps) {
    const languageMap: Record<string, string> = {
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
        lithuanian: "Lithuanian",
    };
    const container = document.createElement("div");
    document.body.appendChild(container);
    const destroy = () => {
        render(() => null, container);
        container.remove();
    };

    const LastStepPopup = () => {
        const [loading, setLoading] = createSignal(true);
        const [error, setError] = createSignal<string | null>(null);
        const [showAdvanced, setShowAdvanced] = createSignal(false);

        // Torrent state
        const [listFiles, setListFiles] = createSignal<FileInfo[]>([]);
        const [selectedFileIndices, setSelectedFileIndices] = createSignal(new Set<number>());
        const [categorizedFiles, setCategorizedFiles] = createSignal<{
            Languages: Record<string, string>;
            Others: Record<string, string>;
        }>({ Languages: {}, Others: {} });
        const [uncategorizedFiles, setUncategorizedFiles] = createSignal<string[]>([]);

        // DDL state
        const [selectedHoster, setSelectedHoster] = createSignal<"fuckingfast" | "datanodes" | null>(null);
        const [directLinks, setDirectLinks] = createSignal<DirectLinkWrapper[]>([]);
        const [ddlSelectedIndices, setDdlSelectedIndices] = createSignal(new Set<number>());
        const [ddlSelectedUrls, setDdlSelectedUrls] = createSignal(new Set<string>());

        onMount(async () => {
            try {
                if (props.downloadType === "bittorrent") {
                    await initializeTorrent();
                } else if (props.downloadType === "direct_download") {
                    await initializeDDL();
                }
            } catch (error) {
                console.error("Error initializing download:", error);
                setError("Failed to initialize download");
            } finally {
                setLoading(false);
            }
        });

        async function initializeTorrent() {
            const downloadSettings = await downloadSettingsInst.getDownloadSettings();
            if (downloadSettings.status === "ok") {
                console.log("settings: ", downloadSettings.data);
            }

            const resultFiles = await torrentInst.getTorrentFileList(props.downloadedGame.magnetlink);

            if (resultFiles.status === "ok") {
                setListFiles(resultFiles.data);
                const categorized = classifyFiles(resultFiles.data);
                setCategorizedFiles(categorized);

                const allIndices = new Set(resultFiles.data.map((_, index) => index));
                setSelectedFileIndices(allIndices);
            } else {
                console.error("Error: ", resultFiles.error);
                await message("Failed to get list of files, fix is coming soon!",
                    { title: "File List Error", kind: "warning" }
                );
                setError("Failed to get torrent file list");
            }
        }

        async function initializeDDL() {
            const allLinks = await DownloadManagerApi.getDatahosterLinks(
                props.downloadedGame.href,
                ""
            );

            if (!allLinks || allLinks.length === 0) {
                setError("No download links found for this game");
                return;
            }

            const supportedHosters = ["fuckingfast", "datanodes"];
            const hasSupportedHoster = supportedHosters.some(hoster =>
                allLinks.some(link => link.toLowerCase().includes(hoster))
            );

            if (!hasSupportedHoster) {
                setError("No supported download hosters available");
            }
        }

        function toggleFileSelection(index: number) {
            setSelectedFileIndices(prev => {
                const next = new Set(prev);
                if (next.has(index)) {
                    next.delete(index);
                } else {
                    next.add(index);
                }
                return next;
            });
        }

        function toggleDdlSelection(url: string) {
            setDdlSelectedUrls(prev => {
                const next = new Set(prev);
                if (next.has(url)) {
                    next.delete(url);
                } else {
                    next.add(url);
                }
                return next;
            });
        }

        async function handleStartDownload() {
            const currentSettings = await downloadSettingsInst.getDownloadSettings();
            if (currentSettings.status !== "ok") {
                await message('Error downloading! ' + currentSettings.error, {
                    title: 'FitLauncher',
                    kind: 'error'
                });
                return;
            }

            const path = currentSettings.data.general.download_dir;

            if (props.downloadType === "bittorrent") {

                torrentInst.downloadTorrent(
                    props.downloadedGame.magnetlink,
                    props.downloadedGame,
                    Array.from(selectedFileIndices()),
                    path
                );
            } else if (props.downloadType === "direct_download") {
                const selectedLinks = directLinks().filter(link =>
                    ddlSelectedUrls().has(link.url)
                );

                const result = await DownloadManagerApi.startDownload(
                    selectedLinks,
                    props.downloadedGame,
                    path
                );

                if (result.status === "ok") {
                    console.log("DDL download started with job ID:", result.data);
                } else {
                    await message(`Failed to start download: ${result.error}`, {
                        title: 'Download Error',
                        kind: 'error'
                    });
                }
            }

            props.onFinish?.();
        }

        function classifyFiles(files: FileInfo[]) {
            const categorizedFiles = {
                Languages: {} as Record<string, string>,
                Others: {} as Record<string, string>
            };
            const uncategorizedFiles: string[] = [];

            files.forEach((file) => {
                const lowerFile = file.file_name.toLowerCase();

                // Check if file matches any language
                const matchedLanguage = Object.keys(languageMap).find((language) =>
                    lowerFile.includes(language)
                );

                if (matchedLanguage) {
                    let formattedFile = `${languageMap[matchedLanguage]} Language`;
                    if (lowerFile.includes("vo")) {
                        formattedFile += " VO";
                    }
                    categorizedFiles.Languages[file.file_name] = formattedFile;
                } else if (lowerFile.includes("optional") || lowerFile.includes("selective")) {
                    const fileLabel = file.file_name
                        .replace(/fg-optional-/i, "")
                        .replace(/-/g, " ")
                        .replace(/\..*$/, "");
                    categorizedFiles.Others[file.file_name] = fileLabel;
                } else {
                    uncategorizedFiles.push(file.file_name);
                }
            });

            setUncategorizedFiles(uncategorizedFiles);
            return categorizedFiles;
        }

        function classifyDdlFiles(files: DirectLinkWrapper[]) {
            const result = {
                Languages: [] as DirectLinkWrapper[],
                Others: [] as DirectLinkWrapper[],
                Main: [] as DirectLinkWrapper[],
                Parts: [] as DirectLinkWrapper[],
            };

            files.forEach((file) => {
                const lowerFilename = file.filename.toLowerCase();

                const matchedLanguage = Object.keys(languageMap).find((language) =>
                    lowerFilename.includes(language)
                );

                if (matchedLanguage) {
                    const languageName = languageMap[matchedLanguage];
                    result.Languages.push({
                        ...file,
                        displayName: `${languageName} Language`
                    });
                }

                else if (lowerFilename.includes("optional")) {
                    const languageMatch = lowerFilename.match(/optional-(\w+)/);
                    if (languageMatch) {
                        const langCode = languageMatch[1];
                        const languageName = languageMap[langCode] || toTitleCase(langCode);
                        result.Languages.push({
                            ...file,
                            displayName: `${languageName} Language`
                        });
                    } else {
                        result.Others.push({
                            ...file,
                            displayName: "Optional Content"
                        });
                    }
                }

                else if (lowerFilename.includes("part")) {
                    const partMatch = file.filename.match(/part(\d+)/i);
                    if (partMatch) {
                        result.Parts.push({
                            ...file,
                            displayName: `Part ${partMatch[1]}`
                        });
                    } else {
                        result.Parts.push({
                            ...file,
                            displayName: "Game Part"
                        });
                    }
                }

                else if (lowerFilename.includes("setup") ||
                    lowerFilename.includes("install")) {
                    result.Main.push({
                        ...file,
                        displayName: "Game Installer"
                    });
                }
                // Everything else
                else {
                    result.Main.push({
                        ...file,
                        displayName: file.filename.replace(/\.[^/.]+$/, "") // Remove extension
                    });
                }
            });

            return result;
        }

        async function loadHosterLinks(hoster: "fuckingfast" | "datanodes") {
            setLoading(true);
            setSelectedHoster(hoster);
            setError(null);

            try {
                const links = await DownloadManagerApi.getDatahosterLinks(
                    props.downloadedGame.href,
                    hoster
                );

                if (!links || links.length === 0) {
                    setError(`No ${toTitleCaseExceptions(hoster)} links found`);
                    return;
                }

                if (hoster === "fuckingfast") {
                    const extractedLinks = await DownloadManagerApi.extractFuckingfastDDL(links);
                    if (!extractedLinks || extractedLinks.length === 0) {
                        setError("Failed to extract direct download links");
                        return;
                    }
                    console.log(extractedLinks)
                    setDirectLinks(extractedLinks);

                    const allIndices = new Set(extractedLinks.map((_, index) => index));
                    setDdlSelectedIndices(allIndices);
                    const allUrls = new Set(extractedLinks.map(link => link.url));
                    setDdlSelectedUrls(allUrls);
                } else {
                    // For DataNodes, create DirectLink objects from URLs
                    const dataNodeLinks = links.map(url => ({
                        url,
                        filename: url.split("/").pop() || "file.bin"
                    }));
                    setDirectLinks(dataNodeLinks);

                    // Select all files by default
                    const allIndices = new Set(dataNodeLinks.map((_, index) => index));
                    setDdlSelectedIndices(allIndices);
                    const allUrls = new Set(dataNodeLinks.map(link => link.url));
                    setDdlSelectedUrls(allUrls);
                }
            } catch (err) {
                setError(`Failed to load ${toTitleCaseExceptions(hoster)} links`);
                console.error("Hoster load error:", err);
            } finally {
                setLoading(false);
            }
        }

        const findFileIndex = (fileName: string) => {
            return listFiles().findIndex(f => f.file_name === fileName);
        };

        const TorrentFileItem = (props: {
            originalName: string;
            displayName: string;
            index: number;
        }) => {
            const file = listFiles().find(f => f.file_name === props.originalName);
            const size = file ? formatBytes(file.length) : "-";

            return (
                <label class="flex items-center justify-between gap-3 cursor-pointer w-full py-3 px-4 transition-all hover:bg-secondary-20/30 active:bg-secondary-20/50">
                    <span class="text-sm text-text truncate max-w-[55%]">{props.displayName}</span>
                    <div class="flex items-center gap-3">
                        <div class="min-w-[70px] h-full text-xs text-muted bg-background-20 border border-secondary-20 rounded px-2 py-1 flex items-center justify-center">
                            {size}
                        </div>
                        <Checkbox
                            checked={selectedFileIndices().has(props.index)}
                            action={() => toggleFileSelection(props.index)}
                        />
                    </div>
                </label>
            );
        };

        const DDLFileItem = (props: {
            file: DirectLink & { displayName?: string };
        }) => {
            return (
                <label class="flex items-center justify-between gap-3 cursor-pointer w-full py-3 px-4 transition-all hover:bg-secondary-20/30 active:bg-secondary-20/50">
                    <span class="text-sm text-text truncate max-w-[55%]">
                        {props.file.displayName || props.file.filename}
                    </span>
                    <div class="flex items-center gap-3">
                        <Checkbox
                            checked={ddlSelectedUrls().has(props.file.url)}
                            action={() => toggleDdlSelection(props.file.url)}
                        />
                    </div>
                </label>
            );
        };


        const renderTorrentUI = () => (
            <>
                <div class="text-center">
                    <div class="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Box class="w-8 h-8 text-accent" />
                    </div>
                    <h2 class="text-xl font-bold text-text mb-2">Choose What to Download</h2>
                    <p class="text-muted">
                        Select the files you want from the torrent. You can proceed without selecting to download everything.
                    </p>
                </div>

                <div class="bg-background-30 rounded-xl border border-secondary-20 shadow-sm max-h-[300px] overflow-auto no-scrollbar">
                    <div class="sticky top-0 z-20 backdrop-blur-md bg-background-30/80 py-3 px-4 border-b border-secondary-20/50">
                        <h3 class="text-sm font-semibold text-text flex items-center gap-2">
                            <MemoryStick class="w-4 h-4 text-accent" />
                            Files in Torrent
                        </h3>
                    </div>
                    <div class="px-2">
                        <Show when={!loading()} fallback={<LoadingPage />}>
                            <Show when={listFiles().length !== 0} fallback={
                                <div class="text-sm text-muted p-4 border border-dashed border-secondary-20 rounded-md bg-background-20 my-2 mx-2">
                                    No files were detected in this torrent. This may happen if the game uses an old format without Pastebin support.
                                    A future update will fix this for older titles.
                                </div>
                            }>
                                <div class="divide-y divide-secondary-20 -mx-2">
                                    {/* Show categorized files (Languages and Optional) */}
                                    <For each={Object.entries(categorizedFiles().Languages)}>
                                        {([originalName, displayName], _index) => (
                                            <TorrentFileItem
                                                originalName={originalName}
                                                displayName={toTitleCaseExceptions(displayName)}
                                                index={findFileIndex(originalName)}
                                            />
                                        )}
                                    </For>

                                    <For each={Object.entries(categorizedFiles().Others)}>
                                        {([originalName, displayName], _index) => (
                                            <TorrentFileItem
                                                originalName={originalName}
                                                displayName={toTitleCaseExceptions(displayName)}
                                                index={findFileIndex(originalName)}
                                            />
                                        )}
                                    </For>

                                    {/* Advanced options toggle */}
                                    <div class="px-4 py-2">
                                        <button
                                            onClick={() => setShowAdvanced(!showAdvanced())}
                                            class="text-xs text-accent hover:underline flex items-center gap-1"
                                        >
                                            <Show when={showAdvanced()} fallback={
                                                <>
                                                    <ChevronRight class="w-3 h-3" />
                                                    Show advanced options
                                                </>
                                            }>
                                                <>
                                                    <ChevronDown class="w-3 h-3" />
                                                    Hide advanced options
                                                </>
                                            </Show>
                                        </button>
                                    </div>

                                    {/* Advanced files (hidden by default) */}
                                    <Show when={showAdvanced()}>
                                        <div class="px-4 py-2 bg-background-20/50 text-xs text-text/80">
                                            <AlertTriangle class="w-4 h-4 inline mr-1 text-yellow-500" />
                                            Warning: Only modify these if you know what you're doing
                                        </div>
                                        <For each={uncategorizedFiles()}>
                                            {(fileName, index) => (
                                                <TorrentFileItem
                                                    originalName={fileName}
                                                    displayName={fileName}
                                                    index={findFileIndex(fileName)}
                                                />
                                            )}
                                        </For>
                                    </Show>
                                </div>
                            </Show>
                        </Show>
                    </div>
                </div>
            </>
        );

        const renderDDLUI = () => {
            const categorized = classifyDdlFiles(directLinks());
            return (
                <>
                    <div class="text-center">
                        <div class="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Download class="w-8 h-8 text-accent" />
                        </div>
                        <h2 class="text-xl font-bold text-text mb-2">Direct Download</h2>
                        <p class="text-muted">
                            Choose your download source and select files to download
                        </p>
                    </div>

                    {/* Hoster Selection */}
                    {!selectedHoster() && (
                        <div class="bg-background-30 rounded-xl border border-secondary-20 shadow-sm backdrop-blur-sm bg-opacity-80">
                            <div class="p-6">
                                <h3 class="text-lg font-semibold text-text mb-6 text-center">
                                    Select Download Provider
                                    <div class="text-xs font-normal text-muted mt-1">
                                        Choose your preferred download source
                                    </div>
                                </h3>

                                <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    {/* FuckingFast Button */}
                                    <button
                                        onClick={() => loadHosterLinks("fuckingfast")}
                                        class="group relative flex flex-col items-center justify-center p-5 rounded-xl bg-background border border-secondary-20 transition-all duration-200"
                                    >
                                        <div class="relative w-20 h-20 rounded-xl flex items-center justify-center mb-4 overflow-hidden bg-gradient-to-br from-background to-secondary-20/50 border border-secondary-20 transition-colors group-hover:border-accent/50">
                                            <img
                                                src="https://fuckingfast.co/static/favicon.ico"
                                                alt="FuckingFast"
                                                class="size-12 object-contain rounded-md"
                                            />
                                        </div>
                                        <span class="font-medium text-text transition-colors group-hover:text-primary">
                                            FuckingFast
                                        </span>
                                        <span class="text-xs text-muted mt-1 transition-colors group-hover:text-accent/80">
                                            Ultra-fast downloads
                                        </span>
                                        <div class="absolute inset-0 rounded-xl bg-accent/0 transition-colors duration-300 group-hover:bg-accent/5" />
                                    </button>

                                    {/* DataNodes Button */}
                                    <button
                                        onClick={() => loadHosterLinks("datanodes")}
                                        class="group relative flex flex-col items-center justify-center p-5 rounded-xl bg-background border border-secondary-20 transition-all duration-200"
                                    >
                                        <div class="relative w-20 h-20 rounded-xl flex items-center justify-center mb-4 overflow-hidden bg-gradient-to-br from-background to-secondary-20/50 border border-secondary-20 transition-colors group-hover:border-accent/50">
                                            <img
                                                src="https://datanodes.to/favicon.ico"
                                                alt="DataNodes"
                                                class="size-12 object-contain"
                                            />
                                        </div>
                                        <span class="font-medium text-text transition-colors group-hover:text-primary">
                                            DataNodes
                                        </span>
                                        <span class="text-xs text-muted mt-1 transition-colors group-hover:text-accent/80">
                                            Reliable file hosting
                                        </span>
                                        <div class="absolute inset-0 rounded-xl bg-accent/0 transition-colors duration-300 group-hover:bg-accent/5" />
                                    </button>
                                </div>

                                <div class="text-xs text-center text-muted mt-6">
                                    <span class="inline-flex items-center gap-1">
                                        <Info class="w-3 h-3" />
                                        Selection affects download speed and availability
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* File Selection */}
                    <Show when={selectedHoster()}>
                        <div class="bg-background-30 rounded-xl border border-secondary-20 shadow-sm max-h-[300px] overflow-auto no-scrollbar">
                            <div class="sticky top-0 z-20 backdrop-blur-md bg-background-30/80 py-3 px-4 border-b border-secondary-20/50">
                                <h3 class="text-sm font-semibold text-text flex items-center gap-2">
                                    <Box class="w-4 h-4 text-accent" />
                                    Files from {toTitleCaseExceptions(selectedHoster()!)}
                                </h3>
                            </div>
                            <div class="px-2">
                                <Show when={!loading()} fallback={<LoadingPage />}>
                                    <Show when={directLinks().length > 0} fallback={
                                        <div class="text-sm text-muted p-4 border border-dashed border-secondary-20 rounded-md bg-background-20 my-2 mx-2">
                                            No downloadable files found
                                        </div>
                                    }>
                                        <div class="divide-y divide-secondary-20 -mx-2">
                                            {/* Main Files */}
                                            <For each={categorized.Main}>
                                                {(file, index) => (
                                                    <DDLFileItem file={file} />
                                                )}
                                            </For>

                                            {/* Language Files */}
                                            <Show when={categorized.Languages.length > 0}>
                                                <div class="px-4 py-2 bg-background-20/50 text-xs text-text/80">
                                                    <Languages class="w-4 h-4 inline mr-1 text-accent" />
                                                    Language Files - Select languages you need
                                                </div>

                                                <For each={categorized.Languages}>
                                                    {(file, index) => (
                                                        <DDLFileItem
                                                            file={file}

                                                        />
                                                    )}
                                                </For>
                                            </Show>

                                            {/* Other Files */}
                                            <Show when={categorized.Others.length > 0}>
                                                <div class="px-4 py-2 bg-background-20/50 text-xs text-text/80">
                                                    <AlertTriangle class="w-4 h-4 inline mr-1 text-yellow-500" />
                                                    Optional Content - Only download if needed
                                                </div>
                                                <For each={categorized.Others}>
                                                    {(file, index) => (
                                                        <DDLFileItem
                                                            file={file}

                                                        />
                                                    )}
                                                </For>
                                            </Show>

                                            {/* Advanced options toggle - Only show if there are parts */}
                                            <Show when={categorized.Parts.length > 0}>
                                                <div class="px-4 py-2">
                                                    <button
                                                        onClick={() => setShowAdvanced(!showAdvanced())}
                                                        class="text-xs text-accent hover:underline flex items-center gap-1"
                                                    >
                                                        <Show when={showAdvanced()} fallback={
                                                            <>
                                                                <ChevronRight class="w-3 h-3" />
                                                                Show file parts
                                                            </>
                                                        }>
                                                            <>
                                                                <ChevronDown class="w-3 h-3" />
                                                                Hide file parts
                                                            </>
                                                        </Show>
                                                    </button>
                                                </div>

                                                {/* Advanced files */}
                                                <Show when={showAdvanced()}>
                                                    <div class="px-4 py-2 bg-background-20/50 text-xs text-text/80">
                                                        <AlertTriangle class="w-4 h-4 inline mr-1 text-yellow-500" />
                                                        Warning: Only modify these if you know what you're doing
                                                    </div>
                                                    <For each={categorized.Parts}>
                                                        {(file, index) => (
                                                            <DDLFileItem
                                                                file={file}

                                                            />
                                                        )}
                                                    </For>
                                                </Show>
                                            </Show>
                                        </div>
                                    </Show>
                                </Show>
                            </div>
                        </div>
                    </Show>
                </>
            );
        };

        return (
            <Modal {...props} onClose={destroy} onConfirm={handleStartDownload}>
                <div class="space-y-6">
                    <Show when={error()}>
                        <div class="bg-red-500/10 text-red-500 rounded-lg p-3 text-sm">
                            {error()}
                        </div>
                    </Show>

                    {props.downloadType === "bittorrent" ? renderTorrentUI() : renderDDLUI()}
                </div>
            </Modal>
        );
    };

    render(() => <LastStepPopup />, container);
}