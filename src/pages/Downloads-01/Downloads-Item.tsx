// src/pages/Downloads-Item.tsx
import { Component, createMemo, createSignal, For, Show } from "solid-js";
import { HardDrive, ArrowDown, ArrowUp, ChevronUp, ChevronDown, Folder, Pause, Play, Settings, Trash2 } from "lucide-solid";
import Button from "../../components/UI/Button/Button";
import { InstallationApi } from "../../api/installation/api";
import { formatBytes, formatSpeed, toNumber } from "../../helpers/format";
import { DownloadJob, GlobalDownloadManager } from "../../api/manager/api";


const installationApi = new InstallationApi();

const DownloadItem: Component<{
    item: DownloadJob;
    isExpanded: boolean;
    onToggleExpand: () => void;
    refreshDownloads: () => Promise<void>;
}> = (props) => {
    const game = createMemo(() => props.item.game);

    const statuses = () => (props.item as any).statuses || (props.item as any).status ? (props.item as any).statuses || [(props.item as any).status] : [];
    const status = () => statuses()[0];

    const aggregatedStatus = createMemo(() => {
        if (!statuses() || statuses().length === 0) {
            return {
                status: props.item.state === "done" ? "complete" : props.item.state === "downloading" ? "active" : "paused",
                totalLength: 0,
                completedLength: 0,
                downloadSpeed: 0,
                uploadSpeed: 0,
                files: []
            };
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
            if (s.status !== "complete" || s.completedLength !== s.totalLength) allComplete = false;
            if (s.status === "active") anyActive = true;
        }
        return {
            status: allComplete ? "complete" : anyActive ? "active" : "paused",
            totalLength,
            completedLength,
            downloadSpeed,
            uploadSpeed,
            files: statuses().flatMap((s: any) => s.files || [])
        };
    });

    const files = createMemo(() => {
        if ((props.item as any).source === "torrent") {
            return status()?.files ?? [];
        }
        const agg = aggregatedStatus();
        return Array.isArray(agg?.files) ? agg.files : [];
    });

    const progressPercent = createMemo(() => {
        const agg = aggregatedStatus();
        if (!agg) return 0;
        const total = agg.totalLength ?? 0;
        const completed = agg.completedLength ?? 0;
        return total > 0 ? Math.floor((completed / total) * 100) : 0;
    });

    const [optimisticState, setOptimisticState] = createSignal<"active" | "paused" | "complete" | "installing" | null>(null);

    const effectiveStatus = createMemo(() => {
        if (optimisticState()) return optimisticState();
        const agg = aggregatedStatus();
        if (!agg) return null;
        if (agg.completedLength === agg.totalLength) return "complete";
        if (agg.status === "active") return "active";
        if (agg.status === "paused" || agg.status === "waiting") return "paused";
        return "paused";
    });

    const actionLabel = createMemo(() => {
        switch (effectiveStatus()) {
            case "complete": return "INSTALL";
            case "active": return "PAUSE";
            case "paused": return "RESUME";
            default: return "RESUME";
        }
    });

    async function toggleAction() {
        const current = effectiveStatus();
        if (current === "active") setOptimisticState("paused");
        if (current === "paused") setOptimisticState("active");
        try {
            const id = props.item.id;
            if (current === "active") {
                await GlobalDownloadManager.pause(id);
            } else {
                await GlobalDownloadManager.resume(id);
            }
        } catch (e) {
            setOptimisticState(current as any);
        } finally {
            await props.refreshDownloads();
            setOptimisticState(null);
        }
    }

    async function removeDownload() {
        try {
            await GlobalDownloadManager.remove(props.item.id);
        } finally {
            await props.refreshDownloads();
        }
    }

    async function installIfReady() {
        const targetPath = props.item.targetPath;
        if (targetPath) {
            if ((props.item as any).source === "torrent") await installationApi.startInstallation(targetPath);
            else await installationApi.startExtractionDdl(targetPath);
        }
    }

    const actionIcon = createMemo(() => {
        const lbl = actionLabel();
        if (lbl === "PAUSE") return <Pause class="w-5 h-5" />;
        if (lbl === "INSTALL") return <Settings class="w-5 h-5" />;
        return <Play class="w-5 h-5" />;
    });

    const getFileNameFromPath = (path: string) => path.split(/[\\/]/).pop() || path;

    return (
        <div class="bg-popup rounded-xl border border-secondary-20/60 hover:border-accent/40 transition-all overflow-hidden group">
            <div class="flex flex-col md:flex-row h-full">
                <div class="flex items-center p-4 md:w-1/3 md:border-r border-secondary-20/50 relative">
                    <div class={`absolute top-1.5 left-4 px-2 py-1 rounded-md text-xs font-medium tracking-wide ${(props.item as any).source === "torrent" ? "bg-blue-500/10 text-blue-400 border border-blue-500/70" : "bg-purple-500/10 text-purple-400 border border-purple-500/70"}`}>
                        {(props.item as any).source === "torrent" ? "TORRENT" : "DIRECT"}
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
                            <Button
                                variant="bordered"
                                onClick={() => {
                                    if (actionLabel() === "INSTALL") installIfReady();
                                    else toggleAction();
                                }}
                                label={actionLabel()}
                                icon={actionIcon()}
                            />
                            <Button
                                variant="glass"
                                size="sm"
                                onClick={() => props.onToggleExpand()}
                                icon={props.isExpanded ? <ChevronUp class="w-4 h-4" /> : <ChevronDown class="w-4 h-4" />}
                                class="hover:bg-secondary-20/30"
                            />
                            <Button
                                variant="bordered"
                                onClick={removeDownload}
                                icon={<Trash2 class="w-5 h-5 text-red-400" />}
                                class="hover:bg-red-500/10 !border-red-400/30 !hover:border-red-400/80"
                            />
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
                                                <span class="truncate max-w-[200px] sm:max-w-md font-medium text-text">
                                                    {file.path.split(/[\\/]/).pop() || file.path}
                                                </span>
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
