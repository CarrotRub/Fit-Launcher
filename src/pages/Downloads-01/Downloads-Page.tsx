import { Component, createMemo, createSignal, onMount } from "solid-js";
import { CloudDownload, Filter, Magnet, DownloadCloud, Zap, Trash2, ArrowDown, ArrowUp, Activity } from "lucide-solid";
import Button from "../../components/UI/Button/Button";
import { useNavigate } from "@solidjs/router";

import InstallQueueStatus from "../../components/InstallQueue/QueueStatus";
import DownloadList from "./Downloads-List";
import { formatSpeed } from "../../helpers/format";
import { DM, GlobalDownloadManager } from "../../api/manager/api";
import { AggregatedStatus, DownloadSource, Job, Status } from "../../bindings";
import { DownloadsStore } from "../../stores/download";
import { GlobalStatsStore } from "../../stores/globalStats";

type FilterType = DownloadSource | "All" | "Active";

const DownloadPage: Component = () => {
    const navigate = useNavigate();
    const [activeFilter, setActiveFilter] = createSignal<FilterType>("All");
    const { jobs } = DownloadsStore;


    // onMount(() => {
    //     setJobs(DM.getAll());
    //     console.log("Jobs: ", DM.getAll())
    // });

    const filteredItems = createMemo(() => {
        const f = activeFilter();
        const statuses: Status[] = [];
        return jobs().filter((job) => {
            if (f === "All") return true;
            if (f === "Torrent") return job.source === "Torrent";
            if (f === "Ddl") return job.source === "Ddl";
            if (f === "Active") {
                if (job.state === "active" || job.state === "installing") return true;
                if (job.status) {
                    return
                }
            }
            return true;
        });
    });

    const downloadStats = createMemo(() => {
        let torrentCount = 0;
        let ddlCount = 0;


        const statuses: AggregatedStatus[] = [];
        for (const job of jobs()) {
            if (job.status) {
                statuses.push(job.status!);
                if (job.source === "Torrent") torrentCount++;
                else ddlCount++;
            }
        }
        return { torrentCount, ddlCount };
    });


    async function deleteAllDownloads() {
        for (const job of jobs()) {
            await DM.remove(job.id);
        }
    }



    return (
        <div class="min-h-screen bg-gradient-to-br from-background to-background-950 p-4 w-full">
            <div class="max-w-[1800px] mx-auto mb-8">
                <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                    <h1 class="text-3xl font-bold flex items-center gap-3">
                        <div class="p-2 rounded-xl bg-accent/10 border border-accent/20 backdrop-blur-sm">
                            <CloudDownload class="w-6 h-6 text-accent animate-pulse" />
                        </div>
                        <span class="bg-gradient-to-r from-accent via-primary to-secondary bg-clip-text text-transparent">DOWNLOAD MANAGER</span>
                    </h1>

                    <div class="flex flex-wrap gap-3 w-full md:w-auto items-center">
                        <button
                            onClick={() => setActiveFilter("All")}
                            class={`px-5 py-2.5 rounded-full text-sm font-bold flex items-center gap-2 ${activeFilter() === "All" ? "bg-primary/20 border-primary/50 text-primary" : "bg-secondary-20/10 hover:bg-secondary-20/20 border-secondary-20/30"} border transition-all shadow-secondary-20/10 hover:shadow-secondary-20/20 group`}
                        >
                            <Filter class="w-5 h-5 opacity-70" />
                            <span>All</span>
                        </button>

                        <button
                            onClick={() => setActiveFilter("Torrent")}
                            class={`px-5 py-2.5 rounded-full text-sm font-bold flex items-center gap-2 ${activeFilter() === "Torrent" ? "bg-blue-500/20 border-blue-500/50 text-blue-400" : "bg-blue-500/10 hover:bg-blue-500/20 border-blue-400/30"} border transition-all shadow-blue-400/10 hover:shadow-blue-400/20 group`}
                        >
                            <Magnet class="w-5 h-5 text-blue-400 group-hover:animate-pulse" />
                            <span>Torrents</span>
                            <span class="px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold">{downloadStats().torrentCount}</span>
                        </button>

                        <button
                            onClick={() => setActiveFilter("Ddl")}
                            class={`px-5 py-2.5 rounded-full text-sm font-bold flex items-center gap-2 ${activeFilter() === "Ddl" ? "bg-green-500/20 border-green-500/50 text-green-400" : "bg-green-500/10 hover:bg-green-500/20 border-green-400/30"} border transition-all shadow-green-400/10 hover:shadow-green-400/20 group`}
                        >
                            <DownloadCloud class="w-5 h-5 text-green-400 group-hover:animate-bounce" />
                            <span>Direct</span>
                            <span class="px-2.5 py-1 rounded-full bg-green-500/20 text-green-300 text-xs font-bold">{downloadStats().ddlCount}</span>
                        </button>

                        <button
                            onClick={() => setActiveFilter("Active")}
                            class={`px-5 py-2.5 rounded-full text-sm font-bold flex items-center gap-2 ${activeFilter() === "Active" ? "bg-amber-500/20 border-amber-500/50 text-amber-400" : "bg-amber-500/10 hover:bg-amber-500/20 border-amber-400/30"} border transition-all shadow-amber-400/10 hover:shadow-amber-400/20 group`}
                        >
                            <Zap class="w-5 h-5 text-amber-400 group-hover:animate-pulse" />
                            <span>Active</span>
                            <span class="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold">{GlobalStatsStore.stats()?.numActive}</span>
                        </button>

                        <button
                            onClick={deleteAllDownloads}
                            class={`px-5 py-2.5 rounded-full text-sm font-bold flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 transition-all border border-red-400/30 hover:border-red-400/50 shadow-red-400/10 hover:shadow-red-400/20 group ${filteredItems().length === 0 ? "opacity-50 cursor-not-allowed" : ""}`}
                            disabled={filteredItems().length === 0}
                        >
                            <Trash2 class="w-5 h-5 text-red-400 group-hover:animate-pulse" />
                            <span>Delete All</span>
                        </button>
                    </div>
                </div>

                <div class="flex gap-4 overflow-x-auto p-4 mb-8 no-scrollbar">
                    <div class={`flex items-center gap-3 px-6 py-3 rounded-xl border border-cyan-500/40 bg-popup/80 backdrop-blur-sm`}>
                        <div class="p-2 rounded-lg bg-cyan-500/10">
                            <ArrowDown class="w-5 h-5" />
                        </div>
                        <div class="flex flex-col">
                            <span class="text-xs uppercase tracking-wider text-muted/80">Download Speed</span>
                            <span class="font-bold text-lg">{formatSpeed(GlobalStatsStore.stats()?.downloadSpeed)}</span>
                        </div>
                    </div>

                    <div class={`flex items-center gap-3 px-6 py-3 rounded-xl border border-purple-500/40 bg-popup/80 backdrop-blur-sm`}>
                        <div class="p-2 rounded-lg bg-purple-500/10">
                            <ArrowUp class="w-5 h-5" />
                        </div>
                        <div class="flex flex-col">
                            <span class="text-xs uppercase tracking-wider text-muted/80">Upload Speed</span>
                            <span class="font-bold text-lg">{formatSpeed(GlobalStatsStore.stats()?.uploadSpeed)}</span>
                        </div>
                    </div>

                    <div class={`flex items-center gap-3 px-6 py-3 rounded-xl border border-amber-500/40 bg-popup/80 backdrop-blur-sm`}>
                        <div class="p-2 rounded-lg bg-amber-500/10">
                            <Activity class="w-5 h-5" />
                        </div>
                        <div class="flex flex-col">
                            <span class="text-xs uppercase tracking-wider text-muted/80">Active Transfers</span>
                            <span class="font-bold text-lg">{GlobalStatsStore.stats()?.numActive}</span>
                        </div>
                    </div>
                </div>

                {/* Installation Queue Status */}
                <div class="mt-4">
                    <InstallQueueStatus />
                </div>
            </div>

            <div class="max-w-[1800px] mx-auto">
                <DownloadList
                    items={filteredItems}
                    refreshDownloads={async () => {
                        //** 
                        // * nothing :3
                        // */
                    }}
                />
                {jobs().length === 0 && (
                    <div class="flex flex-col items-center justify-center py-24 text-center bg-popup/30 backdrop-blur-sm rounded-3xl border-2 border-dashed border-accent/30 hover:border-accent/50 transition-all hover:shadow-lg hover:shadow-accent/10">
                        <div class="relative mb-8">
                            <div class="absolute inset-0 bg-accent/10 rounded-full animate-ping opacity-20"></div>
                            <CloudDownload class="w-20 h-20 text-accent animate-bounce" />
                        </div>
                        <h3 class="text-3xl font-bold mb-3 bg-gradient-to-r from-text to-primary bg-clip-text text-transparent">Ready for Downloads!</h3>
                        <p class="text-muted/80 max-w-md mb-8 text-lg">Your download queue is empty. Let's find some awesome games!</p>
                        <Button label="Explore Game Library" icon={<></>} onClick={() => navigate("/discovery-page")} class="text-lg py-3 px-6 hover:scale-105 transition-transform" variant="glass" />
                    </div>
                )}
            </div>
        </div>
    );
};

export default DownloadPage;
