import { Component, For } from "solid-js";
import DownloadItem from "./Downloads-Item";
import type { DownloadItem as DI } from "./Downloads-Page";

const DownloadList: Component<{
    items: DI[];
    expandedStates: () => Record<string, boolean>;
    onToggleExpand: (id: string) => void;
    refreshDownloads: () => Promise<void>;
}> = (props) => {
    return (
        <div class="grid grid-cols-1 gap-5">
            <For each={props.items}>
                {(item) => {
                    const key = item.type === "torrent" ? `torrent:${item.gid}` : `ddl:${item.jobId}`;
                    return (
                        <div class="bg-popup/80 backdrop-blur-sm rounded-2xl border border-secondary-20/50 hover:border-accent/50 transition-all hover:shadow-xl hover:shadow-accent/10 overflow-hidden">
                            <DownloadItem
                                item={item}
                                isExpanded={!!props.expandedStates()[key]}
                                onToggleExpand={() => props.onToggleExpand(key)}
                                refreshDownloads={props.refreshDownloads}
                            />
                        </div>
                    );
                }}
            </For>
        </div>
    );
};

export default DownloadList;
