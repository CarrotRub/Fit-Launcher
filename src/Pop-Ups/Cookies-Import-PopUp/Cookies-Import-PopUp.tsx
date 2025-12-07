import { createSignal, onMount, Show } from "solid-js";
import { render } from "solid-js/web";
import { Info, UploadCloud } from "lucide-solid";
import Button from "../../components/UI/Button/Button";
import { PopupProps } from "../../types/popup";
import { Modal } from "../Modal/Modal";
import { useDropZone } from "../../components/DropZone-01/DropZone";
import { message } from "@tauri-apps/plugin-dialog";
import { showError } from "../../helpers/error";

export default function createCookiesImportPopup(props: PopupProps<[File]>) {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const destroy = () => {
        render(() => null, container);
        container.remove();
    };

    render(() => {
        const [droppedFileName, setDroppedFileName] = createSignal<string | null>(null);
        const [droppedFilePath, setDroppedFilePath] = createSignal<string | null>(null);

        const handleManualDrop = async (e: DragEvent) => {
            e.preventDefault();
            const file = e.dataTransfer?.files?.[0];
            if (file) {
                if (file.name.toLowerCase().endsWith(".json")) {
                    setDroppedFileName(file.name);
                    setDroppedFilePath(file.webkitRelativePath);
                } else {
                    await showError("Wrong file type", "File Type Error");
                }
            }
        };

        const { ref, dragIn } = useDropZone(async (paths) => {
            const firstPath = paths?.[0];
            console.log("DROP ZONE CALLBACK FIRED", paths);
            if (firstPath) {
                const fileName = firstPath.split(/[\\/]/).pop()!;
                console.log("Checking file:", fileName);
                if (fileName.toLowerCase().endsWith(".json")) {
                    console.log("Valid JSON file:", fileName);
                    setDroppedFileName(fileName);
                    setDroppedFilePath(firstPath)
                    props.action?.(new File([], fileName));
                } else {
                    console.log("Invalid file type");
                    await showError("This isn't a JSON file.", "Wrong Type");
                }
            }
        });


        onMount(() => {
            console.log("Ready to import cookies");
        });

        return (
            <Modal {...props} onConfirm={() => { }} onClose={destroy}>
                <div class="space-y-6">
                    {/* Top: video */}
                    <div class="w-full rounded-lg overflow-hidden aspect-video border border-secondary-20">
                        <video
                            autoplay
                            muted
                            loop
                            playsinline
                            class="w-full h-full object-cover"
                            src="/videos/captcha-helper.mp4"
                        />
                    </div>

                    {/* Bottom: file dropzone */}
                    <div
                        class={`w-full h-full border-2 rounded-lg border-dashed transition-colors ${dragIn() ? "border-accent bg-secondary-10" : "border-secondary-20 hover:border-accent"
                            }`}
                    >
                        <div
                            ref={ref}
                            onDrop={handleManualDrop}
                            onDragOver={(e) => e.preventDefault()}
                            class="w-full flex flex-col items-center justify-center p-6 text-center bg-background-20 cursor-pointer"
                        >
                            <UploadCloud class="w-8 h-8 text-muted mb-2 pointer-events-none" />
                            <Show
                                when={droppedFileName()}
                                fallback={
                                    <p class="text-sm text-muted">Drop your cookies file here</p>
                                }
                            >
                                <p class="text-sm text-text">
                                    File selected: {droppedFileName()}
                                </p>
                            </Show>
                        </div>
                    </div>
                </div>
            </Modal>
        );
    }, container);
}
