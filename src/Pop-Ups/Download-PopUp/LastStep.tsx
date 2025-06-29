import { useNavigate } from "@solidjs/router";
import { invoke } from "@tauri-apps/api/core";
import { message } from "@tauri-apps/plugin-dialog";
import { Box, Check, Download, Loader2, MemoryStick } from "lucide-solid";
import { createSignal, onMount } from "solid-js";
import { render } from "solid-js/web";
import { DownloadedGame, InstallationSettings } from "../../bindings";
import { Modal } from "../Modal/Modal";
import { DownloadPopupProps } from "../../types/popup";
import { DownloadSettingsApi, GlobalSettingsApi } from "../../api/settings/api";
import TitleLabel from "../../pages/Settings-01/Settings-Categories/Components/UI/TitleLabel/TitleLabel";
import { TorrentApi } from "../../api/bittorrent/api";

const downloadSettingsInst = new DownloadSettingsApi();
const settingsInst = new GlobalSettingsApi();
const torrentInst = new TorrentApi();

export default function createLastStepDownloadPopup(props: DownloadPopupProps) {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const destroy = () => {
        render(() => null, container);
        container.remove();
    };


    const LastStepPopup = () => {
        const [downloadStarted, setDownloadStarted] = createSignal(false);
        const [installationSettings, setInstallationSettings] = createSignal<InstallationSettings>({
            auto_clean: false,
            auto_install: false,
            two_gb_limit: false,
            directx_install: false,
            microsoftcpp_install: false
        });

        const handleStartDownload = async () => {
            const currentSettings = await downloadSettingsInst.getDownloadSettings();
            if (currentSettings.status === "ok") {
                let path = currentSettings.data.general.download_dir;
                torrentInst.downloadTorrent(props.downloadedGame.magnetlink, props.downloadedGame, path);
                props.onFinish?.();
            } else {
                await message('Error downloading !' + currentSettings.error, { title: 'FitLauncher', kind: 'error' })
            }

            console.log("smthng")
        };

        onMount(async () => {
            try {
                let downloadSettings = await downloadSettingsInst.getDownloadSettings();
                let settings = await settingsInst.getInstallationSettings();
                if (downloadSettings.status === "ok") {
                    console.log("settings: ", downloadSettings.data)
                }

                setInstallationSettings(settings)

            } catch (error) {
                console.error("Error initializing settings:", error);
                await message("Failed to load download settings", { title: "Error", kind: "error" });
            }
        });

        return (
            <Modal {...props} onClose={destroy} onConfirm={handleStartDownload}>
                <div class="space-y-6">
                    <div class="text-center">
                        <div class="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Box class="w-8 h-8 text-accent" />
                        </div>
                        <h2 class="text-xl font-bold text-text mb-2">Ready to Download!</h2>
                        <p class="text-muted">
                            Your download will begin shortly. This may take a moment to initialize.
                        </p>
                    </div>

                    <div class="bg-background-30 rounded-xl p-4 border border-secondary-20 shadow-sm">
                        <h3 class="text-sm font-semibold text-text mb-3 flex items-center gap-2">
                            <MemoryStick class="w-4 h-4 text-accent" />
                            Download Summary
                        </h3>
                        <div class="space-y-3 w-full">
                            {/* Title Row - No subtext */}
                            <div class="flex justify-between items-baseline w-full">
                                <div class="flex flex-col">
                                    <span class="text-text font-medium">Title</span>
                                </div>
                                <span class="text-sm text-text truncate max-w-[50%]">
                                    {props.downloadedGame.title}
                                </span>
                            </div>

                            {/* Repack Size Row */}
                            <div class="flex justify-between items-baseline w-full">
                                <div class="flex flex-col">
                                    <span class="text-text font-medium">Repack Size:</span>
                                    <span class="text-xs text-muted leading-tight whitespace-nowrap">
                                        Size that will be downloaded
                                    </span>
                                </div>
                                <span class="text-sm text-text">
                                    {props.gameDetails.repackSize}
                                </span>
                            </div>

                            {/* Original Size Row */}
                            <div class="flex justify-between items-baseline w-full">
                                <div class="flex flex-col">
                                    <span class="text-text font-medium">Original Size:</span>
                                    <span class="text-xs text-muted leading-tight whitespace-nowrap">
                                        Size that will be extracted
                                    </span>
                                </div>
                                <span class="text-sm text-text">
                                    {props.gameDetails.originalSize}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </Modal>
        );
    };

    render(() => <LastStepPopup />, container);
}