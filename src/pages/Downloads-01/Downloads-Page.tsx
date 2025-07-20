import { Component, createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js";
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
    DownloadCloud
} from "lucide-solid";
import Button from "../../components/UI/Button/Button";
import { useNavigate } from "@solidjs/router";
import { InstallationApi } from "../../api/installation/api";
import { formatBytes, formatSpeed, toNumber } from "../../helpers/format";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

const torrentApi = new TorrentApi();
const ddlApi = new DownloadManagerApi();
const libraryApi = new LibraryApi();

// Unified download item type
type DownloadItem =
    | { type: 'torrent', game: DownloadedGame; status?: Status; gid: string }
    | { type: 'ddl', job: DdlJobEntry; statuses: Status[]; jobId: string };

const DownloadPage: Component = () => {
    const navigate = useNavigate();
    const [downloadItems, setDownloadItems] = createSignal<DownloadItem[]>([]);
    const [expandedStates, setExpandedStates] = createSignal<Record<string, boolean>>({});
    const [installationsInProgress, setInstallationsInProgress] = createSignal<Set<string>>(new Set());
    const toggleExpand = (id: string) => {
        setExpandedStates(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };
    const [processedJobs, setProcessedJobs] = createSignal<Set<string>>(new Set());

    // Aggregate download stats
    const downloadStats = createMemo(() => {
        let totalDownloadSpeed = 0;
        let totalUploadSpeed = 0;
        let activeCount = 0;
        let torrentCount = 0;
        let ddlCount = 0;

        for (const item of downloadItems()) {
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


        return {
            activeCount,
            torrentCount,
            ddlCount,
            totalDownloadSpeed,
            totalUploadSpeed
        };
    });

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
        if (activeRes.status === "ok") {
            activeRes.data.forEach(s => torrentStatusMap.set(s.gid, s));
        }
        if (waitingRes.status === "ok") {
            waitingRes.data.forEach(s => torrentStatusMap.set(s.gid, s));
        }

        const ddlJobs = DownloadManagerApi.getAllJobs();
        const ddlStatusPromises = Array.from(ddlJobs)
            .map(async ([jobId, job]) => {
                const statusPromises = job.gids.map(gid => commands.aria2GetStatus(gid));
                const results = await Promise.all(statusPromises);
                return {
                    jobId,
                    statuses: results
                        .filter(r => r.status === "ok")
                        .map(r => r.data)
                };
            });

        const ddlStatusResults = await Promise.all(ddlStatusPromises);
        const ddlStatuses = new Map<JobId, Status[]>();
        ddlStatusResults.forEach(({ jobId, statuses }) => ddlStatuses.set(jobId, statuses));


        const items: DownloadItem[] = [];

        for (const [gid, games] of torrentApi.gameList.entries()) {
            const status = torrentStatusMap.get(gid);
            for (const game of games) {
                items.push({
                    type: 'torrent',
                    game,
                    status,
                    gid
                });
            }
        }

        for (const [jobId, job] of ddlJobs) {
            items.push({
                type: 'ddl',
                job,
                statuses: ddlStatuses.get(jobId) || [],
                jobId
            });
        }

        setDownloadItems(items);
    }


    async function checkFinishedDownloads() {
        const items = downloadItems();
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
                const allComplete = item.statuses.every(s =>
                    s.status === "complete" &&
                    s.completedLength === s.totalLength
                );

                if (allComplete) {
                    const key = `ddl:${item.jobId}`;
                    if (currentInstallations.has(key) || processedJobs().has(key)) continue;

                    setProcessedJobs(prev => new Set(prev).add(key));

                    // Mark installation as in progress
                    setInstallationsInProgress(prev => new Set(prev).add(key));

                    await libraryApi.addDownloadedGame(item.job.downloadedGame);
                    const targetPath = item.job.targetPath;

                    installationApi.startExtractionDdl(targetPath)
                        .then(async () => {
                            DownloadManagerApi.removeJob(item.jobId);
                            await DownloadManagerApi.saveJobMapToDisk();
                            installationApi.startInstallation(targetPath)
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

        setInterval(() => {
            refreshDownloads();
            checkFinishedDownloads();
        }, 2500);
    });

    return (
        <div class="min-h-screen bg-background p-6">
            {/* Header with glass effect */}
            <div class="top-0 z-10 bg-popup/80 backdrop-blur-sm mx-auto rounded-xl max-w-7xl p-4 mb-6 border border-secondary-20 shadow-sm">
                <div class="flex justify-between items-center max-w-7xl mx-auto">
                    <h1 class="text-2xl font-bold flex items-center gap-3">
                        <CloudDownload class="w-6 h-6 text-accent" />
                        <span class="bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent">
                            DOWNLOAD MANAGER
                        </span>
                    </h1>

                    <div class="flex gap-2">
                        <Button
                            size="sm"
                            label="CLEAR ALL TORRENTS"
                            icon={<Trash2 class="w-4 h-4" />}
                            onClick={async () => torrentApi.removeAllTorrents()}
                        />
                        <Button
                            size="sm"
                            label="CLEAR ALL DDL"
                            icon={<Trash2 class="w-4 h-4" />}
                            onClick={async () => {
                                const jobs = DownloadManagerApi.getAllJobs();
                                for (const [jobId] of jobs) {
                                    await DownloadManagerApi.removeJob(jobId);
                                }
                                await refreshDownloads();
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div class="max-w-7xl mx-auto">
                {/* Stats Bar */}
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div class="bg-popup/50 backdrop-blur-sm rounded-xl p-4 border border-secondary-20">
                        <div class="flex items-center gap-3">
                            <Magnet class="w-5 h-5 text-blue-500" />
                            <div>
                                <p class="text-sm text-muted">Torrents</p>
                                <p class="text-lg font-semibold">
                                    {downloadStats().torrentCount}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div class="bg-popup/50 backdrop-blur-sm rounded-xl p-4 border border-secondary-20">
                        <div class="flex items-center gap-3">
                            <DownloadCloud class="w-5 h-5 text-green-500" />
                            <div>
                                <p class="text-sm text-muted">Direct Downloads</p>
                                <p class="text-lg font-semibold">
                                    {downloadStats().ddlCount}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div class="bg-popup/50 backdrop-blur-sm rounded-xl p-4 border border-secondary-20">
                        <div class="flex items-center gap-3">
                            <ArrowDown class="w-5 h-5 text-green-500" />
                            <div>
                                <p class="text-sm text-muted">Total Download Speed</p>
                                <p class="text-lg font-semibold">
                                    {formatSpeed(downloadStats().totalDownloadSpeed)}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div class="bg-popup/50 backdrop-blur-sm rounded-xl p-4 border border-secondary-20">
                        <div class="flex items-center gap-3">
                            <ArrowUp class="w-5 h-5 text-blue-500" />
                            <div>
                                <p class="text-sm text-muted">Total Upload Speed</p>
                                <p class="text-lg font-semibold">
                                    {formatSpeed(downloadStats().totalUploadSpeed)}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Downloads List */}
                {downloadItems().length > 0 ? (
                    <div class="space-y-3">
                        <For each={downloadItems()}>
                            {(item) => (
                                <Dynamic
                                    component={DownloadingGameItem}
                                    item={item}
                                    isExpanded={!!expandedStates()[item.type === 'torrent' ? item.gid : item.jobId]}
                                    onToggleExpand={() => toggleExpand(item.type === 'torrent' ? item.gid : item.jobId)}
                                    formatSpeed={formatSpeed} // Pass formatter to child
                                />
                            )}
                        </For>
                    </div>
                ) : (
                    <div class="flex flex-col items-center justify-center py-16 text-center bg-popup/30 backdrop-blur-sm rounded-2xl border border-dashed border-secondary-20">
                        <div class="relative mb-6">
                            <DownloadIcon class="w-16 h-16 text-accent animate-pulse" />
                        </div>
                        <h3 class="text-2xl font-medium text-text mb-2">No Active Downloads</h3>
                        <p class="text-muted max-w-md mb-6">
                            Your active downloads will appear here. Start downloading games to see them!
                        </p>
                        <Button
                            label="Browse Games"
                            icon={<Gamepad2 class="w-5 h-5" />}
                            onClick={() => navigate('/discovery-page')}
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
}) {
    const game = props.item.type === 'torrent'
        ? props.item.game
        : props.item.job.downloadedGame;

    // For torrents: single status, for DDL: aggregate multiple statuses
    const aggregatedStatus = createMemo(() => {
        if (props.item.type === "torrent") {
            return props.item.status;
        }

        let totalLength = 0;
        let completedLength = 0;
        let downloadSpeed = 0;
        let uploadSpeed = 0;

        let allComplete = true;
        let anyActive = false;

        for (const s of props.item.statuses) {
            totalLength += toNumber(s.totalLength);
            completedLength += toNumber(s.completedLength);
            downloadSpeed += toNumber(s.downloadSpeed);
            uploadSpeed += toNumber(s.uploadSpeed);

            if (s.status !== "complete") {
                allComplete = false;
            }
            if (s.status === "active") {
                anyActive = true;
            }
        }

        let status: TaskStatus = "waiting";
        if (allComplete) {
            status = "complete";
        } else if (anyActive) {
            status = "active";
        }

        return {
            gid: "",
            status,
            totalLength,
            completedLength,
            downloadSpeed,
            uploadSpeed,
            connections: 0,
            numPieces: 0,
            pieceLength: 0,
        } as Status;
    });



    const files = createMemo(() => {
        if (props.item.type === 'torrent') {
            return props.item.status?.files || [];
        }

        // For DDL: get files from all statuses
        return props.item.statuses.flatMap(s => s.files || []);
    });

    const progress = createMemo(() => {
        const status = aggregatedStatus();
        if (!status) return "0%";

        const completed = status.completedLength || 0;
        const total = status.totalLength || 1;
        const percent = total > 0 ? (completed / total) * 100 : 0;
        return `${percent.toFixed(1)}%`;
    });

    const numberProgress = createMemo(() => {
        const status = aggregatedStatus();
        if (!status) return 0;

        const completed = status.completedLength || 0;
        const total = status.totalLength || 1;
        return Math.floor((completed / total) * 100);
    });

    const getFileNameFromPath = (path: string): string => {
        return path.split(/[\\/]/).pop() || path;
    };

    return (
        <div class="bg-popup rounded-xl h-fit border border-secondary-20 overflow-hidden transition-all hover:border-accent/50">
            <div class="flex flex-row items-center h-full">
                {/* Game Info with Download Type Badge */}
                <div class="flex items-center p-4 pt-10 md:w-1/3 border-r border-secondary-20 relative">
                    {/* Download Type Badge */}
                    <div class={`absolute top-2 left-4 px-2 py-1 rounded text-xs font-medium ${props.item.type === 'torrent'
                        ? 'bg-secondary text-text'
                        : 'bg-secondary text-text'
                        }`}>
                        {props.item.type === 'torrent' ? 'TORRENT' : 'DIRECT DOWNLOAD'}
                    </div>

                    <img
                        src={game.img}
                        alt={game.title}
                        class="w-16 h-16 rounded-lg object-cover mr-4"
                    />
                    <div>
                        <h3 class="font-medium line-clamp-2">{game.title}</h3>
                        <div class="flex items-center gap-2 mt-1 text-sm text-muted">
                            <HardDrive class="w-4 h-4" />
                            <span>{formatBytes(aggregatedStatus()?.totalLength)} total</span>
                        </div>
                    </div>
                </div>

                {/* Download Stats */}
                <div class="flex flex-col w-full border-t-0 border-secondary-20">
                    <div class="flex flex-row items-center justify-center gap-4 w-full p-4">
                        {/* Speed Indicators */}
                        <div class="flex gap-6 justify-center">
                            <div class="flex items-center gap-2">
                                <ArrowDown class="w-5 h-5 text-green-500" />
                                <div>
                                    <p class="text-xs text-muted">DOWNLOAD</p>
                                    <p class="font-medium">{props.formatSpeed(aggregatedStatus()?.downloadSpeed)}</p>
                                </div>
                            </div>
                            <div class="flex items-center gap-2">
                                <ArrowUp class="w-5 h-5 text-blue-500" />
                                <div>
                                    <p class="text-xs text-muted">UPLOAD</p>
                                    <p class="font-medium">{props.formatSpeed(aggregatedStatus()?.uploadSpeed)}</p>
                                </div>
                            </div>
                        </div>

                        {/* Progress Bar */}
                        <div class="flex-1">
                            <div class="flex justify-between text-xs text-muted mb-1">
                                <span>
                                    {aggregatedStatus()?.status === "complete"
                                        ? "Completed"
                                        : aggregatedStatus()
                                            ? "Downloading..."
                                            : "Waiting..."}
                                </span>
                                <span>{numberProgress()}%</span>
                            </div>
                            <div class="w-full h-2 bg-secondary-20 rounded-full overflow-hidden">
                                <div
                                    class="h-full bg-gradient-to-r from-accent to-primary transition-all duration-300"
                                    style={{ width: progress() }}
                                />
                            </div>
                        </div>

                        {/* Action Button and Expand Button */}
                        <div class="flex items-center gap-2">
                            <DownloadActionButton
                                item={props.item}
                                status={aggregatedStatus()}
                            />
                            <Button
                                variant="bordered"
                                size="sm"
                                onClick={props.onToggleExpand}
                                icon={
                                    props.isExpanded ? (
                                        <ArrowUp class="w-4 h-4" />
                                    ) : (
                                        <ArrowDown class="w-4 h-4" />
                                    )
                                }
                            />
                        </div>
                    </div>
                </div>
            </div>

            <Show when={files().length > 0}>
                <div class={`overflow-x-hidden no-scrollbar transition-all duration-300 ${props.isExpanded ? "max-h-fit" : "max-h-0"}`}>
                    <div class="border-t border-secondary-20 p-4 space-y-3">
                        <h4 class="text-sm font-medium text-muted">Downloading Files</h4>
                        <div class="space-y-2">
                            <For each={files()}>
                                {(file) => (
                                    <div class="bg-secondary-10 rounded-lg p-3">
                                        <div class="flex justify-between text-xs mb-1">
                                            <span class="truncate max-w-md">{getFileNameFromPath(file.path)}</span>
                                            <span>{((file.completedLength / file.length) * 100).toFixed(1)}%</span>
                                        </div>
                                        <div class="w-full h-1.5 bg-secondary-20 rounded-full overflow-hidden">
                                            <div
                                                class="h-full bg-accent transition-all duration-300"
                                                style={{ width: `${(file.completedLength / file.length) * 100}%` }}
                                            />
                                        </div>
                                        <div class="flex justify-between text-xs text-muted mt-1">
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


function DownloadActionButton(props: { item: DownloadItem; status?: Status }) {
    const [buttonState, setButtonState] = createSignal<
        "pause" | "resume" | "install" | "uploading"
    >("pause");

    const isTorrent = props.item.type === 'torrent';
    const installationApi = new InstallationApi();

    onMount(() => {
        if (!props.status) setButtonState("resume");
    });

    createEffect(() => {
        if (!props.status) return setButtonState("resume");

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

    async function toggle() {
        if (props.item.type === 'torrent') {
            const gid = props.item.gid;
            if (!gid) return;

            switch (buttonState()) {
                case "resume":
                    await torrentApi.resumeTorrent(gid);
                    break;
                case "pause":
                case "uploading":
                    await torrentApi.pauseTorrent(gid);
                    break;
                case "install":

                    const fullPath = props.status!.files?.[0]?.path;
                    if (fullPath) {
                        const folderPath = fullPath.split(/[\\/]/).slice(0, -1).join("/");
                        await installationApi.startInstallation(folderPath);
                        break;
                    }
                    break;
            }
        } else {
            const jobId = props.item.jobId;
            switch (buttonState()) {
                case "resume":
                    await DownloadManagerApi.resumeJob(jobId);
                    break;
                case "pause":
                    await DownloadManagerApi.pauseJob(jobId);
                    break;
                //todo: do xD
                case "uploading":
                    await DownloadManagerApi.pauseJob(jobId);
                    break;
                case "install":
                    if (props.item.statuses.length > 0) {
                        const firstFilePath = props.item.statuses[0].files?.[0]?.path;
                        if (firstFilePath) {
                            await installationApi.startExtractionDdl(firstFilePath);
                        }
                    }
                    break;
            }
        }
    }

    const label = () => {
        switch (buttonState()) {
            case "uploading":
                return "UPLOADING";
            case "install":
                return "INSTALL";
            default:
                return buttonState().toUpperCase();
        }
    };

    const icon = () => {
        switch (buttonState()) {
            case "pause":
            case "uploading":
                return <Pause class="w-5 h-5" />;
            case "install":
                return <Settings class="w-5 h-5" />;
            default:
                return <Play class="w-5 h-5" />;
        }
    };

    return (
        <Button
            variant="bordered"
            onClick={toggle}
            label={label()}
            icon={icon()}
        />
    );
}



export default DownloadPage;