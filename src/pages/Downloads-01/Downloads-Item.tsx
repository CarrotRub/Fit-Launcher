import { Component, createMemo, createSignal, For, Show, onMount, onCleanup, Accessor, createEffect } from "solid-js";
import { HardDrive, ArrowDown, ArrowUp, ChevronUp, ChevronDown, Folder, Pause, Play, Settings, Trash2 } from "lucide-solid";
import { InstallationApi } from "../../api/installation/api";

import { formatBytes, formatSpeed, toNumber } from "../../helpers/format";
import Button from "../../components/UI/Button/Button";
import DownloadFiles from "./Download-Files";
import { AggregatedStatus, DownloadState, File, FileStatus, Job } from "../../bindings";
import { DM } from "../../api/manager/api";
import { createStore, reconcile } from "solid-js/store";
import { useToast } from "solid-notifications";

const installationApi = new InstallationApi();

const DownloadItem: Component<{ item: Accessor<Job>; refreshDownloads?: () => Promise<void> }> = (props) => {
    const [filesExpanded, setFilesExpanded] = createSignal(false);
    const [jobStatus, setJobStatus] = createSignal<AggregatedStatus | null>(null);
    const [fileStore, setFileStore] = createStore<Record<string, File>>({});
    const { notify } = useToast();

    onMount(() => {
        const saved = localStorage.getItem(`job-${props.item().id}`);
        if (saved) setJobStatus(JSON.parse(saved));

        const unsubUpdate = DM.onUpdated((job) => {
            if (job.id === props.item().id) {
                setJobStatus(job.status);
                localStorage.setItem(`job-${job.id}`, JSON.stringify(job.status));
            }
        });

        const unsubComplete = DM.onCompleted((job) => {
            if (job.id === props.item().id) {
                setJobStatus((prev) => prev && { ...prev, state: "complete" });
                localStorage.setItem(`job-${job.id}`, JSON.stringify(jobStatus()));
            }
        });

        const unsubRemove = DM.onRemoved((job) => {
            if (job === props.item().id) {
                setJobStatus(null);
                localStorage.removeItem(`job-${job}`);
                setFileStore({});
            }
        });

        onCleanup(() => {
            unsubUpdate();
            unsubComplete();
            unsubRemove();
        });
    });


    const actionMap = {
        active: { label: "PAUSE", icon: <Pause class="w-5 h-5" /> },
        complete: { label: "INSTALL", icon: <Settings class="w-5 h-5" /> },
        paused: { label: "RESUME", icon: <Play class="w-5 h-5" /> },
        waiting: { label: "RESUME", icon: <Play class="w-5 h-5" /> },
        error: { label: "RESUME", icon: <Play class="w-5 h-5" /> },
        removed: { label: "RESUME", icon: <Play class="w-5 h-5" /> },
        installing: { label: "INSTALLING", icon: <Settings class="w-5 h-5 animate-spin" /> },
    };
    const currentAction = createMemo(() => {
        const state = props.item().state;
        const status = jobStatus();

        if (state === "active" && status?.upload_speed && status.upload_speed > 0) {
            return { label: "WAITING FOR PAUSE", icon: <Pause class="w-5 h-5 animate-pulse" /> };
        }

        if (state === "complete") {
            return actionMap.complete;
        }

        return actionMap[state] || actionMap.waiting;
    });

    const toggleAction = async () => {
        const state = props.item().state;
        const id = props.item().id;
        const status = jobStatus();

        try {
            switch (state) {
                case "active":
                    if (status?.upload_speed && status.upload_speed > 0) {
                        notify(
                            "The download is still uploading. Pause it first to start installation.",
                            { type: "warning", role: "alert", duration: false }
                        );
                        return;
                    }
                    await DM.pause(id);
                    break;

                case "complete":
                    if (status?.upload_speed && status.upload_speed > 0) {
                        notify(
                            "Upload is still in progress. Pause the torrent before installing.",
                            { type: "warning", role: "alert", duration: false }
                        );
                        return;
                    }
                    await installIfReady();
                    break;

                case "paused":
                case "waiting":
                case "error":
                default:
                    await DM.resume(id);
            }
        } catch (err) {
            console.error("toggleAction failed:", err);
        } finally {
            props.refreshDownloads && (await props.refreshDownloads());
        }
    };


    createEffect(() => {
        const status = jobStatus();
        if (!status) return;

        const newFiles: Record<string, File> = {};

        for (const fs of Object.values(status.per_file)) {
            for (const f of fs!.files ?? []) {
                newFiles[f.path] = f;
            }
        }

        setFileStore(reconcile(newFiles));
    });



    async function removeDownload() {
        try {
            await DM.remove(props.item().id);
            await DM.saveNow();
        } catch (err) {
            console.error("removeDownload failed:", err);
        } finally {
            if (props.refreshDownloads) await props.refreshDownloads();
        }
    }

    async function installIfReady() {
        const targetPath = props.item().metadata.target_path;
        if (!targetPath) return;
        try {
            if (props.item().source === "Torrent") {
                await installationApi.startInstallation(targetPath);
            } else {
                await installationApi.startExtractionDdl(targetPath);
            }
        } catch (err) {
            console.error("installIfReady failed:", err);
        }
    }

    const ddlTotalSize = () =>
        props.item().source === "Ddl"
            ? props.item().ddl!.files.reduce((acc, f) => acc + f.size, 0)
            : jobStatus()?.total_length ?? 0;

    const completedLength = () => jobStatus()?.completed_length ?? 0;

    const progressPercentage = () => {
        const total = ddlTotalSize();
        const completed = completedLength();

        if (total === 0) return 0;
        return Math.min((completed / total) * 100, 100).toFixed(1);
    };

    return (
        <div class="bg-popup rounded-xl border border-secondary-20/60 hover:border-accent/40 transition-all overflow-hidden group">
            <div class="flex flex-col md:flex-row h-full">
                <div class="flex items-center p-4 md:w-1/3 md:border-r border-secondary-20/50 relative">
                    <div class={`absolute top-1.5 left-4 px-2 py-1 rounded-md text-xs font-medium tracking-wide ${props.item().source === "Torrent"
                        ? "bg-blue-500/10 text-blue-400 border border-blue-500/70"
                        : "bg-purple-500/10 text-purple-400 border border-purple-500/70"
                        }`}
                    >
                        {props.item().source === "Torrent" ? "TORRENT" : "DIRECT"}
                    </div>

                    <img
                        src={props.item().game.img}
                        alt={props.item().game.title}
                        class="w-16 h-16 rounded-lg object-cover mt-5 mr-4 border border-secondary-20/30 group-hover:border-accent/30 transition-colors"
                    />
                    <div class="flex-1 min-w-0 mt-5">
                        <h3 class="font-medium line-clamp-2 text-text group-hover:text-primary transition-colors">
                            {props.item().game.title}
                        </h3>
                        <div class="flex items-center gap-2 mt-1 text-sm text-muted/80">
                            <HardDrive class="w-4 h-4 opacity-70" />

                            <span>
                                {
                                    props.item().source === "Ddl"
                                        ? formatBytes(ddlTotalSize())
                                        : formatBytes(jobStatus()?.total_length)}
                            </span>
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
                                        {formatSpeed(jobStatus()?.download_speed)}
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
                                        {formatSpeed(jobStatus()?.upload_speed)}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Progress bar */}
                        <div class="flex-1 min-w-0 w-full">
                            <div class="flex justify-between text-xs text-muted/80 mb-1.5">
                                <span class="capitalize">
                                    {props.item().state === "complete"
                                        ? "Completed"
                                        : props.item()
                                            ? "Downloading..."
                                            : "Waiting..."}
                                </span>
                                <span class="font-medium text-text">{props.item().source === "Ddl" ? progressPercentage() : jobStatus()?.progress_percentage.toFixed(1)}%</span>
                            </div>
                            <div class="w-full h-2 bg-secondary-20/30 rounded-full overflow-hidden">
                                <div
                                    class="h-full bg-gradient-to-r from-accent to-primary/80 transition-all duration-500 ease-out"
                                    style={{ width: `${props.item().source === "Ddl" ? progressPercentage() : jobStatus()?.progress_percentage.toFixed(1)}%` }}
                                />
                            </div>
                        </div>

                        {/* Buttons */}
                        <div class="flex items-center gap-2 ml-auto">
                            <Button variant="bordered" onClick={toggleAction} label={currentAction().label} icon={currentAction().icon} />


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

            <Show when={!!Object.values(fileStore).length}>

                <div
                    class={`overflow-scroll no-scrollbar transition-all duration-300 ease-in-out ${filesExpanded() ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
                        }`}
                >
                    <div class="space-y-3">
                        <h4 class="text-sm font-medium text-muted/80 flex items-center gap-2 px-4 pt-4">
                            <Folder class="w-4 h-4" />
                            Downloading Files
                        </h4>

                        <DownloadFiles gameFiles={fileStore} />
                    </div>
                </div>
            </Show>
        </div>
    );
};

export default DownloadItem;