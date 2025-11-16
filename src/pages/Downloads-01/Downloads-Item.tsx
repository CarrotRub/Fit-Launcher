import { Component, createMemo, createSignal, For, Show } from "solid-js";
import {
    HardDrive,
    ArrowDown,
    ArrowUp,
    ChevronUp,
    ChevronDown,
    Folder,
    Pause,
    Play,
    Settings,
    Trash2,
} from "lucide-solid";
import Button from "../../components/UI/Button/Button";
import { InstallationApi } from "../../api/installation/api";
import { formatBytes, formatSpeed, toNumber } from "../../helpers/format";
import { DownloadJob, DownloadState, GlobalDownloadManager } from "../../api/manager/api";
import { downloadStore } from "../../stores/download";
import { File, Status } from "../../bindings";
import DownloadFiles from "./Download-Files";

const installationApi = new InstallationApi();

const DownloadItem: Component<{
    item: DownloadJob;
    refreshDownloads: () => Promise<void>;
}> = (props) => {
    const [filesExpanded, setFilesExpanded] = createSignal(false);
    const game = createMemo(() => props.item.game);

    // Direct status for torrent jobs
    const status = () => props.item.status;

    // Aggregate status for multi-GID direct downloads
    const aggregatedStatus = createMemo(() => {
        const gids = props.item.gids ?? [];
        const statuses = gids
            .map((gid) => downloadStore.jobs.find((j) => j.status?.gid === gid)?.status)
            .filter(Boolean) as Status[];

        if (props.item.source === "torrent") return props.item.status;

        if (!statuses.length)
            return {
                status: "waiting",
                totalLength: 0,
                completedLength: 0,
                downloadSpeed: 0,
                uploadSpeed: 0,
                files: [],
            };

        const totalLength = statuses.reduce((a, s) => a + toNumber(s.totalLength), 0);
        const completedLength = statuses.reduce((a, s) => a + toNumber(s.completedLength), 0);
        const downloadSpeed = statuses.reduce((a, s) => a + toNumber(s.downloadSpeed), 0);
        const uploadSpeed = statuses.reduce((a, s) => a + toNumber(s.uploadSpeed), 0);
        const files = statuses.flatMap((s) => s.files ?? []);

        const allComplete = statuses.every((s) => s.status === "complete");

        return {
            status: allComplete
                ? "complete"
                : statuses.some((s) => s.status === "active")
                    ? "active"
                    : statuses.some((s) => s.status === "paused")
                        ? "paused"
                        : "waiting",
            totalLength,
            completedLength,
            downloadSpeed,
            uploadSpeed,
            files,
        };
    });

    // Files to show
    const files = () => {
        if (props.item.source === "torrent") return status()?.files || [];
        return aggregatedStatus()?.files || [];
    };

    // Progress %
    const progressPercent = createMemo(() => {
        const agg = aggregatedStatus();
        if (!agg) return 0;
        const total = agg.totalLength ?? 0;
        const completed = agg.completedLength ?? 0;
        return total > 0 ? Math.floor((completed / total) * 100) : 0;
    });

    // Action label based on actual RPC state
    const actionLabel = createMemo(() => {
        const s = aggregatedStatus()?.status;
        switch (s) {
            case "complete":
                return "INSTALL";
            case "active":
                return "PAUSE";
            case "paused":
            case "waiting":
                return "RESUME";
            default:
                return "RESUME";
        }
    });

    // Icons based on action
    const actionIcon = createMemo(() => {
        const lbl = actionLabel();
        if (lbl === "PAUSE") return <Pause class="w-5 h-5" />;
        if (lbl === "INSTALL") return <Settings class="w-5 h-5" />;
        return <Play class="w-5 h-5" />;
    });

    // Handle pause/resume
    async function toggleAction() {
        const current = aggregatedStatus()?.status;

        try {
            const id = props.item.id;

            if (current === "active") {
                await GlobalDownloadManager.pause(id);
            } else {
                await GlobalDownloadManager.resume(id);
            }
        } finally {
            await props.refreshDownloads();
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
        if (!targetPath) return;

        if (props.item.source === "torrent")
            await installationApi.startInstallation(targetPath);
        else
            await installationApi.startExtractionDdl(targetPath);
    }

    return (
        <div class="bg-popup rounded-xl border border-secondary-20/60 hover:border-accent/40 transition-all overflow-hidden group">
            <div class="flex flex-col md:flex-row h-full">
                <div class="flex items-center p-4 md:w-1/3 md:border-r border-secondary-20/50 relative">
                    <div
                        class={`absolute top-1.5 left-4 px-2 py-1 rounded-md text-xs font-medium tracking-wide ${props.item.source === "torrent"
                            ? "bg-blue-500/10 text-blue-400 border border-blue-500/70"
                            : "bg-purple-500/10 text-purple-400 border border-purple-500/70"
                            }`}
                    >
                        {props.item.source === "torrent" ? "TORRENT" : "DIRECT"}
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

                <div class="flex-1 flex flex-col">
                    <div class="flex flex-col h-full sm:flex-row items-center gap-4 p-4">
                        {/* Speeds */}
                        <div class="flex gap-4 sm:gap-6">
                            <div class="flex items-center gap-2 min-w-[100px]">
                                <div class="p-1.5 rounded-md bg-green-500/10">
                                    <ArrowDown class="w-4 h-4 text-green-400" />
                                </div>
                                <div class="text-sm">
                                    <p class="text-xs text-muted/80">DOWNLOAD</p>
                                    <p class="font-medium text-text">
                                        {formatSpeed(aggregatedStatus()?.downloadSpeed)}
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
                                        {formatSpeed(aggregatedStatus()?.uploadSpeed)}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Progress bar */}
                        <div class="flex-1 min-w-0 w-full">
                            <div class="flex justify-between text-xs text-muted/80 mb-1.5">
                                <span class="capitalize">
                                    {aggregatedStatus()?.status === "complete"
                                        ? "Completed"
                                        : aggregatedStatus()
                                            ? "Downloading..."
                                            : "Waiting..."}
                                </span>
                                <span class="font-medium text-text">{progressPercent()}%</span>
                            </div>
                            <div class="w-full h-2 bg-secondary-20/30 rounded-full overflow-hidden">
                                <div
                                    class="h-full bg-gradient-to-r from-accent to-primary/80 transition-all duration-500 ease-out"
                                    style={{ width: `${progressPercent()}%` }}
                                />
                            </div>
                        </div>

                        {/* Buttons */}
                        <div class="flex items-center gap-2 ml-auto">
                            <Button
                                variant="bordered"
                                onClick={() =>
                                    actionLabel() === "INSTALL"
                                        ? installIfReady()
                                        : toggleAction()
                                }
                                label={actionLabel()}
                                icon={actionIcon()}
                            />

                            <Button
                                variant="glass"
                                size="sm"
                                onClick={() => setFilesExpanded(!filesExpanded())}
                                icon={
                                    filesExpanded() ? (
                                        <ChevronUp class="w-4 h-4" />
                                    ) : (
                                        <ChevronDown class="w-4 h-4" />
                                    )
                                }
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
                <div
                    class={`overflow-scroll no-scrollbar transition-all duration-300 ease-in-out ${filesExpanded() ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
                        }`}
                >
                    <div class="space-y-3">
                        <h4 class="text-sm font-medium text-muted/80 flex items-center gap-2 px-4 pt-4">
                            <Folder class="w-4 h-4" />
                            Downloading Files
                        </h4>

                        <DownloadFiles gameFiles={files} />
                    </div>
                </div>
            </Show>
        </div>
    );
};

export default DownloadItem;
