import { useNavigate } from "@solidjs/router";
import { invoke } from "@tauri-apps/api/core";
import { message } from "@tauri-apps/plugin-dialog";
import { AlertTriangle, Box, Check, ChevronDown, ChevronRight, Download, Loader2, MemoryStick } from "lucide-solid";
import { Accessor, createEffect, createSignal, For, onMount, Show } from "solid-js";
import { render } from "solid-js/web";
import { DownloadedGame, FileInfo, InstallationSettings } from "../../bindings";
import { Modal } from "../Modal/Modal";
import { DownloadPopupProps } from "../../types/popup";
import { DownloadSettingsApi, GlobalSettingsApi } from "../../api/settings/api";
import TitleLabel from "../../pages/Settings-01/Settings-Categories/Components/UI/TitleLabel/TitleLabel";
import { TorrentApi } from "../../api/bittorrent/api";
import Checkbox from "../../components/UI/Checkbox/Checkbox";

const downloadSettingsInst = new DownloadSettingsApi();
const settingsInst = new GlobalSettingsApi();
const torrentInst = new TorrentApi();

export default function createLastStepDownloadPopup(props: DownloadPopupProps) {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const destroy = () => {
        render(() => null, container);
        container.remove();
    };


    const LastStepPopup = () => {
        const [listFiles, setListFiles] = createSignal<FileInfo[]>([]);
        const [selectedFileIndices, setSelectedFileIndices] = createSignal(new Set<number>());
        const [showAdvanced, setShowAdvanced] = createSignal(false);
        const [categorizedFiles, setCategorizedFiles] = createSignal<{
            Languages: Record<string, string>;
            Others: Record<string, string>;
        }>({ Languages: {}, Others: {} });
        const [uncategorizedFiles, setUncategorizedFiles] = createSignal<string[]>([]);
        const [installationSettings, setInstallationSettings] = createSignal<InstallationSettings>({
            auto_clean: false,
            auto_install: false,
            two_gb_limit: false,
            directx_install: false,
            microsoftcpp_install: false
        });

        type LanguageMap = {
            [key: string]: string;
        };

        type CategorizedFiles = {
            Languages: Record<string, string>;
            Others: Record<string, string>;
        };

        onMount(async () => {
            try {
                let downloadSettings = await downloadSettingsInst.getDownloadSettings();
                let settings = await settingsInst.getInstallationSettings();
                if (downloadSettings.status === "ok") {
                    console.log("settings: ", downloadSettings.data)
                }

                let resultFiles = await torrentInst.getTorrentFileList(props.downloadedGame.magnetlink);

                if (resultFiles.status === "ok") {
                    setListFiles(resultFiles.data);
                    const categorized = classifyFiles(resultFiles.data);
                    setCategorizedFiles(categorized);

                    const allIndices = new Set(resultFiles.data.map((_, index) => index));
                    setSelectedFileIndices(allIndices);
                } else {
                    console.error("Error : ", resultFiles.error)
                    await message("Failed to get list of files, fix is coming soon !",
                        { title: "File List Error", kind: "warning" }
                    );
                }


                setInstallationSettings(settings)

            } catch (error) {
                console.error("Error initializing settings:", error);
                await message("Failed to load download settings", { title: "Error", kind: "error" });
            }
        });

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
        };



        async function handleStartDownload() {
            const currentSettings = await downloadSettingsInst.getDownloadSettings();
            if (currentSettings.status === "ok") {
                let path = currentSettings.data.general.download_dir;
                //todo: add file list
                torrentInst.downloadTorrent(props.downloadedGame.magnetlink, props.downloadedGame, path);
                props.onFinish?.();
            } else {
                await message('Error downloading !' + currentSettings.error, { title: 'FitLauncher', kind: 'error' })
            }

            console.log("smthng")
        };

        function classifyFiles(files: FileInfo[]) {
            const languageMap: LanguageMap = {
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

            const categorizedFiles: CategorizedFiles = {
                Languages: {},
                Others: {}
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
        };


        createEffect(() => {
            console.log("list files: ", selectedFileIndices())
        })
        const FileItem = (props: {
            originalName: string, displayName: string, index: number, selectedFileIndices: Accessor<Set<number>
            >, toggleFileSelection: (index: number) => any
        }) => {
            const fileIndex = listFiles().findIndex(f => f.file_name === props.originalName);
            return (
                <label class="flex items-center justify-between gap-3 cursor-pointer w-full py-3 px-4 transition-all hover:bg-secondary-20/30 active:bg-secondary-20/50">
                    <span class="text-sm text-text truncate max-w-[70%]">{props.displayName}</span>
                    <Checkbox
                        checked={selectedFileIndices().has(fileIndex)}
                        action={() => toggleFileSelection(fileIndex)}
                    />
                </label>
            );
        };

        const findFileIndex = (fileName: string) => {
            return listFiles().findIndex(f => f.file_name === fileName);
        };

        return (
            <Modal {...props} onClose={destroy} onConfirm={handleStartDownload}>
                <div class="space-y-6">
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
                            <Show when={listFiles().length !== 0} fallback={
                                <div class="text-sm text-muted p-4 border border-dashed border-secondary-20 rounded-md bg-background-20 mt-2 mx-2">
                                    No files were detected in this torrent. This may happen if the game uses an old format without Pastebin support.
                                    A future update will fix this for older titles.
                                </div>
                            }>
                                <div class="divide-y divide-secondary-20 -mx-2">
                                    {/* Show categorized files (Languages and Optional) */}
                                    <For each={Object.entries(categorizedFiles().Languages)}>
                                        {([originalName, displayName], index) => (
                                            <FileItem
                                                originalName={originalName}
                                                displayName={displayName}
                                                index={findFileIndex(originalName)}
                                                selectedFileIndices={selectedFileIndices}
                                                toggleFileSelection={toggleFileSelection}
                                            />
                                        )}
                                    </For>

                                    <For each={Object.entries(categorizedFiles().Others)}>
                                        {([originalName, displayName], index) => (
                                            <FileItem
                                                originalName={originalName}
                                                displayName={displayName}
                                                index={findFileIndex(originalName)}
                                                selectedFileIndices={selectedFileIndices}
                                                toggleFileSelection={toggleFileSelection}
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
                                                <FileItem
                                                    originalName={fileName}
                                                    displayName={fileName}
                                                    index={findFileIndex(fileName)}
                                                    selectedFileIndices={selectedFileIndices}
                                                    toggleFileSelection={toggleFileSelection}
                                                />
                                            )}
                                        </For>
                                    </Show>
                                </div>
                            </Show>
                        </div>
                    </div>
                </div >
            </Modal >
        );

    };


    render(() => <LastStepPopup />, container);
}