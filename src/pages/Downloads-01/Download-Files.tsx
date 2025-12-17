import { Accessor, Component, createMemo, For } from "solid-js";
import { formatBytes } from "../../helpers/format";
import { File } from "../../bindings";

const DownloadFiles: Component<{ gameFiles: Record<string, File> }> = (props) => {
    return (
        <div class="border-t border-secondary-20/30 p-4 space-y-3">
            <div class="space-y-2">
                <For each={Object.values(props.gameFiles)} fallback={<div class="text-muted/80">No files found.</div>}>
                    {(file) => (
                        <FileRow file={file} />
                    )}
                </For>

            </div>
        </div>
    );
};

const FileRow: Component<{ file: File }> = (props) => {
    const getFileNameFromPath = (path: string) => path.split(/[\\/]/).pop() || path;

    const progress = createMemo(() => {
        const { completedLength, length } = props.file;
        return length > 0 ? (completedLength / length) * 100 : 0;
    });
    return (
        <div class="bg-secondary-10/50 hover:bg-secondary-20/30 rounded-lg p-3 transition-colors">
            <div class="flex justify-between text-xs mb-1.5">
                <span class="truncate max-w-[200px] sm:max-w-md font-medium text-text">
                    {getFileNameFromPath(props.file.path)}
                </span>
                <span class="text-muted/80">{progress().toFixed(1)}%</span>
            </div>

            <div class="w-full h-1.5 bg-secondary-20/30 rounded-full overflow-hidden">
                <ProgressBar progress={progress} />
            </div>

            <div class="flex justify-between text-xs text-muted/80 mt-1">
                <span>{formatBytes(props.file.completedLength)}</span>
                <span>{formatBytes(props.file.length)}</span>
            </div>
        </div>
    );
};

const ProgressBar: Component<{ progress: Accessor<number> }> = (props) => {
    return (
        <div
            class="h-full bg-accent/80 transition-[width] duration-500 ease-out will-change-[width]"
            style={{ width: `${props.progress()}%` }}
        />
    );
};


export default DownloadFiles;
