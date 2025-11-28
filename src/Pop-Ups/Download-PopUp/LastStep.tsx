import { useNavigate } from "@solidjs/router";
import { message } from "@tauri-apps/plugin-dialog";
import { AlertTriangle, Box, ChevronDown, ChevronRight, Download, Info, Languages, MemoryStick, X, Zap, Magnet } from "lucide-solid";
import { createSignal, For, onMount, Show, Component, Accessor } from "solid-js";
import { render } from "solid-js/web";
import { DirectLink, DownloadedGame, FileInfo } from "../../bindings";
import { Modal } from "../Modal/Modal";
import { DownloadPopupProps } from "../../types/popup";
import { DownloadSettingsApi } from "../../api/settings/api";

import Checkbox from "../../components/UI/Checkbox/Checkbox";
import { formatBytes, toTitleCaseExceptions } from "../../helpers/format";
import LoadingPage from "../../pages/LoadingPage-01/LoadingPage";
import { DirectLinkWrapper } from "../../types/download";
import { classifyDdlFiles, classifyTorrentFiles } from "../../helpers/classify";
import { useToast } from "solid-notifications";
import { DM } from "../../api/manager/api";
import { DebridApi, ProviderInfo, StoredCredentials } from "../../api/debrid/api";





const TorrentFileItem: Component<{ originalName: string; displayName: string; index: number; selected: Set<number>; onToggle: (i: number) => void; files: FileInfo[] }> = (props) => {
    const file = props.files.find((f) => f.file_name === props.originalName);
    const size = file ? formatBytes(file.length) : "-";
    return (
        <label class="flex items-center justify-between gap-3 cursor-pointer w-full py-3 px-4 transition-all hover:bg-secondary-20/30 active:bg-secondary-20/50" title={props.originalName}>
            <span class="text-sm text-text truncate max-w-[55%]" title={props.originalName}>{props.displayName}</span>
            <div class="flex items-center gap-3">
                <div class="min-w-[70px] h-full text-xs text-muted bg-background-20 border border-secondary-20 rounded px-2 py-1 flex items-center justify-center">{size}</div>
                <Checkbox checked={props.selected.has(props.index)} action={() => props.onToggle(props.index)} />
            </div>
        </label>
    );
};

const DDLFileItem: Component<{ file: DirectLinkWrapper; selected: Set<string>; onToggle: (url: string) => void }> = (props) => {
    const size = formatBytes(props.file.size);
    return (
        <label class="flex items-center justify-between gap-3 cursor-pointer w-full py-3 px-4 transition-all hover:bg-secondary-20/30 active:bg-secondary-20/50" title={props.file.filename || ""}>
            <span class="text-sm text-text truncate max-w-[55%]" title={props.file.filename || ""}>{props.file.displayName || props.file.filename}</span>
            <div class="flex items-center gap-3">
                <div class="min-w-[70px] h-full text-xs text-muted bg-background-20 border border-secondary-20 rounded px-2 py-1 flex items-center justify-center">{size}</div>
                <Checkbox checked={props.selected.has(props.file.url)} action={() => props.onToggle(props.file.url)} />
            </div>
        </label>
    );
};

