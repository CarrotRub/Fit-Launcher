import { showError } from "../../helpers/error";
import { AlertTriangle, Box, ChevronDown, ChevronRight, Download, Info, Languages, MemoryStick, X, Zap, Loader2 } from "lucide-solid";
import { createSignal, For, onMount, Show, Component } from "solid-js";
import { render } from "solid-js/web";
import { FileInfo, DebridProvider, DebridFile, DebridProviderInfo } from "../../bindings";
import { Modal } from "../Modal/Modal";
import { DownloadPopupProps } from "../../types/popup";
import { DownloadSettingsApi } from "../../api/settings/api";
import Checkbox from "../../components/UI/Checkbox/Checkbox";
import { formatBytes, toTitleCaseExceptions } from "../../helpers/format";
import LoadingPage from "../../pages/LoadingPage-01/LoadingPage";
import { DirectLinkWrapper } from "../../types/download";
import { classifyDdlFiles, classifyTorrentFiles, classifyDebridFiles } from "../../helpers/classify";
import { DM } from "../../api/manager/api";
import * as Debrid from "../../api/debrid/api";

// Unified file item - works for torrent, DDL, and debrid files
type FileItemProps = {
    name: string;
    displayName: string;
    size: number;
    id: string | number;
    selected: boolean;
    onToggle: () => void;
};

const FileItem: Component<FileItemProps> = (props) => (
    <label class="flex items-center justify-between gap-3 cursor-pointer w-full py-3 px-4 transition-all hover:bg-secondary-20/30 active:bg-secondary-20/50" title={props.name}>
        <span class="text-sm text-text truncate max-w-[55%]" title={props.name}>{props.displayName}</span>
        <div class="flex items-center gap-3">
            <div class="min-w-[70px] h-full text-xs text-muted bg-background-20 border border-secondary-20 rounded px-2 py-1 flex items-center justify-center">
                {formatBytes(props.size)}
            </div>
            <Checkbox checked={props.selected} action={props.onToggle} />
        </div>
    </label>
);

// Caching progress UI for debrid providers
type CachingProgressProps = {
    name: string;
    progress: number;
    speed: number | null;
    seeders: number | null;
    onRefresh: () => void;
    onCancel: () => void;
};

const CachingProgress: Component<CachingProgressProps> = (props) => (
    <div class="bg-background-30 rounded-xl border border-secondary-20 shadow-sm p-6">
        <div class="flex flex-col items-center gap-4">
            <Loader2 class="w-10 h-10 text-blue-500 animate-spin" />
            <div class="text-center">
                <h3 class="text-lg font-semibold text-text">Caching on Real-Debrid</h3>
                <p class="text-sm text-muted mt-1">This torrent is being cached. You can wait or cancel.</p>
            </div>
            <div class="w-full max-w-md">
                <div class="flex justify-between text-xs text-muted mb-1">
                    <span>{props.name}</span>
                    <span>{props.progress.toFixed(1)}%</span>
                </div>
                <div class="w-full bg-background-20 rounded-full h-2">
                    <div class="bg-blue-500 h-2 rounded-full transition-all duration-300" style={{ width: `${props.progress}%` }} />
                </div>
                <div class="flex justify-between text-xs text-muted mt-2">
                    <span>{props.speed ? `${formatBytes(props.speed)}/s` : "Waiting..."}</span>
                    <span>{props.seeders !== null ? `${props.seeders} seeders` : ""}</span>
                </div>
            </div>
            <div class="flex gap-3 mt-2">
                <button onClick={props.onRefresh} class="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">Refresh Status</button>
                <button onClick={props.onCancel} class="px-4 py-2 text-sm bg-background-20 text-text rounded-lg hover:bg-background-10 transition-colors border border-secondary-20">Cancel</button>
            </div>
            <p class="text-xs text-muted text-center mt-2">💡 Caching helps other users download faster in the future</p>
        </div>
    </div>
);

