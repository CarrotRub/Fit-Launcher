import { Component, createMemo, createSignal, For, onCleanup, onMount } from "solid-js";
import { CloudDownload, Filter, Magnet, DownloadCloud, Zap, Trash2, ArrowDown, ArrowUp, Activity } from "lucide-solid";
import Button from "../../components/UI/Button/Button";
import { useNavigate } from "@solidjs/router";
import { createStore, reconcile } from "solid-js/store";
import { TorrentApi } from "../../api/bittorrent/api";
import { DdlJobEntry, DownloadManagerApi } from "../../api/download/api";
import { commands, Status, DownloadedGame } from "../../bindings";
import DownloadList from "./Downloads-List";
import { formatSpeed } from "../../helpers/format";
import { backgroundInstaller } from "../../services/background-installer.service";

const torrentApi = new TorrentApi();

export type DownloadItem =
    | { type: "torrent"; game: DownloadedGame; status?: Status; gid: string }
    | { type: "ddl"; job: DdlJobEntry; statuses: Status[]; jobId: string };

const DownloadPage: Component = () => {
    const navigate = useNavigate();
    const [state, setState] = createStore({
        items: [] as DownloadItem[],
        refreshing: false,
    });

    const [expandedStates, setExpandedStates] = createSignal<Record<string, boolean>>({});
    const [activeFilter, setActiveFilter] = createSignal<"all" | "torrent" | "ddl" | "active">("all");

    function getItemKey(item: DownloadItem) {
        return item.type === "torrent" ? `torrent:${item.gid}` : `ddl:${item.jobId}`;
    }

    const filteredItems = createMemo(() => {
        return state.items.filter((item) => {
            const f = activeFilter();
            if (f === "all") return true;
            if (f === "torrent") return item.type === "torrent";
            if (f === "ddl") return item.type === "ddl";
            if (f === "active") {
                if (item.type === "torrent") return item.status?.status === "active";
                return item.statuses.some((s) => s.status === "active");
            }
            return true;
        });
    });

    const downloadStats = createMemo(() => {
        let totalDownloadSpeed = 0;
        let totalUploadSpeed = 0;
        let activeCount = 0;
        let torrentCount = 0;
        let ddlCount = 0;

        for (const item of state.items) {
            if (item.type === "torrent" && item.status) {
                totalDownloadSpeed += Number(item.status.downloadSpeed ?? 0);
                totalUploadSpeed += Number(item.status.uploadSpeed ?? 0);
                if (item.status.status === "active") activeCount++;
                torrentCount++;
            } else if (item.type === "ddl") {
                for (const s of item.statuses) {
                    totalDownloadSpeed += Number(s.downloadSpeed ?? 0);
                    totalUploadSpeed += Number(s.uploadSpeed ?? 0);
                    if (s.status === "active") activeCount++;
                }
                ddlCount++;
            }
        }

        return { totalDownloadSpeed, totalUploadSpeed, activeCount, torrentCount, ddlCount };
    });

    async function refreshDownloads() {
        setState("refreshing", true);
        await Promise.all([torrentApi.loadGameListFromDisk(), DownloadManagerApi.loadJobMapFromDisk()]);

        const [activeRes, waitingRes] = await Promise.all([
            torrentApi.getTorrentListActive(),
            torrentApi.getTorrentListWaiting(),
        ]);

        const torrentStatusMap = new Map<string, Status>();
        if (activeRes.status === "ok") activeRes.data.forEach((s) => torrentStatusMap.set(s.gid, s));
        if (waitingRes.status === "ok") waitingRes.data.forEach((s) => torrentStatusMap.set(s.gid, s));

        const ddlJobs = DownloadManagerApi.getAllJobs();
        const ddlStatusPromises = Array.from(ddlJobs).map(async ([jobId, job]) => {
            const statusPromises = job.gids.map((gid) => commands.aria2GetStatus(gid));
            const results = await Promise.all(statusPromises);
            return { jobId, statuses: results.filter((r) => r.status === "ok").map((r) => r.data) };
        });

        const ddlStatusResults = await Promise.all(ddlStatusPromises);
        const ddlStatuses = new Map<string, Status[]>();
        ddlStatusResults.forEach((r) => ddlStatuses.set(r.jobId, r.statuses));

        const newItems: DownloadItem[] = [];

        for (const [gid, games] of torrentApi.gameList.entries()) {
            const status = torrentStatusMap.get(gid);
            for (const game of games) newItems.push({ type: "torrent", game, status, gid });
        }

        for (const [jobId, job] of ddlJobs) {
            newItems.push({ type: "ddl", job, statuses: ddlStatuses.get(jobId) || [], jobId });
        }

        const reconciled = newItems.map((item) => ({ ...item, reconcileKey: getItemKey(item) as any }));
        setState("items", reconcile(reconciled, { key: "reconcileKey" }));
        setState("refreshing", false);
    }

    async function deleteAllDownloads() {
        try {
            await torrentApi.removeAllTorrents({ force: true });
        } catch (e) {
            console.error("removeAllTorrents", e);
        }
        const ddlJobs = DownloadManagerApi.getAllJobs();
        for (const [jobId] of ddlJobs) {
            try {
                await DownloadManagerApi.removeJob(jobId);
            } catch (e) {
                console.error("remove job", jobId, e);
            }
        }
        setState("items", reconcile([]));
        await refreshDownloads();
    }

    onMount(() => {
        backgroundInstaller.start();
        return () => backgroundInstaller.stop();
    });

    onMount(async () => {
        await Promise.all([torrentApi.loadGameListFromDisk(), DownloadManagerApi.loadJobMapFromDisk(), torrentApi.loadUninstalledFromDisk()]);
        await refreshDownloads();
        const id = setInterval(refreshDownloads, 2000);
        onCleanup(() => clearInterval(id));
    });

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
                            onClick={() => setActiveFilter("all")}
                            class={`px-5 py-2.5 rounded-full text-sm font-bold flex items-center gap-2 ${activeFilter() === "all" ? "bg-primary/20 border-primary/50 text-primary" : "bg-secondary-20/10 hover:bg-secondary-20/20 border-secondary-20/30"} border transition-all shadow-secondary-20/10 hover:shadow-secondary-20/20 group`}
                        >
                            <Filter class="w-5 h-5 opacity-70" />
                            <span>All</span>
                        </button>

                        <button
                            onClick={() => setActiveFilter("torrent")}
                            class={`px-5 py-2.5 rounded-full text-sm font-bold flex items-center gap-2 ${activeFilter() === "torrent" ? "bg-blue-500/20 border-blue-500/50 text-blue-400" : "bg-blue-500/10 hover:bg-blue-500/20 border-blue-400/30"} border transition-all shadow-blue-400/10 hover:shadow-blue-400/20 group`}
                        >
                            <Magnet class="w-5 h-5 text-blue-400 group-hover:animate-pulse" />
                            <span>Torrents</span>
                            <span class="px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold">{downloadStats().torrentCount}</span>
                        </button>

                        <button
                            onClick={() => setActiveFilter("ddl")}
                            class={`px-5 py-2.5 rounded-full text-sm font-bold flex items-center gap-2 ${activeFilter() === "ddl" ? "bg-green-500/20 border-green-500/50 text-green-400" : "bg-green-500/10 hover:bg-green-500/20 border-green-400/30"} border transition-all shadow-green-400/10 hover:shadow-green-400/20 group`}
                        >
                            <DownloadCloud class="w-5 h-5 text-green-400 group-hover:animate-bounce" />
                            <span>Direct</span>
                            <span class="px-2.5 py-1 rounded-full bg-green-500/20 text-green-300 text-xs font-bold">{downloadStats().ddlCount}</span>
                        </button>

                        <button
                            onClick={() => setActiveFilter("active")}
                            class={`px-5 py-2.5 rounded-full text-sm font-bold flex items-center gap-2 ${activeFilter() === "active" ? "bg-amber-500/20 border-amber-500/50 text-amber-400" : "bg-amber-500/10 hover:bg-amber-500/20 border-amber-400/30"} border transition-all shadow-amber-400/10 hover:shadow-amber-400/20 group`}
                        >
                            <Zap class="w-5 h-5 text-amber-400 group-hover:animate-pulse" />
                            <span>Active</span>
                            <span class="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold">{downloadStats().activeCount}</span>
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
                            <span class="font-bold text-lg">{formatSpeed(downloadStats().totalDownloadSpeed)}</span>
                        </div>
                    </div>

                    <div class={`flex items-center gap-3 px-6 py-3 rounded-xl border border-purple-500/40 bg-popup/80 backdrop-blur-sm`}>
                        <div class="p-2 rounded-lg bg-purple-500/10">
                            <ArrowUp class="w-5 h-5" />
                        </div>
                        <div class="flex flex-col">
                            <span class="text-xs uppercase tracking-wider text-muted/80">Upload Speed</span>
                            <span class="font-bold text-lg">{formatSpeed(downloadStats().totalUploadSpeed)}</span>
                        </div>
                    </div>

                    <div class={`flex items-center gap-3 px-6 py-3 rounded-xl border border-amber-500/40 bg-popup/80 backdrop-blur-sm`}>
                        <div class="p-2 rounded-lg bg-amber-500/10">
                            <Activity class="w-5 h-5" />
                        </div>
                        <div class="flex flex-col">
                            <span class="text-xs uppercase tracking-wider text-muted/80">Active Transfers</span>
                            <span class="font-bold text-lg">{downloadStats().activeCount}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="max-w-[1800px] mx-auto">
                <DownloadList
                    items={filteredItems()}
                    expandedStates={expandedStates}
                    onToggleExpand={(id) => setExpandedStates((s) => ({ ...s, [id]: !s[id] }))}
                    refreshDownloads={refreshDownloads}
                />
                {state.items.length === 0 && (
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
