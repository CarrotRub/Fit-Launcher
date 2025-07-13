import { Component, createEffect, createSignal, For, onMount } from "solid-js";
import { Dynamic } from "solid-js/web";
import { makePersisted } from "@solid-primitives/storage";
import { message } from "@tauri-apps/plugin-dialog";
import { DownloadedGame, Status, TaskStatus } from "../../bindings";
import { TorrentApi } from "../../api/bittorrent/api";
import { LibraryApi } from "../../api/library/api";
import {
    Trash2, Pause, Play, Check, Download as DownloadIcon,
    Upload, HardDrive, ArrowDown, ArrowUp,
    CloudDownload,
    Gamepad2,
    Settings
} from "lucide-solid";
import Button from "../../components/UI/Button/Button";
import { useNavigate } from "@solidjs/router";
import { InstallationApi } from "../../api/installation/api";
import { formatBytes } from "../../helpers/format";

const torrentApi = new TorrentApi();
const libraryApi = new LibraryApi();

const DownloadPage: Component = () => {
    const navigate = useNavigate();
    const [downloading, setDownloading] = createSignal<{ game: DownloadedGame; status?: Status }[]>([]);


    async function refreshDownloads() {
        const activeRes = await torrentApi.getTorrentListActive();
        const waitingRes = await torrentApi.getTorrentListWaiting();

        if (activeRes.status !== "ok" && waitingRes.status !== "ok") return;

        const combined = [
            ...(activeRes.status === "ok" ? activeRes.data : []),
            ...(waitingRes.status === "ok" ? waitingRes.data : [])
        ];

        const statusMap = new Map<string, Status>();
        for (const status of combined) {
            const key = status.following ?? status.gid;
            statusMap.set(key, status);
        }

        const entries: { game: DownloadedGame; status?: Status }[] = [];

        for (const [savedGid, games] of torrentApi.gameList.entries()) {
            const status =
                statusMap.get(savedGid) ||
                [...statusMap.values()].find(s => s.gid === savedGid || s.following === savedGid);

            for (const game of games) {
                entries.push({
                    game: structuredClone(game),
                    status: status ? structuredClone(status) : undefined,
                });
            }
        }

        setDownloading(entries);
    }




    async function checkFinishedDownloads() {
        const updates = downloading().filter(
            (d) => d.status?.status === "complete" && d.status?.completedLength === d.status?.totalLength
        );

        for (const { game, status } of updates) {
            if (!status) continue;

            const gid = status.gid;
            const games = torrentApi.gameList.get(gid);

            if (games) {
                const updatedGames = games.map((g) => {
                    if (g.magnetlink === game.magnetlink) {
                        return structuredClone(game);
                    }
                    return g;
                });

                torrentApi.gameList.set(gid, updatedGames);

                await torrentApi.saveGameListToDisk();
            }

            await libraryApi.addDownloadedGame(game);

            torrentApi.gameList.delete(gid);

            // Only add to uninstalled list if not already in library
            const alreadyInstalled = await libraryApi.hasDownloadedGame(game);
            if (!alreadyInstalled) {
                torrentApi.uninstalledGames.set(gid, game);
                await torrentApi.saveUninstalledToDisk();
            }

        }

        await refreshDownloads();
    }


    onMount(async () => {
        await torrentApi.loadGameListFromDisk();
        await torrentApi.loadUninstalledFromDisk();

        const statusRes = await torrentApi.getTorrentListActive();
        const statusMap = new Map<string, Status>();

        if (statusRes.status === "ok") {
            for (const status of statusRes.data) {
                if (status.following) {
                    statusMap.set(status.following, status);
                } else {
                    statusMap.set(status.gid, status);
                }



            }
        }

        const entries: { game: DownloadedGame; status?: Status }[] = [];

        for (const [gid, games] of torrentApi.gameList.entries()) {
            const status = statusMap.get(gid);
            for (const game of games) {
                entries.push({
                    game: structuredClone(game),
                    status: status ? structuredClone(status) : undefined,
                });
            }
        }
        for (const [gid, game] of torrentApi.uninstalledGames.entries()) {
            entries.push({
                game: structuredClone(game),
                status: undefined
            });
        }
        setDownloading(entries);

        setInterval(() => {
            refreshDownloads();
            checkFinishedDownloads();
        }, 1000);
    });

    const formatSpeed = (bytes?: number) => {
        if (!bytes) return "-";
        if (bytes < 1024) return `${bytes} B/s`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB/s`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB/s`;
    };


    return (
        <div class="min-h-screen  bg-background  p-6">
            {/* Header with glass effect */}
            <div class="sticky top-0 z-10 bg-popup/80 backdrop-blur-sm mx-auto rounded-xl max-w-7xl p-4 mb-6 border border-secondary-20 shadow-sm">
                <div class="flex justify-between items-center max-w-7xl mx-auto">
                    <h1 class="text-2xl font-bold flex items-center gap-3">
                        <CloudDownload class="w-6 h-6 text-accent" />
                        <span class="bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent">
                            DOWNLOAD MANAGER
                        </span>
                    </h1>

                    <Button

                        size="sm"
                        label="CLEAR ALL"
                        icon={<Trash2 class="w-4 h-4" />}
                        onClick={async () => torrentApi.removeAllTorrents()}
                    />
                </div>
            </div>

            {/* Main Content */}
            <div class="max-w-7xl mx-auto">
                {/* Stats Bar */}
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div class="bg-popup/50 backdrop-blur-sm rounded-xl p-4 border border-secondary-20">
                        <div class="flex items-center gap-3">
                            <HardDrive class="w-5 h-5 text-accent" />
                            <div>
                                <p class="text-sm text-muted">Active Downloads</p>
                                {
                                    downloading().filter(d => d.status?.status === "active").length
                                }
                            </div>
                        </div>
                    </div>
                    <div class="bg-popup/50 backdrop-blur-sm rounded-xl p-4 border border-secondary-20">
                        <div class="flex items-center gap-3">
                            <ArrowDown class="w-5 h-5 text-green-500" />
                            <div>
                                <p class="text-sm text-muted">Total Download Speed</p>
                                <p class="text-xl font-semibold">
                                    {formatSpeed(downloading().reduce((acc, item) => acc + (item.status?.downloadSpeed ?? 0), 0))}

                                </p>
                            </div>
                        </div>
                    </div>
                    <div class="bg-popup/50 backdrop-blur-sm rounded-xl p-4 border border-secondary-20">
                        <div class="flex items-center gap-3">
                            <ArrowUp class="w-5 h-5 text-blue-500" />
                            <div>
                                <p class="text-sm text-muted">Total Upload Speed</p>
                                <p class="text-xl font-semibold">
                                    {formatSpeed(downloading().reduce((acc, item) => acc + (item.status?.uploadSpeed ?? 0), 0))}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Downloads List */}
                {downloading().length > 0 ? (
                    <div class="space-y-3">
                        <For each={downloading()}>
                            {(item) => (
                                <Dynamic component={DownloadingGameItem} game={item.game} status={item.status} />
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

function DownloadingGameItem(props: { game: DownloadedGame; status?: Status }) {
    const [progress, setProgress] = makePersisted(createSignal("0%"));
    const [numberProgress, setNumberProgress] = createSignal(0);

    const libraryInst = new LibraryApi();
    createEffect(() => {
        const completed = props.status?.completedLength ?? 0;
        const total = props.status?.totalLength ?? 1;
        const percent = total > 0 ? (completed / total) * 100 : 0;
        setNumberProgress(Math.floor(percent));
        setProgress(`${percent.toFixed(1)}%`);

        if (numberProgress() === 100) {
            libraryInst.addDownloadedGame(props.game)
        }
    });

    function formatSpeed(bytes?: number): string {
        if (!bytes || bytes <= 0) return "-";
        if (bytes < 1024) return `${bytes} B/s`;
        if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB/s`;
        if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB/s`;
        return `${(bytes / 1024 ** 3).toFixed(1)} GB/s`;
    }





    return (
        <div class="bg-popup rounded-xl border border-secondary-20 overflow-hidden transition-all hover:border-accent/50">
            <div class="flex flex-col md:flex-row">
                {/* Game Info */}
                <div class="flex items-center p-4 md:w-1/3">
                    <img
                        src={props.game.img}
                        alt={props.game.title}
                        class="w-16 h-16 rounded-lg object-cover mr-4"
                    />
                    <div>
                        <h3 class="font-medium line-clamp-2">{props.game.title}</h3>
                        <div class="flex items-center gap-2 mt-1 text-sm text-muted">
                            <HardDrive class="w-4 h-4" />
                            <span>{formatBytes(props.status?.totalLength)} total</span>
                        </div>
                    </div>
                </div>

                {/* Download Stats */}
                <div class="flex flex-row items-center w-full border-t-0 border-l border-secondary-20 p-4 md:w-2/3">
                    <div class="flex flex-row items-center justify-center gap-4 w-full">
                        {/* Speed Indicators */}
                        <div class="flex gap-6 justify-center">
                            <div class="flex items-center gap-2">
                                <ArrowDown class="w-5 h-5 text-green-500" />
                                <div>
                                    <p class="text-xs text-muted">DOWNLOAD</p>
                                    <p class="font-medium">{formatSpeed(props.status?.downloadSpeed)}</p>
                                </div>
                            </div>
                            <div class="flex items-center gap-2">
                                <ArrowUp class="w-5 h-5 text-blue-500" />
                                <div>
                                    <p class="text-xs text-muted">UPLOAD</p>
                                    <p class="font-medium">{formatSpeed(props.status?.uploadSpeed)}</p>
                                </div>
                            </div>
                        </div>

                        {/* Progress Bar */}
                        <div class="flex-1 ">
                            <div class="flex justify-between text-xs text-muted mb-1">
                                <span>
                                    {props.status?.status === "complete"
                                        ? "Completed"
                                        : props.status
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

                        {/* Action Button */}
                        <div class="ml-auto justify-center">
                            <DownloadActionButton status={props.status!} />

                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
const triedInstall = new Map<string, boolean>();
function DownloadActionButton({ status }: { status?: Status }) {

    const [buttonState, setButtonState] = createSignal<
        "pause" | "resume" | "complete" | "uploading" | "install"
    >("pause");

    const [installAttempted, setInstallAttempted] = createSignal(false);
    const installationInst = new InstallationApi();


    onMount(() => {
        if (!status) setButtonState("resume");
    });

    createEffect(() => {
        if (!status) return setButtonState("resume");

        const gid = status.gid;
        if (!gid) return;

        const isUploading = status.status === "active" && status.totalLength === status.completedLength;
        const isComplete = status.status === "complete" || isUploading;

        if (isComplete) {
            if (triedInstall.get(gid)) {
                setButtonState("complete");
                return;
            }



            const fullPath = status.files?.[0]?.path;
            if (fullPath && triedInstall.get(gid)) {
                const folderPath = fullPath.split(/[\\/]/).slice(0, -1).join("/");

                triedInstall.set(gid, true);

                queueMicrotask(async () => {
                    const result = await installationInst.startInstallation(folderPath);

                    if (result.status === "ok") {
                        setButtonState("complete");
                    } else if (result.error === "AdminModeError") {
                        setButtonState("install");
                        triedInstall.delete(gid);
                        if (torrentApi.uninstalledGames.has(gid)) {
                            torrentApi.uninstalledGames.delete(gid);
                            await torrentApi.saveUninstalledToDisk();
                        }

                    }
                });
            } else {
                setButtonState("install")
            }
        } else if (isUploading) {
            setButtonState("install");
        } else {
            switch (status.status) {
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
        const gid = status?.gid ?? "";
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
                if (status?.files?.[0]?.path) {
                    const folderPath = status.files[0].path.split(/[\\/]/).slice(0, -1).join("/");
                    const result = await installationInst.startInstallation(folderPath);

                    if (result.status === "ok") {
                        setInstallAttempted(true);
                        setButtonState("complete");
                    } else if (result.error === "AdminModeError") {
                        setButtonState("install");
                    }
                }
                break;
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
            case "complete":
                return <Check class="w-5 h-5" />;
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
        <Button variant="bordered" onClick={toggle} label={label()} icon={icon()} />
    );
}



export default DownloadPage;