// Provider color utility
const getProviderColorClasses = (color: string) => {
    const map: Record<string, { border: string; hover: string; text: string; bg: string }> = {
        emerald: { border: "border-emerald-500/50", hover: "hover:border-emerald-500", text: "text-emerald-500", bg: "group-hover:bg-emerald-500/5" },
        blue: { border: "border-blue-500/50", hover: "hover:border-blue-500", text: "text-blue-500", bg: "group-hover:bg-blue-500/5" },
        purple: { border: "border-purple-500/50", hover: "hover:border-purple-500", text: "text-purple-500", bg: "group-hover:bg-purple-500/5" },
        green: { border: "border-green-500/50", hover: "hover:border-green-500", text: "text-green-500", bg: "group-hover:bg-green-500/5" },
    };
    return map[color] || map.green;
};

// Provider selection card
type ProviderCardProps = {
    name: string;
    subtitle: string;
    icon: string | Component;
    color?: string;
    disabled?: boolean;
    loading?: boolean;
    cached?: boolean | null;
    onClick: () => void;
};

const ProviderCard: Component<ProviderCardProps> = (props) => {
    const colors = () => props.color ? getProviderColorClasses(props.color) : null;
    const isCached = () => props.cached === true;
    const isDisabled = () => props.disabled || (props.cached === false);

    return (
        <button
            onClick={props.onClick}
            disabled={isDisabled()}
            class={`group relative flex items-center gap-4 p-4 rounded-xl bg-background border transition-all duration-200 min-h-[72px] ${isCached() && colors() ? `${colors()!.border} ${colors()!.hover}` :
                "border-secondary-20" + (isDisabled() ? " opacity-50 cursor-not-allowed" : " hover:border-secondary-30")
                }`}
        >
            <div class={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-background to-secondary-20/50 border transition-colors ${isCached() && colors() ? colors()!.border : "border-secondary-20"}`}>
                {typeof props.icon === "string"
                    ? <img src={props.icon} alt={props.name} class="size-7 object-contain rounded-md" />
                    : <Zap class={`size-7 ${isCached() && colors() ? colors()!.text : "text-muted"}`} />}
            </div>
            <div class="flex flex-col items-start min-w-0">
                <span class={`font-medium transition-colors ${isCached() ? "text-text" : "text-muted"}`}>{props.name}</span>
                <span class={`text-xs ${isCached() && colors() ? colors()!.text : "text-muted"}`}>{props.subtitle}</span>
            </div>
            {isCached() && colors() && <div class={`absolute inset-0 rounded-xl bg-transparent transition-colors duration-300 ${colors()!.bg}`} />}
        </button>
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
        const [, setDebridProvidersLoading] = createSignal(true);
        const [allDebridProviders, setAllDebridProviders] = createSignal<DebridProviderInfo[]>([]); // ALL providers
        const [configuredDebridProviders, setConfiguredDebridProviders] = createSignal<Set<DebridProvider>>(new Set()); // providers WITH credentials
        const [debridCacheStatus, setDebridCacheStatus] = createSignal<Map<DebridProvider, boolean | null>>(new Map()); // provider -> isCached (null = still checking)
        const [invalidApiProviders, setInvalidApiProviders] = createSignal<Set<DebridProvider>>(new Set()); // providers with bad/expired API keys
        const [selectedDebridProvider, setSelectedDebridProvider] = createSignal<DebridProvider | null>(null);
        const [debridTorrentId, setDebridTorrentId] = createSignal<string | null>(null);
        const [debridFiles, setDebridFiles] = createSignal<DebridFile[]>([]);
        const [selectedDebridFiles, setSelectedDebridFiles] = createSignal<Set<string>>(new Set()); // file.id set
        const [showDebridAdvanced, setShowDebridAdvanced] = createSignal(false);
        // Caching state for Real-Debrid (when torrent is not instantly available)
        const [debridCachingStatus, setDebridCachingStatus] = createSignal<{
            isCaching: boolean;
            progress: number;
            speed: number | null;
            seeders: number | null;
            name: string;
        } | null>(null);

        onMount(async () => {
            try {
                if (props.downloadType === "bittorrent") {
                    await initTorrent();
                } else {
                    await initDDL();
                    // Also check if any debrid providers have this cached
                    await checkDebridProviders();
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
                if (next.has(index)) {
                    next.delete(index);
                } else {
                    next.add(index);
                }
                return next;
            });
        }

        function toggleDdlSelection(url: string) {
            setDdlSelectedUrls((prev) => {
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
            // If debrid provider is selected, use the debrid download handler
            if (selectedDebridProvider()) {
                return handleDebridDownload();
            }

            setLoading(true);
            setError(null);

            try {
                const settings = await DownloadSettingsApi.getDownloadSettings();
                if (settings.status !== "ok") {
                    throw new Error(String(settings.error));
                }

                const path = settings.data.general.download_dir;
                // Convert DownloadedGame to Game for DM API
                const game = { ...props.downloadedGame, secondary_images: [] as string[] };

                if (props.downloadType === "bittorrent") {
                    const selected = Array.from(selectedFileIndices());
                    await DM.addTorrent(game.magnetlink, selected, path, game);
                } else {
                    const selectedLinks = directLinks().filter(l => ddlSelectedUrls().has(l.url));
                    if (!selectedLinks.length) throw new Error("No files selected");

                    await DM.addDdl(selectedLinks, path, game);
                }

                props.onFinish?.();
                destroy();

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } catch (err: any) {
                await showError(err, "Error");
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

        // Check which debrid providers have credentials and cache status
        async function checkDebridProviders() {
            setDebridProvidersLoading(true);

            const magnet = props.downloadedGame.magnetlink;
            const hash = magnet ? Debrid.extractHashFromMagnet(magnet) : null;

            const providerInfoList = await Debrid.listProviders();
            setAllDebridProviders(providerInfoList);

            const credInfo = await Debrid.listCredentials();
            const configuredIds = new Set(credInfo.status === "ok" ? credInfo.data.configured_providers : []);
            setConfiguredDebridProviders(configuredIds);
            setDebridProvidersLoading(false);

            if (hash && configuredIds.size > 0) {
                const providersWithCreds = providerInfoList.filter(p => configuredIds.has(p.id));
                await Promise.all(
                    providersWithCreds
                        .filter(p => p.supports_cache_check)
                        .map(async (p) => {
                            try {
                                const result = await Debrid.checkCache(p.id, hash);
                                if (result.status === "ok") {
                                    setDebridCacheStatus(prev => {
                                        const next = new Map(prev);
                                        next.set(p.id, result.data.is_cached);
                                        return next;
                                    });
                                } else {
                                    if (result.error === "InvalidApiKey") {
                                        setInvalidApiProviders(prev => {
                                            const next = new Set(prev);
                                            next.add(p.id);
                                            return next;
                                        });
                                    }
                                    setDebridCacheStatus(prev => {
                                        const next = new Map(prev);
                                        next.set(p.id, false);
                                        return next;
                                    });
                                }
                            } catch {
                                setDebridCacheStatus(prev => {
                                    const next = new Map(prev);
                                    next.set(p.id, false);
                                    return next;
                                });
                            }
                        })
                );
            }
        }

        // Load files from a debrid provider
        // For providers without cache check (like Real-Debrid), we add the torrent first
        // then poll to see if it becomes ready within 3 seconds
        async function loadDebridProvider(provider: DebridProvider) {
            setLoading(true);
            setError(null);
            setSelectedDebridProvider(provider);
            setSelectedHoster(null); // Clear DDL hoster selection
            setShowDebridAdvanced(false);
            setDebridCachingStatus(null);

            try {
                const magnet = props.downloadedGame.magnetlink;

                // Add torrent to provider (returns torrent ID)
                const addResult = await Debrid.addTorrent(provider, magnet);
                if (addResult.status !== "ok") {
                    throw new Error(`Failed to add torrent: ${addResult.error}`);
                }

                const torrentId = addResult.data;
                setDebridTorrentId(torrentId);

                // For providers that don't support cache check, we poll for ready status
                const providerInfo = allDebridProviders().find(p => p.id === provider);
                if (providerInfo && !providerInfo.supports_cache_check) {
                    // Poll for up to 3 seconds to see if torrent becomes ready
                    const readyResult = await Debrid.waitForTorrentReady(provider, torrentId, 3000, 500);

                    if (!readyResult.ready && readyResult.status) {
                        // Torrent is still caching - show caching UI
                        setDebridCachingStatus({
                            isCaching: true,
                            progress: readyResult.status.progress,
                            speed: readyResult.status.speed ?? null,
                            seeders: readyResult.status.seeders ?? null,
                            name: readyResult.status.name,
                        });
                        setLoading(false);
                        return; // Don't load files yet, show caching status
                    }

                    if (!readyResult.ready) {
                        throw new Error("Torrent is not cached and failed to get status");
                    }
                }

                // Get torrent info with file list
                const infoResult = await Debrid.getTorrentInfo(provider, torrentId);
                if (infoResult.status !== "ok") {
                    throw new Error(`Failed to get torrent info: ${infoResult.error}`);
                }

                const files = infoResult.data.files;
                setDebridFiles(files);

                // Auto-select all files
                setSelectedDebridFiles(new Set(files.map(f => f.id)));

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } catch (e: any) {
                console.error("loadDebridProvider error", e);
                setError(e.message ?? `Failed to load from ${provider}`);
                setSelectedDebridProvider(null);
            } finally {
                setLoading(false);
            }
        }

        // Poll caching progress for Real-Debrid (and other providers without cache check)
        async function pollCachingProgress() {
            const provider = selectedDebridProvider();
            const torrentId = debridTorrentId();
            if (!provider || torrentId === null) return;

            const result = await Debrid.getTorrentStatus(provider, torrentId);
            if (result.status !== "ok") {
                setError("Failed to get caching status");
                return;
            }

            const status = result.data;
            if (status.is_ready) {
                // Torrent is now ready! Load the files
                setDebridCachingStatus(null);
                setLoading(true);

                try {
                    const infoResult = await Debrid.getTorrentInfo(provider, torrentId);
                    if (infoResult.status !== "ok") {
                        throw new Error(`Failed to get torrent info: ${infoResult.error}`);
                    }

                    const files = infoResult.data.files;
                    setDebridFiles(files);
                    setSelectedDebridFiles(new Set(files.map(f => f.id)));
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                } catch (e: any) {
                    setError(e.message ?? "Failed to load files");
                } finally {
                    setLoading(false);
                }
            } else {
                // Still caching - update progress
                setDebridCachingStatus({
                    isCaching: true,
                    progress: status.progress,
                    speed: status.speed ?? null,
                    seeders: status.seeders ?? null,
                    name: status.name,
                });
            }
        }

        // Cancel caching and delete torrent from provider
        async function cancelCaching() {
            const provider = selectedDebridProvider();
            const torrentId = debridTorrentId();
            if (!provider || torrentId === null) return;

            try {
                await Debrid.deleteTorrent(provider, torrentId);
            } catch (e) {
                console.error("Failed to delete torrent", e);
            }

            setDebridCachingStatus(null);
            setSelectedDebridProvider(null);
            setDebridTorrentId(null);
        }

        function toggleDebridFileSelection(fileId: string) {
            setSelectedDebridFiles(prev => {
                const next = new Set(prev);
                if (next.has(fileId)) {
                    next.delete(fileId);
                } else {
                    next.add(fileId);
                }
                return next;
            });
        }

        // Check if we're using Real-Debrid and some files are deselected
        // RD doesn't support selective file downloads - it downloads everything
        const isRealDebridWithDeselectedFiles = () => {
            const provider = selectedDebridProvider();
            if (provider !== "realdebrid") return false;
            const allFiles = debridFiles();
            const selected = selectedDebridFiles();
            return allFiles.length > 0 && selected.size < allFiles.length;
        };

        // Start download from debrid provider
        async function handleDebridDownload() {
            const provider = selectedDebridProvider();
            const torrentId = debridTorrentId();
            if (!provider || torrentId === null) return;

            setLoading(true);
            setError(null);

            try {
                const settings = await DownloadSettingsApi.getDownloadSettings();
                if (settings.status !== "ok") {
                    throw new Error(String(settings.error));
                }

                const path = settings.data.general.download_dir;

                // Filter selected files
                const selectedIds = selectedDebridFiles();
                const filesToDownload = debridFiles().filter(f => selectedIds.has(f.id));

                if (filesToDownload.length === 0) {
                    throw new Error("No files selected");
                }

                // Get download links for selected files
                const linksResult = await Debrid.getDownloadLinks(provider, torrentId, filesToDownload);
                if (linksResult.status !== "ok") {
                    throw new Error(`Failed to get download links: ${linksResult.error}`);
                }

                // Convert to DirectLinkWrapper for aria2
                const wrappedLinks: DirectLinkWrapper[] = Debrid.toDirectLinks(linksResult.data);

                // Use existing DDL mechanism - convert DownloadedGame to Game
                const gameForDm = { ...props.downloadedGame, secondary_images: [] as string[] };
                await DM.addDdl(wrappedLinks, path, gameForDm);

                props.onFinish?.();
                destroy();

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } catch (err: any) {
                await showError(err, "Error");
                setError(err.message ?? "Failed");
            } finally {
                setLoading(false);
            }
        }

        const findFileIndex = (name: string) => listFiles().findIndex((f) => f.file_name === name);

        function deselectDebridOptionalFiles() {
            const debridCategorized = classifyDebridFiles(debridFiles());
            const ids = new Set([
                ...debridCategorized.Languages.map((f) => f.id),
                ...debridCategorized.Others.map((f) => f.id),
            ]);
            setSelectedDebridFiles((prev) => {
                const next = new Set(prev);
                for (const id of ids) next.delete(id);
                return next;
            });
        }

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
                                            {([originalName, displayName]) => {
                                                const file = listFiles().find(f => f.file_name === originalName);
                                                const idx = findFileIndex(originalName);
                                                return <FileItem name={originalName} displayName={toTitleCaseExceptions(displayName)} size={file?.length ?? 0} id={idx} selected={selectedFileIndices().has(idx)} onToggle={() => toggleFileSelection(idx)} />;
                                            }}
                                        </For>

                                        <For each={Object.entries(categorized.Others)}>
                                            {([originalName, displayName]) => {
                                                const file = listFiles().find(f => f.file_name === originalName);
                                                const idx = findFileIndex(originalName);
                                                return <FileItem name={originalName} displayName={toTitleCaseExceptions(displayName)} size={file?.length ?? 0} id={idx} selected={selectedFileIndices().has(idx)} onToggle={() => toggleFileSelection(idx)} />;
                                            }}
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
                                            <For each={uncategorizedFiles()}>{(fileName) => {
                                                const file = listFiles().find(f => f.file_name === fileName);
                                                const idx = findFileIndex(fileName);
                                                return <FileItem name={fileName} displayName={fileName} size={file?.length ?? 0} id={idx} selected={selectedFileIndices().has(idx)} onToggle={() => toggleFileSelection(idx)} />;
                                            }}</For>
                                        </Show>

                                    </div>
                                </Show>
                            </Show>
                        </div>
                    </div>
                </>
            );
        };

        const renderDDLUI = () => {
            const categorized = classifyDdlFiles(directLinks());
            const hasProviderSelected = () => selectedHoster() !== null || selectedDebridProvider() !== null;

            return (
                <>
                    {/* Provider Selection - shown when no provider is selected */}
                    <Show when={!hasProviderSelected()}>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* File Hosters - LEFT */}
                            <div class="bg-background-30 rounded-xl border border-secondary-20 p-4">
                                <div class="flex items-center gap-2 mb-3">
                                    <Download class="w-4 h-4 text-accent" />
                                    <h3 class="text-sm font-semibold text-text">File Hosters</h3>
                                </div>
                                <div class="grid grid-cols-1 gap-2">
                                    <ProviderCard name="FuckingFast" subtitle="Fast downloads" icon="https://fuckingfast.co/static/favicon.ico" onClick={() => loadHosterLinks("fuckingfast")} />
                                    <ProviderCard name="DataNodes" subtitle="Unavailable" icon="https://datanodes.to/favicon.ico" disabled onClick={() => loadHosterLinks("datanodes")} />
                                </div>
                            </div>

                            {/* Debrid Services*/}
                            <div class="bg-background-30 rounded-xl border border-secondary-20 p-4">
                                <div class="flex items-center gap-2 mb-3">
                                    <Zap class="w-4 h-4 text-emerald-500" />
                                    <h3 class="text-sm font-semibold text-text">Debrid Services</h3>
                                    <span class="text-xs text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">Premium</span>
                                </div>
                                <div class="grid grid-cols-1 gap-2">
                                    <For each={allDebridProviders().filter(p => p.is_implemented)}>
                                        {(p) => {
                                            const hasKey = () => configuredDebridProviders().has(p.id);
                                            const isInvalidApi = () => invalidApiProviders().has(p.id);
                                            const cacheStatus = () => debridCacheStatus().get(p.id);
                                            const subtitle = () => {
                                                if (!hasKey()) return "No API Key";
                                                if (isInvalidApi()) return "Invalid API Key";
                                                if (cacheStatus() === true) return "Cached";
                                                if (cacheStatus() === false) return "Not Cached";
                                                return "Checking...";
                                            };
                                            return <ProviderCard
                                                name={p.name}
                                                subtitle={subtitle()}
                                                icon={Zap}
                                                color={p.color}
                                                cached={hasKey() && !isInvalidApi() ? cacheStatus() : undefined}
                                                disabled={!hasKey() || isInvalidApi()}
                                                onClick={() => loadDebridProvider(p.id)}
                                            />;
                                        }}
                                    </For>
                                </div>
                            </div>
                        </div>
                    </Show>

                    {/* DDL Hoster File List */}
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

                                            <For each={categorized.Main}>{(file) => <FileItem name={file.filename || ""} displayName={file.displayName || file.filename || ""} size={file.size || 0} id={file.url} selected={ddlSelectedUrls().has(file.url)} onToggle={() => toggleDdlSelection(file.url)} />}</For>

                                            <Show when={categorized.Languages.length > 0}><div class="px-4 py-2 bg-background-20/50 text-xs text-text/80"><Languages class="w-4 h-4 inline mr-1 text-accent" /> Language Files - Select languages you need</div><For each={categorized.Languages}>{(file) => <FileItem name={file.filename || ""} displayName={file.displayName || file.filename || ""} size={file.size || 0} id={file.url} selected={ddlSelectedUrls().has(file.url)} onToggle={() => toggleDdlSelection(file.url)} />}</For></Show>

                                            <Show when={categorized.Others.length > 0}><div class="px-4 py-2 bg-background-20/50 text-xs text-text/80"><AlertTriangle class="w-4 h-4 inline mr-1 text-yellow-500" /> Optional Content - Only download if needed</div><For each={categorized.Others}>{(file) => <FileItem name={file.filename || ""} displayName={file.displayName || file.filename || ""} size={file.size || 0} id={file.url} selected={ddlSelectedUrls().has(file.url)} onToggle={() => toggleDdlSelection(file.url)} />}</For></Show>

                                            <Show when={categorized.Parts.length > 0}>
                                                <div class="px-4 py-2"><button onClick={() => setShowDdlAdvanced(!showDdlAdvanced())} class="text-xs text-accent hover:underline flex items-center gap-1"><Show when={showDdlAdvanced()} fallback={<><ChevronRight class="w-3 h-3" /> Show file parts</>}><><ChevronDown class="w-3 h-3" /> Hide file parts</></Show></button></div>
                                                <Show when={showDdlAdvanced()}><div class="px-4 py-2 bg-background-20/50 text-xs text-text/80"><AlertTriangle class="w-4 h-4 inline mr-1 text-yellow-500" /> Warning: Only modify these if you know what you're doing</div><For each={categorized.Parts}>{(file) => <FileItem name={file.filename || ""} displayName={file.displayName || file.filename || ""} size={file.size || 0} id={file.url} selected={ddlSelectedUrls().has(file.url)} onToggle={() => toggleDdlSelection(file.url)} />}</For></Show>
                                            </Show>

                                        </div>
                                    </Show>
                                </Show>
                            </div>
                        </div>
                    </Show >

                    {/* Debrid Provider File List */}
                    < Show when={selectedDebridProvider()} >
                        {(() => {
                            const cachingStatus = debridCachingStatus();
                            if (cachingStatus && cachingStatus.isCaching) {
                                return <CachingProgress name={cachingStatus.name} progress={cachingStatus.progress} speed={cachingStatus.speed} seeders={cachingStatus.seeders} onRefresh={pollCachingProgress} onCancel={cancelCaching} />;
                            }

                            const debridCategorized = classifyDebridFiles(debridFiles());
                            return (
                                <>
                                    {/* Real-Debrid warning when files are deselected */}
                                    <Show when={isRealDebridWithDeselectedFiles()}>
                                        <div class="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-4">
                                            <div class="flex items-start gap-3">
                                                <Info class="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                                                <div class="flex-1">
                                                    <h4 class="text-sm font-semibold text-amber-500 mb-1">Real-Debrid downloads all files</h4>
                                                    <p class="text-xs text-muted">
                                                        Real-Debrid doesn't support selective downloads. All files will be downloaded regardless of your selection. You can manually delete unwanted files after the download completes.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </Show>

                                    <div class="bg-background-30 rounded-xl border border-secondary-20 shadow-sm max-h-[300px] overflow-auto no-scrollbar">
                                        <div class="sticky top-0 z-20 backdrop-blur-md bg-background-30/80 py-3 px-4 border-b border-secondary-20/50">
                                            <h3 class="text-sm font-semibold text-text flex items-center gap-2">
                                                <Zap class="w-4 h-4 text-green-500" /> Files from {selectedDebridProvider()}
                                            </h3>
                                        </div>
                                        <div class="px-2">
                                            <Show when={!loading()} fallback={<LoadingPage />}>
                                                <Show when={debridFiles().length > 0} fallback={<div class="text-sm text-muted p-4 border border-dashed border-secondary-20 rounded-md bg-background-20 my-2 mx-2">No downloadable files found</div>}>
                                                    <div class="divide-y divide-secondary-20 -mx-2">
                                                        <Show when={debridCategorized.Languages.length > 0 || debridCategorized.Others.length > 0}>
                                                            <div class="w-full flex justify-end px-4 py-2">
                                                                <button onClick={deselectDebridOptionalFiles} class="text-xs flex items-center gap-1 px-2.5 py-1 rounded border border-yellow-500/30 bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/15 transition-colors">
                                                                    <X class="w-3 h-3" />
                                                                    <span>Deselect All Languages & Extras</span>
                                                                </button>
                                                            </div>
                                                        </Show>

                                                        <For each={debridCategorized.Languages}>
                                                            {(file) => <FileItem name={file.name} displayName={file.displayName || file.short_name || file.name} size={file.size} id={file.id} selected={selectedDebridFiles().has(file.id)} onToggle={() => toggleDebridFileSelection(file.id)} />}
                                                        </For>

                                                        <For each={debridCategorized.Others}>
                                                            {(file) => <FileItem name={file.name} displayName={file.displayName || file.short_name || file.name} size={file.size} id={file.id} selected={selectedDebridFiles().has(file.id)} onToggle={() => toggleDebridFileSelection(file.id)} />}
                                                        </For>

                                                        <div class="px-4 py-2">
                                                            <button onClick={() => setShowDebridAdvanced(!showDebridAdvanced())} class="text-xs text-accent hover:underline flex items-center gap-1">
                                                                <Show when={showDebridAdvanced()} fallback={<><ChevronRight class="w-3 h-3" /> Show advanced options</>}>
                                                                    <><ChevronDown class="w-3 h-3" /> Hide advanced options</>
                                                                </Show>
                                                            </button>
                                                        </div>

                                                        <Show when={showDebridAdvanced()}>
                                                            <div class="px-4 py-2 bg-background-20/50 text-xs text-text/80">
                                                                <AlertTriangle class="w-4 h-4 inline mr-1 text-yellow-500" /> Warning: Only modify these if you know what you're doing
                                                            </div>
                                                            <For each={debridCategorized.Main}>
                                                                {(file) => <FileItem name={file.name} displayName={file.displayName || file.short_name || file.name} size={file.size} id={file.id} selected={selectedDebridFiles().has(file.id)} onToggle={() => toggleDebridFileSelection(file.id)} />}
                                                            </For>
                                                            <For each={debridCategorized.Parts}>
                                                                {(file) => <FileItem name={file.name} displayName={file.displayName || file.short_name || file.name} size={file.size} id={file.id} selected={selectedDebridFiles().has(file.id)} onToggle={() => toggleDebridFileSelection(file.id)} />}
                                                            </For>
                                                        </Show>
                                                    </div>
                                                </Show>
                                            </Show>
                                        </div>
                                    </div>
                                </>
                            );
                        })()
                        }
                    </Show >
                </>
            );
        };

        return (
            <Modal {...props} onClose={destroy} onConfirm={handleStartDownload} disabledConfirm={loading} maxWidth="3xl">
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
