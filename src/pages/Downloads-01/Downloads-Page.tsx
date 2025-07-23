import { Component, createEffect, createMemo, createSignal, For, JSX, onCleanup, onMount, Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import { makePersisted } from "@solid-primitives/storage";
import { message } from "@tauri-apps/plugin-dialog";
import { DownloadedGame, File, Status, TaskStatus, DirectLink, commands } from "../../bindings";
import { TorrentApi } from "../../api/bittorrent/api";
import { DdlJobEntry, DownloadManagerApi, JobId } from "../../api/download/api";
import { LibraryApi } from "../../api/library/api";
import {
    Trash2, Pause, Play, Check, Download as DownloadIcon,
    Upload, HardDrive, ArrowDown, ArrowUp,
    CloudDownload,
    Gamepad2,
    Settings,
    Magnet,
    DownloadCloud,
    ChevronUp,
    ChevronDown,
    Folder,
    Filter,
    Clock,
    Zap,
    Activity,
    CheckCircle,
    Gauge
} from "lucide-solid";
import Button from "../../components/UI/Button/Button";
import { useNavigate } from "@solidjs/router";
import { InstallationApi } from "../../api/installation/api";
import { formatBytes, formatSpeed, toNumber } from "../../helpers/format";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { createStore, reconcile } from "solid-js/store";

const torrentApi = new TorrentApi();
const libraryApi = new LibraryApi();

// Unified download item type
type DownloadItem =
    | { type: 'torrent', game: DownloadedGame; status?: Status; gid: string; }
    | { type: 'ddl', job: DdlJobEntry; statuses: Status[]; jobId: string };

const DownloadPage: Component = () => {
    const navigate = useNavigate();
    const [downloadItems, setDownloadItems] = createStore<DownloadItem[]>([]);
    const [expandedStates, setExpandedStates] = createSignal<Record<string, boolean>>({});
    const [installationsInProgress, setInstallationsInProgress] = createSignal<Set<string>>(new Set());
    const toggleExpand = (id: string) => {
        setExpandedStates(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };
    const [processedJobs, setProcessedJobs] = createSignal<Set<string>>(new Set());
    const [activeFilter, setActiveFilter] = createSignal<"all" | "torrent" | "ddl" | "active">("all");

    const filteredItems = createMemo(() => {
        const items = downloadItems;
        const filter = activeFilter();
        return items.filter(item => {
            if (filter === "all") return true;
            if (filter === "torrent") return item.type === "torrent";
            if (filter === "ddl") return item.type === "ddl";
            if (filter === "active") {
                if (item.type === "torrent") {
                    return item.status?.status === "active";
                } else {
                    return item.statuses.some(s => s.status === "active");
                }
            }
            return true;
        });
    });

    const deleteAllDownloads = async () => {
        try {
            await torrentApi.removeAllTorrents({ force: true });
        } catch (error) {
            console.error("Error removing torrents:", error);
        }

        const ddlJobs = DownloadManagerApi.getAllJobs();
        for (const [jobId] of ddlJobs) {
            try {
                DownloadManagerApi.removeJob(jobId);
            } catch (error) {
                console.error(`Error removing job ${jobId}:`, error);
            }
        }

        setDownloadItems(reconcile([]));
        setProcessedJobs(new Set(""));
        setInstallationsInProgress(new Set(""));
        await refreshDownloads();
    };



    // Aggregate download stats
    const downloadStats = createMemo(() => {
        let totalDownloadSpeed = 0;
        let totalUploadSpeed = 0;
        let activeCount = 0;
        let torrentCount = 0;
        let ddlCount = 0;

        for (const item of downloadItems) {
            if (item.type === 'torrent' && item.status) {
                totalDownloadSpeed += toNumber(item.status.downloadSpeed);
                totalUploadSpeed += toNumber(item.status.uploadSpeed);
                if (item.status.status === "active") activeCount++;
                torrentCount++;
            }
            if (item.type === 'ddl') {
                for (const status of item.statuses) {
                    totalDownloadSpeed += toNumber(status.downloadSpeed);
                    totalUploadSpeed += toNumber(status.uploadSpeed);
                    if (status.status === "active") activeCount++;
                }
                ddlCount++;
            }
        }

        return { activeCount, torrentCount, ddlCount, totalDownloadSpeed, totalUploadSpeed };
    });

    function getItemKey(item: DownloadItem): string {
        return item.type === 'torrent' ? `torrent:${item.gid}` : `ddl:${item.jobId}`;
    }


    async function refreshDownloads() {
        await Promise.all([
            torrentApi.loadGameListFromDisk(),
            DownloadManagerApi.loadJobMapFromDisk(),
        ]);

        const [activeRes, waitingRes] = await Promise.all([
            torrentApi.getTorrentListActive(),
            torrentApi.getTorrentListWaiting()
        ]);

        const torrentStatusMap = new Map<string, Status>();
        if (activeRes.status === "ok") activeRes.data.forEach(s => torrentStatusMap.set(s.gid, s));
        if (waitingRes.status === "ok") waitingRes.data.forEach(s => torrentStatusMap.set(s.gid, s));

        const ddlJobs = DownloadManagerApi.getAllJobs();
        const ddlStatusPromises = Array.from(ddlJobs)
            .map(async ([jobId, job]) => {
                const statusPromises = job.gids.map(gid => commands.aria2GetStatus(gid));
                const results = await Promise.all(statusPromises);
                return {
                    jobId,
                    statuses: results.filter(r => r.status === "ok").map(r => r.data)
                };
            });

        const ddlStatusResults = await Promise.all(ddlStatusPromises);
        const ddlStatuses = new Map<JobId, Status[]>();
        ddlStatusResults.forEach(({ jobId, statuses }) => ddlStatuses.set(jobId, statuses));

        const newItems: DownloadItem[] = [];

        for (const [gid, games] of torrentApi.gameList.entries()) {
            const status = torrentStatusMap.get(gid);
            for (const game of games) {
                newItems.push({ type: 'torrent', game, status, gid });
            }
        }

        for (const [jobId, job] of ddlJobs) {
            newItems.push({
                type: 'ddl',
                job,
                statuses: ddlStatuses.get(jobId) || [],
                jobId
            });
        }

        const reconciledItems = newItems.map(item => ({
            ...item,
            reconcileKey: getItemKey(item)
        }));

        setDownloadItems(reconcile(reconciledItems, { key: "reconcileKey" }));
    }




    async function checkFinishedDownloads() {
        const items = [...downloadItems];
        const installationApi = new InstallationApi();
        const currentInstallations = installationsInProgress();

        for (const item of items) {
            if (item.type === 'torrent' && item.status?.status === "complete") {
                const key = `torrent:${item.gid}`;
                if (currentInstallations.has(key)) continue;

                setInstallationsInProgress(prev => new Set(prev).add(key));

                const fullPath = item.status.files?.[0]?.path;
                if (fullPath) {
                    const folderPath = fullPath.split(/[\\/]/).slice(0, -1).join("/");

                    await libraryApi.addDownloadedGame(item.game);
                    torrentApi.gameList.delete(item.gid);
                    await torrentApi.saveGameListToDisk();

                    installationApi.startInstallation(folderPath)
                        .finally(() => {
                            setInstallationsInProgress(prev => {
                                const newSet = new Set(prev);
                                newSet.delete(key);
                                return newSet;
                            });
                        })
                        .catch(console.error);
                }
            }
            else if (item.type === 'ddl') {
                if (item.statuses.length === 0) continue;

                const allComplete = item.statuses.every(s =>
                    s.status === "complete" && s.completedLength === s.totalLength
                );


                if (allComplete) {
                    const key = `ddl:${item.jobId}`;
                    if (currentInstallations.has(key) || processedJobs().has(key)) continue;

                    setProcessedJobs(prev => new Set(prev).add(key));
                    setInstallationsInProgress(prev => new Set(prev).add(key));

                    await libraryApi.addDownloadedGame(item.job.downloadedGame);
                    const targetPath = item.job.targetPath;

                    installationApi.startExtractionDdl(targetPath)
                        .then(async () => {
                            DownloadManagerApi.removeJob(item.jobId);
                            await DownloadManagerApi.saveJobMapToDisk();
                            installationApi.startInstallation(targetPath);
                        })
                        .catch(console.error)
                        .finally(() => {
                            setInstallationsInProgress(prev => {
                                const newSet = new Set(prev);
                                newSet.delete(key);
                                return newSet;
                            });
                        });
                }
            }
        }
    }



    onMount(async () => {
        await Promise.all([
            torrentApi.loadGameListFromDisk(),
            DownloadManagerApi.loadJobMapFromDisk(),
            torrentApi.loadUninstalledFromDisk()
        ]);

        await refreshDownloads();

        const intervalId = setInterval(() => {
            refreshDownloads();
            checkFinishedDownloads();
        }, 2000);

        onCleanup(() => clearInterval(intervalId));
    });


    const StatPill = (props: {
        icon: JSX.Element;
        label: string;
        value: string;
        color: "blue" | "green" | "amber" | "purple" | "red" | "cyan";
        glow?: boolean;
    }) => {
        const colorClasses = {
            blue: "bg-blue-500/10 text-blue-400 border-blue-400/20",
            green: "bg-emerald-500/10 text-emerald-400 border-emerald-400/20",
            amber: "bg-amber-500/10 text-amber-400 border-amber-400/20",
            purple: "bg-purple-500/10 text-purple-400 border-purple-400/20",
            red: "bg-red-500/10 text-red-400 border-red-400/20",
            cyan: "bg-cyan-500/10 text-cyan-400 border-cyan-400/20"
        };

        return (
            <div class={`
            flex items-center gap-3 px-6 py-3 rounded-xl 
            border ${colorClasses[props.color]}
            bg-popup/80 backdrop-blur-sm
            transition-all hover:scale-[1.02] hover:shadow-lg
            ${props.glow ? `shadow-${props.color}-400/10 hover:shadow-${props.color}-400/20` : ''}
            relative overflow-hidden
        `}>
                {/* Animated background effect */}
                <div class={`
                absolute inset-0 -z-10 opacity-10
                ${props.glow ? `bg-gradient-to-br from-${props.color}-400 to-transparent` : ''}
                group-hover:opacity-20 transition-opacity
            `}></div>

                <div class={`p-2 rounded-lg ${colorClasses[props.color]} backdrop-blur-sm`}>
                    {props.icon}
                </div>
                <div class="flex flex-col">
                    <span class="text-xs uppercase tracking-wider text-muted/80">{props.label}</span>
                    <span class="font-bold text-lg">{props.value}</span>
                </div>
            </div>
        );
    };

    return (
        <div class="min-h-screen bg-gradient-to-br from-background to-background-950 p-4 w-full">
            {/* Header Section */}
            <div class="max-w-[1800px] mx-auto mb-8">
                <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                    <h1 class="text-3xl font-bold flex items-center gap-3">
                        <div class="p-2 rounded-xl bg-accent/10 border border-accent/20 backdrop-blur-sm">
                            <CloudDownload class="w-6 h-6 text-accent animate-pulse" />
                        </div>
                        <span class="bg-gradient-to-r from-accent via-primary to-secondary   bg-clip-text text-transparent">
                            DOWNLOAD MANAGER
                        </span>
                    </h1>

                    {/* Glowing Filter Tabs */}
                    <div class="flex flex-wrap gap-3 w-full md:w-auto items-center">
                        {/* Filter Buttons */}
                        <button
                            onClick={() => setActiveFilter("all")}
                            class={`
                px-5 py-2.5 rounded-full text-sm font-bold flex items-center gap-2 
                ${activeFilter() === "all"
                                    ? "bg-primary/20 border-primary/50 text-primary"
                                    : "bg-secondary-20/10 hover:bg-secondary-20/20 border-secondary-20/30"}
                border transition-all
                shadow-secondary-20/10 hover:shadow-secondary-20/20
                group
              `}
                        >
                            <Filter class="w-5 h-5 opacity-70" />
                            <span>All</span>
                        </button>

                        <button
                            onClick={() => setActiveFilter("torrent")}
                            class={`
                px-5 py-2.5 rounded-full text-sm font-bold flex items-center gap-2 
                ${activeFilter() === "torrent"
                                    ? "bg-blue-500/20 border-blue-500/50 text-blue-400"
                                    : "bg-blue-500/10 hover:bg-blue-500/20 border-blue-400/30"}
                border transition-all
                shadow-blue-400/10 hover:shadow-blue-400/20
                group
              `}
                        >
                            <Magnet class="w-5 h-5 text-blue-400 group-hover:animate-pulse" />
                            <span>Torrents</span>
                            <span class="px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold">
                                {downloadStats().torrentCount}
                            </span>
                        </button>

                        <button
                            onClick={() => setActiveFilter("ddl")}
                            class={`
                px-5 py-2.5 rounded-full text-sm font-bold flex items-center gap-2 
                ${activeFilter() === "ddl"
                                    ? "bg-green-500/20 border-green-500/50 text-green-400"
                                    : "bg-green-500/10 hover:bg-green-500/20 border-green-400/30"}
                border transition-all
                shadow-green-400/10 hover:shadow-green-400/20
                group
              `}
                        >
                            <DownloadCloud class="w-5 h-5 text-green-400 group-hover:animate-bounce" />
                            <span>Direct</span>
                            <span class="px-2.5 py-1 rounded-full bg-green-500/20 text-green-300 text-xs font-bold">
                                {downloadStats().ddlCount}
                            </span>
                        </button>

                        <button
                            onClick={() => setActiveFilter("active")}
                            class={`
                px-5 py-2.5 rounded-full text-sm font-bold flex items-center gap-2 
                ${activeFilter() === "active"
                                    ? "bg-amber-500/20 border-amber-500/50 text-amber-400"
                                    : "bg-amber-500/10 hover:bg-amber-500/20 border-amber-400/30"}
                border transition-all
                shadow-amber-400/10 hover:shadow-amber-400/20
                group
              `}
                        >
                            <Zap class="w-5 h-5 text-amber-400 group-hover:animate-pulse" />
                            <span>Active</span>
                            <span class="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold">
                                {downloadStats().activeCount}
                            </span>
                        </button>

                        {/* Delete All Button */}
                        <button
                            onClick={deleteAllDownloads}
                            class={`
                px-5 py-2.5 rounded-full text-sm font-bold flex items-center gap-2 
                bg-red-500/10 hover:bg-red-500/20 transition-all
                border border-red-400/30 hover:border-red-400/50
                shadow-red-400/10 hover:shadow-red-400/20
                group
                ${filteredItems().length === 0 ? "opacity-50 cursor-not-allowed" : ""}
              `}
                            disabled={filteredItems().length === 0}
                        >
                            <Trash2 class="w-5 h-5 text-red-400 group-hover:animate-pulse" />
                            <span>Delete All</span>
                        </button>
                    </div>
                </div>

                {/* Animated Stats Pills */}
                <div class="flex gap-4 overflow-x-auto p-4 mb-8 no-scrollbar">
                    <StatPill
                        icon={<ArrowDown class="w-5 h-5" />}
                        label="Download Speed"
                        value={formatSpeed(downloadStats().totalDownloadSpeed)}
                        color="cyan"
                        glow
                    />

                    <StatPill
                        icon={<ArrowUp class="w-5 h-5" />}
                        label="Upload Speed"
                        value={formatSpeed(downloadStats().totalUploadSpeed)}
                        color="purple"
                        glow
                    />

                    <StatPill
                        icon={<Activity class="w-5 h-5" />}
                        label="Active Transfers"
                        value={downloadStats().activeCount.toString()}
                        color="amber"
                    />

                    {/* <StatPill
                        icon={<Gauge class="w-5 h-5" />}
                        label="Peak Speed"
                        value={formatSpeed(downloadStats().totalDownloadSpeed * 1.5)} // not true way but too lazy to impl rn
                        color="red"
                    /> */}

                    {/* <StatPill
                        icon={<HardDrive class="w-5 h-5" />}
                        label="Total Data"
                        value={formatBytes(downloadStats().totalSize)}
                        color="green"
                    /> */}
                </div>
            </div>

            {/* Main Content */}
            <div class="max-w-[1800px] mx-auto">
                {downloadItems.length > 0 ? (
                    <div class="grid grid-cols-1 gap-5">
                        <For each={filteredItems()}>
                            {(item, index) => (
                                <div class="bg-popup/80 backdrop-blur-sm rounded-2xl border border-secondary-20/50 hover:border-accent/50 transition-all hover:shadow-xl hover:shadow-accent/10 overflow-hidden">
                                    <DownloadingGameItem
                                        item={downloadItems[index()]}
                                        isExpanded={!!expandedStates()[getItemKey(item)]}
                                        onToggleExpand={() => toggleExpand(getItemKey(item))}
                                        formatSpeed={formatSpeed}
                                        refreshDownloads={refreshDownloads}
                                    />
                                </div>
                            )}
                        </For>
                    </div>
                ) : (
                    <div class={`
                    flex flex-col items-center justify-center py-24 text-center 
                    bg-popup/30 backdrop-blur-sm rounded-3xl 
                    border-2 border-dashed border-accent/30 hover:border-accent/50
                    transition-all hover:shadow-lg hover:shadow-accent/10
                `}>
                        <div class="relative mb-8">
                            <div class="absolute inset-0 bg-accent/10 rounded-full animate-ping opacity-20"></div>
                            <DownloadIcon class="w-20 h-20 text-accent animate-bounce" />
                        </div>
                        <h3 class="text-3xl font-bold mb-3 bg-gradient-to-r from-text to-primary bg-clip-text text-transparent">
                            Ready for Downloads!
                        </h3>
                        <p class="text-muted/80 max-w-md mb-8 text-lg">
                            Your download queue is empty. Let's find some awesome games!
                        </p>
                        <Button
                            label="Explore Game Library"
                            icon={<Gamepad2 class="w-6 h-6" />}
                            onClick={() => navigate('/discovery-page')}
                            class="text-lg py-3 px-6 hover:scale-105 transition-transform"
                            variant="glass"
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

function DownloadingGameItem(props: {
    item: DownloadItem;
    isExpanded: boolean;
    onToggleExpand: () => void;
    formatSpeed: (bytes?: number) => string;
    refreshDownloads: () => Promise<void>;
}) {
    const game = () => props.item.type === 'torrent' ? props.item.game : props.item.job.downloadedGame;

    // Reactive properties
    const status = () => props.item.type === 'torrent' ? props.item.status : undefined;
    const statuses = () => props.item.type === 'ddl' ? props.item.statuses : [];

    const aggregatedStatus = () => {
        if (props.item.type === "torrent") {
            return status();
        }

        let totalLength = 0;
        let completedLength = 0;
        let downloadSpeed = 0;
        let uploadSpeed = 0;
        let allComplete = true;
        let anyActive = false;


        for (const s of statuses()) {
            totalLength += toNumber(s.totalLength);
            completedLength += toNumber(s.completedLength);
            downloadSpeed += toNumber(s.downloadSpeed);
            uploadSpeed += toNumber(s.uploadSpeed);

            if (s.status !== "complete" || s.completedLength !== s.totalLength) {
                allComplete = false;
            }

            if (s.status === "active") anyActive = true;
        }

        return {
            status: allComplete ? "complete" : anyActive ? "active" : "waiting",
            totalLength,
            completedLength,
            downloadSpeed,
            uploadSpeed
        };
    };

    const files = () => {
        if (props.item.type === 'torrent') {
            return status()?.files || [];
        }
        return statuses().flatMap(s => s.files || []);
    };

    const progress = () => {
        const status = aggregatedStatus();
        if (!status) return "0%";

        const total = status.totalLength;
        const completed = status.completedLength;

        return total > 0 ? `${((completed / total) * 100).toFixed(1)}%` : "0%";
    };

    const numberProgress = () => {
        const status = aggregatedStatus();
        if (!status) return 0;
        return status.totalLength > 0
            ? Math.floor((status.completedLength / status.totalLength) * 100)
            : 0;
    };

    const getFileNameFromPath = (path: string): string => path.split(/[\\/]/).pop() || path;

    return (
        <div class="bg-popup rounded-xl border border-secondary-20/60 hover:border-accent/40 transition-all overflow-hidden group">
            <div class="flex flex-col md:flex-row h-full">
                {/* Game Info Section */}
                <div class="flex items-center p-4 md:w-1/3 md:border-r border-secondary-20/50 relative">
                    <div class={`absolute top-1.5 left-4 px-2 py-1 rounded-md text-xs font-medium tracking-wide ${props.item.type === 'torrent'
                        ? 'bg-blue-500/10 text-blue-400 border border-blue-500/70'
                        : 'bg-purple-500/10 text-purple-400 border border-purple-500/70'
                        }`}>
                        {props.item.type === 'torrent' ? 'TORRENT' : 'DIRECT'}
                    </div>

                    <img
                        src={game().img}
                        alt={game().title}
                        class="w-16 h-16 rounded-lg object-cover mt-5 mr-4 border border-secondary-20/30 group-hover:border-accent/30 transition-colors"
                    />
                    <div class="flex-1 min-w-0 mt-5">
                        <h3 class="font-medium line-clamp-2 text-text group-hover:text-primary transition-colors">
                            {game().title}
                        </h3>
                        <div class="flex items-center gap-2 mt-1 text-sm text-muted/80">
                            <HardDrive class="w-4 h-4 opacity-70" />
                            <span>{formatBytes(aggregatedStatus()?.totalLength)}</span>
                        </div>
                    </div>
                </div>

                {/* Download Stats Section */}
                <div class="flex-1 flex flex-col">
                    <div class="flex flex-col h-full sm:flex-row items-center gap-4 p-4">
                        <div class="flex gap-4 sm:gap-6">
                            <div class="flex items-center gap-2 min-w-[100px]">
                                <div class="p-1.5 rounded-md bg-green-500/10">
                                    <ArrowDown class="w-4 h-4 text-green-400" />
                                </div>
                                <div class="text-sm">
                                    <p class="text-xs text-muted/80">DOWNLOAD</p>
                                    <p class="font-medium text-text">
                                        {props.formatSpeed(aggregatedStatus()?.downloadSpeed)}
                                    </p>
                                </div>
                            </div>
                            <div class="flex items-center gap-2 min-w-[100px]">
                                <div class="p-1.5 rounded-md bg-blue-500/10">
                                    <ArrowUp class="w-4 h-4 text-blue-400" />
                                </div>
                                <div class="text-sm">
                                    <p class="text-xs text-muted/80">UPLOAD</p>
                                    <p class="font-medium text-text">
                                        {props.formatSpeed(aggregatedStatus()?.uploadSpeed)}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Progress Bar */}
                        <div class="flex-1 min-w-0 w-full">
                            <div class="flex justify-between text-xs text-muted/80 mb-1.5">
                                <span class="capitalize">
                                    {aggregatedStatus()?.status === "complete"
                                        ? "Completed"
                                        : aggregatedStatus()
                                            ? "Downloading..."
                                            : "Waiting..."}
                                </span>
                                <span class="font-medium text-text">{numberProgress()}%</span>
                            </div>
                            <div class="w-full h-2 bg-secondary-20/30 rounded-full overflow-hidden">
                                <div
                                    class="h-full bg-gradient-to-r from-accent to-primary/80 transition-all duration-500 ease-out"
                                    style={{ width: progress() }}
                                />
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div class="flex items-center gap-2 ml-auto">
                            <DownloadActionButton
                                item={props.item}
                                status={aggregatedStatus()}
                                refreshDownloads={props.refreshDownloads}
                            />
                            <Button
                                variant="glass"
                                size="sm"
                                onClick={props.onToggleExpand}
                                icon={
                                    props.isExpanded ? (
                                        <ChevronUp class="w-4 h-4" />
                                    ) : (
                                        <ChevronDown class="w-4 h-4" />
                                    )
                                }
                                class="hover:bg-secondary-20/30"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Expanded Files Section */}
            <Show when={files().length > 0}>
                <div class={`overflow-scroll no-scrollbar transition-all duration-300 ease-in-out ${props.isExpanded ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
                    }`}>
                    <div class="border-t border-secondary-20/30 p-4 space-y-3">
                        <h4 class="text-sm font-medium text-muted/80 flex items-center gap-2">
                            <Folder class="w-4 h-4" />
                            Downloading Files
                        </h4>
                        <div class="space-y-2">
                            <For each={files()}>
                                {(file) => (
                                    <div class="bg-secondary-10/50 hover:bg-secondary-20/30 rounded-lg p-3 transition-colors">
                                        <div class="flex justify-between text-xs mb-1.5">
                                            <span class="truncate max-w-[200px] sm:max-w-md font-medium text-text">
                                                {getFileNameFromPath(file.path)}
                                            </span>
                                            <span class="text-muted/80">
                                                {((file.completedLength / file.length) * 100).toFixed(1) || 100}%
                                            </span>
                                        </div>
                                        <div class="w-full h-1.5 bg-secondary-20/30 rounded-full overflow-hidden">
                                            <div
                                                class="h-full bg-accent/80 transition-all duration-500 ease-out"
                                                style={{ width: `${(file.completedLength / file.length) * 100}%` }}
                                            />
                                        </div>
                                        <div class="flex justify-between text-xs text-muted/80 mt-1">
                                            <span>{formatBytes(file.completedLength)}</span>
                                            <span>{formatBytes(file.length)}</span>
                                        </div>
                                    </div>
                                )}
                            </For>
                        </div>
                    </div>
                </div>
            </Show>
        </div>
    );
}



function DownloadActionButton(props: { item: DownloadItem; status?: any; refreshDownloads: () => Promise<void>; }) {
    const [buttonState, setButtonState] = createSignal<
        "pause" | "resume" | "install" | "uploading"
    >("pause");

    const installationApi = new InstallationApi();

    createEffect(() => {
        if (!props.status) return setButtonState("resume");

        if (props.item.type === 'ddl') {
            if (props.item.statuses.length === 0) return setButtonState("resume");
            const allComplete = props.item.statuses.every(s =>
                s.status === "complete" && s.completedLength === s.totalLength
            );

            if (allComplete) {
                setButtonState("install");
                return;
            }
        }

        const isUploading = props.status.status === "active" &&
            props.status.completedLength === props.status.totalLength;
        const isComplete = props.status.status === "complete" ||
            (props.status.completedLength === props.status.totalLength);

        if (isComplete) {
            setButtonState("install");
        } else if (isUploading) {
            setButtonState("uploading");
        } else {
            switch (props.status.status) {
                case "paused":
                case "waiting":
                    setButtonState("resume");
                    break;
                case "active":
                    setButtonState("pause");
                    break;
                default:
                    setButtonState("resume");
            }
        }
    });

    async function removeDownload() {
        if (props.item.type === "torrent") {
            await torrentApi.removeTorrent(props.item.gid);
        } else {
            DownloadManagerApi.removeJob(props.item.jobId);
            await DownloadManagerApi.saveJobMapToDisk();
        }
    }

    async function toggle() {
        try {
            const state = buttonState();

            if (props.item.type === 'torrent') {
                const gid = props.item.gid;
                if (!gid) return;

                switch (state) {
                    case "resume":
                        await torrentApi.resumeTorrent(gid);
                        break;
                    case "pause":
                    case "uploading":
                        await torrentApi.pauseTorrent(gid);
                        break;
                    case "install":
                        const fullPath = props.status.files?.[0]?.path;
                        if (fullPath) {
                            const folderPath = fullPath.split(/[\\/]/).slice(0, -1).join("/");
                            await installationApi.startInstallation(folderPath);
                        }
                        break;
                }
            } else {
                const jobId = props.item.jobId;
                switch (state) {
                    case "resume":
                        if (props.item.statuses.length > 0) {
                            await DownloadManagerApi.unpauseJob(jobId);
                        } else {
                            await DownloadManagerApi.resumeJob(jobId)
                        }

                        break;
                    case "pause":
                    case "uploading":
                        await DownloadManagerApi.pauseJob(jobId);
                        break;
                    case "install":
                        const firstFilePath = props.item.statuses?.[0]?.files?.[0]?.path;
                        if (firstFilePath) {
                            await installationApi.startExtractionDdl(firstFilePath);
                        }
                        break;
                }
            }
        } finally {
            await props.refreshDownloads();
        }
    }


    const label = () => {
        switch (buttonState()) {
            case "uploading": return "UPLOADING";
            case "install": return "INSTALL";
            default: return buttonState().toUpperCase();
        }
    };

    const icon = () => {
        switch (buttonState()) {
            case "pause":
            case "uploading": return <Pause class="w-5 h-5" />;
            case "install": return <Settings class="w-5 h-5" />;
            default: return <Play class="w-5 h-5" />;
        }
    };

    return (
        <>
            <Button
                variant="bordered"
                onClick={toggle}
                label={label()}
                icon={icon()}
            />
            <Button
                variant="bordered"
                onClick={removeDownload}
                icon={<Trash2 class="w-5 h-5 text-red-400" />}
                class="hover:bg-red-500/10 !border-red-400/30 !hover:border-red-400/80"
            />
        </>
    );
}





export default DownloadPage;