export default function createLastStepDownloadPopup(props: DownloadPopupProps) {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const destroy = () => {
        render(() => null, container);
        container.remove();
    };

    const LastStepPopup = () => {
        const [loading, setLoading] = createSignal(true);
        const [error, setError] = createSignal<string | null>(null);

        // Torrent state
        const [listFiles, setListFiles] = createSignal<FileInfo[]>([]);
        const [selectedFileIndices, setSelectedFileIndices] = createSignal(new Set<number>());
        const [categorizedFiles, setCategorizedFiles] = createSignal<{
            Languages: Record<string, string>;
            Others: Record<string, string>;
        }>({
            Languages: {},
            Others: {},
        });
        const [uncategorizedFiles, setUncategorizedFiles] = createSignal<string[]>([]);
        const [showTorrentAdvanced, setShowTorrentAdvanced] = createSignal(false);

        // DDL state
        const [selectedHoster, setSelectedHoster] = createSignal<"fuckingfast" | "datanodes" | null>(null);
        const [directLinks, setDirectLinks] = createSignal<DirectLinkWrapper[]>([]);
        const [ddlSelectedUrls, setDdlSelectedUrls] = createSignal(new Set<string>());
        const [showDdlAdvanced, setShowDdlAdvanced] = createSignal(false);

        // Debrid state
        type DownloadMethod = "bittorrent" | "debrid";
        const [downloadMethod, setDownloadMethod] = createSignal<DownloadMethod>("bittorrent");
        const [debridProviders, setDebridProviders] = createSignal<Array<ProviderInfo & { credentials: StoredCredentials }>>([]);
        const [selectedDebridProvider, setSelectedDebridProvider] = createSignal<string | null>(null);
        const [hasDebridProviders, setHasDebridProviders] = createSignal(false);

        onMount(async () => {
            try {
                // Load debrid providers for bittorrent downloads
                if (props.downloadType === "bittorrent") {
                    const enabled = await DebridApi.getEnabledProviders();
                    setDebridProviders(enabled);
                    setHasDebridProviders(enabled.length > 0);
                    if (enabled.length > 0) {
                        setSelectedDebridProvider(enabled[0].id);
                    }
                }

                if (props.downloadType === "bittorrent") {
                    await initTorrent();
                } else {
                    await initDDL();
                }
            } catch (e) {
                console.error("init error", e);
                setError("Failed to initialize download");
            } finally {
                setLoading(false);
            }
        });

        async function initTorrent() {
            const settings = await DownloadSettingsApi.getDownloadSettings();
            if (settings.status !== "ok") {
                console.warn("Couldn't load download settings", settings.error);
            }

            const resultFiles = await DM.getTorrentFileList(props.downloadedGame.magnetlink);
            if (resultFiles.status === "ok") {
                setListFiles(resultFiles.data);
                const classified = classifyTorrentFiles(resultFiles.data);
                setCategorizedFiles({ Languages: classified.Languages, Others: classified.Others });
                setUncategorizedFiles(classified.Uncategorized);

                const all = new Set(resultFiles.data.map((_, i) => i));
                setSelectedFileIndices(all);
            } else {
                console.error("getTorrentFileList failed", resultFiles.error);
                setError("Failed to get torrent file list");
            }
        }

        async function initDDL() {
            try {
                const links = await DM.getDatahosterLinks(props.downloadedGame.href, "");
                if (!links || links.length === 0) {
                    setError("No download links found for this game");
                    return;
                }
                // don't auto-select hoster here — user picks one
            } catch (e) {
                console.error("initDDL error", e);
                setError("Failed to initialize DDL links");
            }
        }

        function toggleFileSelection(index: number) {
            setSelectedFileIndices((prev) => {
                const next = new Set(prev);
                next.has(index) ? next.delete(index) : next.add(index);
                return next;
            });
        }

        function toggleDdlSelection(url: string) {
            setDdlSelectedUrls((prev) => {
                const next = new Set(prev);
                next.has(url) ? next.delete(url) : next.add(url);
                return next;
            });
        }

        async function handleStartDownload() {
            setLoading(true);
            setError(null);

            try {
                const settings = await DownloadSettingsApi.getDownloadSettings();
                if (settings.status !== "ok") {
                    throw new Error(String(settings.error));
                }

                const path = settings.data.general.download_dir;
                const game = props.downloadedGame;

                if (props.downloadType === "bittorrent") {
                    if (downloadMethod() === "debrid") {
                        // Debrid download - convert magnet to direct links
                        const providerId = selectedDebridProvider();
                        if (!providerId) {
                            throw new Error("No debrid provider selected");
                        }
                        const apiKey = await DebridApi.getApiKey(providerId);
                        if (!apiKey) {
                            throw new Error("Failed to get API key for debrid provider");
                        }
                        // For debrid, we download all files (no selection)
                        const result = await DM.addDebrid(game.magnetlink, providerId, apiKey, [], path, game);
                        if (result.status === "error") {
                            throw new Error(result.error);
                        }
                    } else {
                        // Traditional bittorrent download
                        const selected = Array.from(selectedFileIndices());
                        await DM.addTorrent(game.magnetlink, selected, path, game);
                    }
                } else {
                    const selectedLinks = directLinks().filter(l => ddlSelectedUrls().has(l.url));
                    if (!selectedLinks.length) throw new Error("No files selected");

                    await DM.addDdl(selectedLinks, path, game);
                }

                props.onFinish?.();
                destroy();

            } catch (err: any) {
                await message(`Failed: ${err.message ?? err}`, {
                    title: "Error",
                    kind: "error",
                });
                setError(err.message ?? "Failed");
            } finally {
                setLoading(false);
            }
        }



        async function loadHosterLinks(hoster: "fuckingfast" | "datanodes") {
            setLoading(true);
            setError(null);
            setSelectedHoster(hoster);

            try {
                const links = await DM.getDatahosterLinks(props.downloadedGame.href, hoster);
                if (!links || links.length === 0) {
                    setError(`No ${toTitleCaseExceptions(hoster)} links found`);
                    setLoading(false);
                    return;
                }

                if (hoster === "fuckingfast") {
                    const extracted = await DM.extractFuckingfastDDL(links);
                    if (!extracted || extracted.length === 0) {
                        setError("Failed to extract direct download links");
                        setLoading(false);
                        return;
                    }
                    // adapt to wrapper
                    const wrapped = extracted.map((e) => ({ ...e } as DirectLinkWrapper));
                    setDirectLinks(wrapped);
                    setDdlSelectedUrls(new Set(wrapped.map((w) => w.url)));
                } else {
                    const wrapped = links.map((url) => ({ url, filename: url.split("/").pop() || "file.bin" } as DirectLinkWrapper));
                    setDirectLinks(wrapped);
                    setDdlSelectedUrls(new Set(wrapped.map((w) => w.url)));
                }
            } catch (e) {
                console.error("loadHosterLinks error", e);
                setError(`Failed to load ${toTitleCaseExceptions(hoster)} links`);
            } finally {
                setLoading(false);
            }
        }

        const findFileIndex = (name: string) => listFiles().findIndex((f) => f.file_name === name);

        function deselectOptionalFiles() {
            if (props.downloadType === "bittorrent") {
                const c = categorizedFiles();
                const indicesToRemove = new Set<number>();
                for (const name of [...Object.keys(c.Languages), ...Object.keys(c.Others)]) {
                    const idx = findFileIndex(name);
                    if (idx !== -1) indicesToRemove.add(idx);
                }
                setSelectedFileIndices((prev) => {
                    const next = new Set(prev);
                    for (const i of indicesToRemove) next.delete(i);
                    return next;
                });
            } else {
                const categorized = classifyDdlFiles(directLinks());
                const urlsToRemove = new Set([...categorized.Languages.map(f => f.url), ...categorized.Others.map(f => f.url)]);
                setDdlSelectedUrls((prev) => {
                    const next = new Set(prev);
                    for (const u of urlsToRemove) next.delete(u);
                    return next;
                });
            }
        }

        const renderTorrentUI = () => {
            const categorized = classifyTorrentFiles(listFiles());
            // update signals so the UI reflects classification if needed
            // we keep original categorizedFiles signal for compatibility
            // (but don't clobber user selections)
            return (
                <>
                    <div class="text-center">
                        <div class="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Box class="w-8 h-8 text-accent" />
                        </div>
                        <h2 class="text-xl font-bold text-text mb-2">Choose What to Download</h2>
                        <p class="text-muted">Select the files you want from the torrent. You can proceed without selecting to download everything.</p>
                    </div>

                    {/* Download Method Selector - only show if debrid providers are configured */}
                    <Show when={hasDebridProviders()}>
                        <div class="bg-background-30 rounded-xl border border-secondary-20 p-4">
                            <h3 class="text-sm font-semibold text-text mb-3">Download Method</h3>
                            <div class="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => setDownloadMethod("bittorrent")}
                                    class={`flex items-center gap-3 p-3 rounded-lg border transition-all ${downloadMethod() === "bittorrent" ? "border-accent bg-accent/10" : "border-secondary-20 hover:border-secondary-10"}`}
                                >
                                    <Magnet class={`w-5 h-5 ${downloadMethod() === "bittorrent" ? "text-accent" : "text-muted"}`} />
                                    <div class="text-left">
                                        <div class={`text-sm font-medium ${downloadMethod() === "bittorrent" ? "text-text" : "text-muted"}`}>BitTorrent</div>
                                        <div class="text-xs text-muted">Traditional P2P</div>
                                    </div>
                                </button>
                                <button
                                    onClick={() => setDownloadMethod("debrid")}
                                    class={`flex items-center gap-3 p-3 rounded-lg border transition-all ${downloadMethod() === "debrid" ? "border-accent bg-accent/10" : "border-secondary-20 hover:border-secondary-10"}`}
                                >
                                    <Zap class={`w-5 h-5 ${downloadMethod() === "debrid" ? "text-accent" : "text-muted"}`} />
                                    <div class="text-left">
                                        <div class={`text-sm font-medium ${downloadMethod() === "debrid" ? "text-text" : "text-muted"}`}>Debrid</div>
                                        <div class="text-xs text-muted">Faster, No VPN</div>
                                    </div>
                                </button>
                            </div>

                            {/* Provider selector for debrid */}
                            <Show when={downloadMethod() === "debrid" && debridProviders().length > 1}>
                                <div class="mt-3">
                                    <label class="text-xs text-muted mb-1 block">Select Provider</label>
                                    <select
                                        value={selectedDebridProvider() || ""}
                                        onChange={(e) => setSelectedDebridProvider(e.currentTarget.value)}
                                        class="w-full bg-background border border-secondary-20 rounded-lg px-3 py-2 text-text text-sm focus:border-accent focus:outline-none"
                                    >
                                        <For each={debridProviders()}>
                                            {(provider) => (
                                                <option value={provider.id}>{provider.name}</option>
                                            )}
                                        </For>
                                    </select>
                                </div>
                            </Show>

                            <Show when={downloadMethod() === "debrid"}>
                                <div class="mt-3 text-xs text-muted bg-background/50 rounded-lg p-2 flex items-start gap-2">
                                    <Info class="w-4 h-4 flex-shrink-0 mt-0.5" />
                                    <span>Debrid downloads all files automatically. File selection is not available with this method.</span>
                                </div>
                            </Show>
                        </div>
                    </Show>

                    {/* File selection - hidden when debrid is selected */}
                    <Show when={downloadMethod() !== "debrid"}>
                    <div class="bg-background-30 rounded-xl border border-secondary-20 shadow-sm max-h-[300px] overflow-auto no-scrollbar">
                        <div class="sticky top-0 z-20 backdrop-blur-md bg-background-30/80 py-3 px-4 border-b border-secondary-20/50">
                            <h3 class="text-sm font-semibold text-text flex items-center gap-2"><MemoryStick class="w-4 h-4 text-accent" /> Files in Torrent</h3>
                        </div>

                        <div class="px-2">
                            <Show when={!loading()} fallback={<LoadingPage />}>
                                <Show when={listFiles().length !== 0} fallback={
                                    <div class="text-sm text-muted p-4 border border-dashed border-secondary-20 rounded-md bg-background-20 my-2 mx-2">No files were detected in this torrent. This may happen if the game uses an old format without Pastebin support. A future update will fix this for older titles.</div>
                                }>
                                    <div class="divide-y divide-secondary-20 -mx-2">
                                        <Show when={Object.entries(categorized.Languages).length > 0 || Object.entries(categorized.Others).length > 0}>
                                            <div class="w-full flex justify-end px-4 py-2">
                                                <button onClick={deselectOptionalFiles} class="text-xs flex items-center gap-1 px-2.5 py-1 rounded border border-yellow-500/30 bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/15 transition-colors"><X class="w-3 h-3" /><span>Deselect All Languages & Extras</span></button>
                                            </div>
                                        </Show>

                                        <For each={Object.entries(categorized.Languages)}>
                                            {([originalName, displayName]) => (
                                                <TorrentFileItem originalName={originalName} displayName={toTitleCaseExceptions(displayName)} index={findFileIndex(originalName)} selected={selectedFileIndices()} onToggle={toggleFileSelection} files={listFiles()} />
                                            )}
                                        </For>

                                        <For each={Object.entries(categorized.Others)}>
                                            {([originalName, displayName]) => (
                                                <TorrentFileItem originalName={originalName} displayName={toTitleCaseExceptions(displayName)} index={findFileIndex(originalName)} selected={selectedFileIndices()} onToggle={toggleFileSelection} files={listFiles()} />
                                            )}
                                        </For>

                                        <div class="px-4 py-2">
                                            <button onClick={() => setShowTorrentAdvanced(!showTorrentAdvanced())} class="text-xs text-accent hover:underline flex items-center gap-1">
                                                <Show when={showTorrentAdvanced()} fallback={<><ChevronRight class="w-3 h-3" /> Show advanced options</>}>
                                                    <><ChevronDown class="w-3 h-3" /> Hide advanced options</>
                                                </Show>
                                            </button>
                                        </div>

                                        <Show when={showTorrentAdvanced()}>
                                            <div class="px-4 py-2 bg-background-20/50 text-xs text-text/80"><AlertTriangle class="w-4 h-4 inline mr-1 text-yellow-500" /> Warning: Only modify these if you know what you're doing</div>
                                            <For each={uncategorizedFiles()}>{(fileName) => (
                                                <TorrentFileItem originalName={fileName} displayName={fileName} index={findFileIndex(fileName)} selected={selectedFileIndices()} onToggle={toggleFileSelection} files={listFiles()} />
                                            )}</For>
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

        const renderDDLUI = () => {
            const categorized = classifyDdlFiles(directLinks());
            return (
                <>
                    <div class="text-center">
                        <div class="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4"><Download class="w-8 h-8 text-accent" /></div>
                        <h2 class="text-xl font-bold text-text mb-2">Direct Download</h2>
                        <p class="text-muted">Choose your download source and select files to download</p>
                    </div>

                    {!selectedHoster() && (
                        <div class="bg-background-30 rounded-xl border border-secondary-20 shadow-sm backdrop-blur-sm bg-opacity-80">
                            <div class="p-6">
                                <h3 class="text-lg font-semibold text-text mb-6 text-center">Select Download Provider<div class="text-xs font-normal text-muted mt-1">Choose your preferred download source</div></h3>

                                <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <button onClick={() => loadHosterLinks("fuckingfast")} class="group relative flex flex-col items-center justify-center p-5 rounded-xl bg-background border border-secondary-20 transition-all duration-200">
                                        <div class="relative w-20 h-20 rounded-xl flex items-center justify-center mb-4 overflow-hidden bg-gradient-to-br from-background to-secondary-20/50 border border-secondary-20 transition-colors group-hover:border-accent/50"><img src="https://fuckingfast.co/static/favicon.ico" alt="FuckingFast" class="size-12 object-contain rounded-md" /></div>
                                        <span class="font-medium text-text transition-colors group-hover:text-primary">FuckingFast</span>
                                        <span class="text-xs text-muted mt-1 transition-colors group-hover:text-accent/80">Ultra-fast downloads</span>
                                        <div class="absolute inset-0 rounded-xl bg-accent/0 transition-colors duration-300 group-hover:bg-accent/5" />
                                    </button>

                                    <button
                                        disabled
                                        onClick={() => loadHosterLinks("datanodes")}
                                        class="group relative flex flex-col items-center justify-center p-5 rounded-xl bg-background border border-secondary-20 opacity-50 cursor-not-allowed pointer-events-none transition-all duration-200"
                                    >
                                        <div class="relative w-20 h-20 rounded-xl flex items-center justify-center mb-4 overflow-hidden bg-gradient-to-br from-background to-secondary-20/50 border border-secondary-20 opacity-50">
                                            <img src="https://datanodes.to/favicon.ico" alt="DataNodes" class="size-12 object-contain" />
                                        </div>
                                        <span class="font-medium text-muted">DataNodes</span>
                                        <span class="text-xs text-muted mt-1">Not working at the moment</span>
                                    </button>

                                </div>

                                <div class="text-xs text-center text-muted mt-6"><span class="inline-flex items-center gap-1"><Info class="w-3 h-3" />Selection affects download speed and availability</span></div>
                            </div>
                        </div>
                    )}

                    <Show when={selectedHoster()}>
                        <div class="bg-background-30 rounded-xl border border-secondary-20 shadow-sm max-h-[300px] overflow-auto no-scrollbar">
                            <div class="sticky top-0 z-20 backdrop-blur-md bg-background-30/80 py-3 px-4 border-b border-secondary-20/50"><h3 class="text-sm font-semibold text-text flex items-center gap-2"><Box class="w-4 h-4 text-accent" /> Files from {toTitleCaseExceptions(selectedHoster()!)}</h3></div>
                            <div class="px-2">
                                <Show when={!loading()} fallback={<LoadingPage />}>
                                    <Show when={directLinks().length > 0} fallback={<div class="text-sm text-muted p-4 border border-dashed border-secondary-20 rounded-md bg-background-20 my-2 mx-2">No downloadable files found</div>}>
                                        <div class="divide-y divide-secondary-20 -mx-2">
                                            <Show when={categorized.Others.length > 0}>
                                                <div class="w-full flex justify-end px-4 py-2"><button onClick={deselectOptionalFiles} class="text-xs flex items-center gap-1 px-2.5 py-1 rounded border border-yellow-500/30 bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/15 transition-colors"><X class="w-3 h-3" /><span>Deselect All Languages & Extras</span></button></div>
                                            </Show>

                                            <For each={categorized.Main}>{(file) => <DDLFileItem file={file} selected={ddlSelectedUrls()} onToggle={toggleDdlSelection} />}</For>

                                            <Show when={categorized.Languages.length > 0}><div class="px-4 py-2 bg-background-20/50 text-xs text-text/80"><Languages class="w-4 h-4 inline mr-1 text-accent" /> Language Files - Select languages you need</div><For each={categorized.Languages}>{(file) => <DDLFileItem file={file} selected={ddlSelectedUrls()} onToggle={toggleDdlSelection} />}</For></Show>

                                            <Show when={categorized.Others.length > 0}><div class="px-4 py-2 bg-background-20/50 text-xs text-text/80"><AlertTriangle class="w-4 h-4 inline mr-1 text-yellow-500" /> Optional Content - Only download if needed</div><For each={categorized.Others}>{(file) => <DDLFileItem file={file} selected={ddlSelectedUrls()} onToggle={toggleDdlSelection} />}</For></Show>

                                            <Show when={categorized.Parts.length > 0}>
                                                <div class="px-4 py-2"><button onClick={() => setShowDdlAdvanced(!showDdlAdvanced())} class="text-xs text-accent hover:underline flex items-center gap-1"><Show when={showDdlAdvanced()} fallback={<><ChevronRight class="w-3 h-3" /> Show file parts</>}><><ChevronDown class="w-3 h-3" /> Hide file parts</></Show></button></div>
                                                <Show when={showDdlAdvanced()}><div class="px-4 py-2 bg-background-20/50 text-xs text-text/80"><AlertTriangle class="w-4 h-4 inline mr-1 text-yellow-500" /> Warning: Only modify these if you know what you're doing</div><For each={categorized.Parts}>{(file) => <DDLFileItem file={file} selected={ddlSelectedUrls()} onToggle={toggleDdlSelection} />}</For></Show>
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
            <Modal {...props} onClose={destroy} onConfirm={handleStartDownload} disabledConfirm={loading}>
                <div class="space-y-6">
                    <Show when={error()}>
                        <div class="bg-red-500/10 text-red-500 rounded-lg p-3 text-sm">{error()}</div>
                    </Show>

                    {props.downloadType === "bittorrent" ? renderTorrentUI() : renderDDLUI()}
                </div>
            </Modal>
        );
    };

    render(() => <LastStepPopup />, container);
}
