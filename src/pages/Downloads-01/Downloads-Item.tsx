import { Component, createMemo, createSignal, For, Show } from "solid-js";
import { HardDrive, ArrowDown, ArrowUp, ChevronUp, ChevronDown, Folder, Pause, Play, Settings, Trash2 } from "lucide-solid";
import Button from "../../components/UI/Button/Button";
import { InstallationApi } from "../../api/installation/api";
import { formatBytes, formatSpeed, toNumber } from "../../helpers/format";
import { DownloadItem as DI } from "./Downloads-Page";
import { DownloadManagerApi } from "../../api/download/api";
import { TorrentApi } from "../../api/bittorrent/api";

const torrentApi = new TorrentApi();
const installationApi = new InstallationApi();

const DownloadItem: Component<{
    item: DI;
    isExpanded: boolean;
    onToggleExpand: () => void;
    refreshDownloads: () => Promise<void>;
}> = (props) => {
    const game = () => (props.item.type === "torrent" ? props.item.game : props.item.job.downloadedGame);

    const statuses = () => (props.item.type === "ddl" ? props.item.statuses : []);
    const status = () => (props.item.type === "torrent" ? props.item.status : undefined);

    const aggregatedStatus = createMemo(() => {
        if (props.item.type === "torrent") return status();
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
            if (s.status !== "complete" || s.completedLength !== s.totalLength) allComplete = false;
            if (s.status === "active") anyActive = true;
        }
        return { status: allComplete ? "complete" : anyActive ? "active" : "waiting", totalLength, completedLength, downloadSpeed, uploadSpeed, files: statuses().flatMap((s) => s.files || []) as any[] };
    });

    const files = () => (props.item.type === "torrent" ? status()?.files || [] : aggregatedStatus()?.files || []);

    const progressPercent = () => {
        const agg = aggregatedStatus();
        if (!agg) return 0;
        const total = agg.totalLength ?? 0;
        const completed = agg.completedLength ?? 0;
        return total > 0 ? Math.floor((completed / total) * 100) : 0;
    };

    async function toggleAction() {
        if (props.item.type === "torrent") {
            const gid = props.item.gid;
            const st = status()?.status;
            if (!gid) return;
            try {
                if (st === "active") await torrentApi.pauseTorrent(gid);
                else await torrentApi.resumeTorrent(gid);
            } finally {
                await props.refreshDownloads();
            }
        } else {
            const jobId = props.item.jobId;
            const anyStatuses = props.item.statuses && props.item.statuses.length > 0;
            try {
                const someActive = props.item.statuses.some((s) => s.status === "active");
                if (someActive) await DownloadManagerApi.pauseJob(jobId);
                else {
                    if (anyStatuses) await DownloadManagerApi.unpauseJob(jobId);
                    else await DownloadManagerApi.resumeJob(jobId);
                }
            } finally {
                await props.refreshDownloads();
            }
        }
    }

    async function removeDownload() {
        try {
            if (props.item.type === "torrent") {
                await torrentApi.removeTorrent(props.item.gid);
            } else {
                await DownloadManagerApi.removeJob(props.item.jobId);
                await DownloadManagerApi.saveJobMapToDisk();
            }
        } finally {
            await props.refreshDownloads();
        }
    }

    async function installIfReady() {
        if (props.item.type === "torrent") {
            const fullPath = status()?.files?.[0]?.path;
            if (fullPath) {
                const folderPath = fullPath.split(/[\\/]/).slice(0, -1).join("/");
                await installationApi.startInstallation(folderPath);
            }
        } else {
            const targetPath = props.item.job.targetPath;
            if (targetPath) await installationApi.startExtractionDdl(targetPath);
        }
    }

    const actionLabel = createMemo(() => {
        const agg = aggregatedStatus();
        if (!agg) return "RESUME";
        const isComplete = agg.status === "complete" || agg.completedLength === agg.totalLength;
        const isUploading = agg.status === "active" && agg.completedLength === agg.totalLength;
        if (isComplete) return "INSTALL";
        if (isUploading) return "UPLOADING";
        if (agg.status === "active") return "PAUSE";
        return "RESUME";
    });

    const actionIcon = createMemo(() => {
        const lbl = actionLabel();
        if (lbl === "PAUSE" || lbl === "UPLOADING") return <Pause class="w-5 h-5" />;
        if (lbl === "INSTALL") return <Settings class="w-5 h-5" />;
        return <Play class="w-5 h-5" />;
    });

    const getFileNameFromPath = (path: string) => path.split(/[\\/]/).pop() || path;

    return (
        <div class="bg-popup rounded-xl border border-secondary-20/60 hover:border-accent/40 transition-all overflow-hidden group">
            <div class="flex flex-col md:flex-row h-full">
                <div class="flex items-center p-4 md:w-1/3 md:border-r border-secondary-20/50 relative">
                    <div class={`absolute top-1.5 left-4 px-2 py-1 rounded-md text-xs font-medium tracking-wide ${props.item.type === "torrent" ? "bg-blue-500/10 text-blue-400 border border-blue-500/70" : "bg-purple-500/10 text-purple-400 border border-purple-500/70"}`}>
                        {props.item.type === "torrent" ? "TORRENT" : "DIRECT"}
                    </div>

                    <img src={game().img} alt={game().title} class="w-16 h-16 rounded-lg object-cover mt-5 mr-4 border border-secondary-20/30 group-hover:border-accent/30 transition-colors" />
                    <div class="flex-1 min-w-0 mt-5">
                        <h3 class="font-medium line-clamp-2 text-text group-hover:text-primary transition-colors">{game().title}</h3>
                        <div class="flex items-center gap-2 mt-1 text-sm text-muted/80">
                            <HardDrive class="w-4 h-4 opacity-70" />
                            <span>{formatBytes(aggregatedStatus()?.totalLength)}</span>
                        </div>
                    </div>
                </div>

                <div class="flex-1 flex flex-col">
                    <div class="flex flex-col h-full sm:flex-row items-center gap-4 p-4">
                        <div class="flex gap-4 sm:gap-6">
                            <div class="flex items-center gap-2 min-w-[100px]">
                                <div class="p-1.5 rounded-md bg-green-500/10">
                                    <ArrowDown class="w-4 h-4 text-green-400" />
                                </div>
                                <div class="text-sm">
                                    <p class="text-xs text-muted/80">DOWNLOAD</p>
                                    <p class="font-medium text-text">{formatSpeed(aggregatedStatus()?.downloadSpeed)}</p>
                                </div>
                            </div>

                            <div class="flex items-center gap-2 min-w-[100px]">
                                <div class="p-1.5 rounded-md bg-blue-500/10">
                                    <ArrowUp class="w-4 h-4 text-blue-400" />
                                </div>
                                <div class="text-sm">
                                    <p class="text-xs text-muted/80">UPLOAD</p>
                                    <p class="font-medium text-text">{formatSpeed(aggregatedStatus()?.uploadSpeed)}</p>
                                </div>
                            </div>
                        </div>

                        <div class="flex-1 min-w-0 w-full">
                            <div class="flex justify-between text-xs text-muted/80 mb-1.5">
                                <span class="capitalize">{aggregatedStatus()?.status === "complete" ? "Completed" : aggregatedStatus() ? "Downloading..." : "Waiting..."}</span>
                                <span class="font-medium text-text">{progressPercent()}%</span>
                            </div>
                            <div class="w-full h-2 bg-secondary-20/30 rounded-full overflow-hidden">
                                <div class="h-full bg-gradient-to-r from-accent to-primary/80 transition-all duration-500 ease-out" style={{ width: `${progressPercent()}%` }} />
                            </div>
                        </div>

                        <div class="flex items-center gap-2 ml-auto">
                            <Button variant="bordered" onClick={() => {
                                if (actionLabel() === "INSTALL") installIfReady();
                                else toggleAction();
                            }} label={actionLabel()} icon={actionIcon()} />
                            <Button variant="glass" size="sm" onClick={() => props.onToggleExpand()} icon={props.isExpanded ? <ChevronUp class="w-4 h-4" /> : <ChevronDown class="w-4 h-4" />} class="hover:bg-secondary-20/30" />
                            <Button variant="bordered" onClick={removeDownload} icon={<Trash2 class="w-5 h-5 text-red-400" />} class="hover:bg-red-500/10 !border-red-400/30 !hover:border-red-400/80" />
                        </div>
                    </div>
                </div>
            </div>

            <Show when={files().length > 0}>
                <div class={`overflow-scroll no-scrollbar transition-all duration-300 ease-in-out ${props.isExpanded ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"}`}>
                    <div class="border-t border-secondary-20/30 p-4 space-y-3">
                        <h4 class="text-sm font-medium text-muted/80 flex items-center gap-2">
                            <Folder class="w-4 h-4" />
                            Downloading Files
                        </h4>

                        <div class="space-y-2">
                            <For each={files()}>
                                {(file) => {
                                    const progress = () => {
                                        const completed = file.completedLength;
                                        const total = file.length;
                                        if (isNaN(completed) || isNaN(total) || total <= 0) return 0;
                                        return Math.min(100, (completed / total) * 100);
                                    };

                                    return (
                                        <div class="bg-secondary-10/50 hover:bg-secondary-20/30 rounded-lg p-3 transition-colors">
                                            <div class="flex justify-between text-xs mb-1.5">
                                                <span class="truncate max-w-[200px] sm:max-w-md font-medium text-text">{getFileNameFromPath(file.path)}</span>
                                                <span class="text-muted/80">{progress().toFixed(1) || 0}%</span>
                                            </div>
                                            <div class="w-full h-1.5 bg-secondary-20/30 rounded-full overflow-hidden">
                                                <div class="h-full bg-accent/80 transition-all duration-500 ease-out" style={{ width: `${progress()}%` }} />
                                            </div>
                                            <div class="flex justify-between text-xs text-muted/80 mt-1">
                                                <span>{formatBytes(file.completedLength)}</span>
                                                <span>{formatBytes(file.length)}</span>
                                            </div>
                                        </div>
                                    );
                                }}
                            </For>
                        </div>
                    </div>
                </div>
            </Show>
        </div>
    );
};

export default DownloadItem;
