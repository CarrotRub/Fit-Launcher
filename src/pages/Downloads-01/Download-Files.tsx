import { Component, For } from "solid-js";
import { formatBytes } from "../../helpers/format";

const DownloadFiles: Component<{ files: { path: string; length: number; completedLength: number }[] }> = (props) => {
    const getFileNameFromPath = (path: string) => path.split(/[\\/]/).pop() || path;

    return (
        <div class="border-t border-secondary-20/30 p-4 space-y-3">
            <div class="space-y-2">
                <For each={props.files}>
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
    );
};

export default DownloadFiles;
