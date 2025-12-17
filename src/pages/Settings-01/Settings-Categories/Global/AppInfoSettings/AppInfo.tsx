import { getTauriVersion, getVersion } from '@tauri-apps/api/app';
import { JSX, Show, createSignal, onMount } from 'solid-js';
import { Github, InfoIcon, MessageCircle, Code2 } from 'lucide-solid';
import PageGroup from '../../Components/PageGroup';
import { open } from '@tauri-apps/plugin-shell';
import { commands } from '../../../../../bindings';

export default function AppInfoSettings(): JSX.Element {
    return (
        <PageGroup title="App Information">
            <AppInfoContent />
        </PageGroup>
    );
}

function AppInfoContent() {
    const [appInfo, setAppInfo] = createSignal<{
        name: string;
        version: string;
        tauriVersion: string;
        lastUpdated: string;
    } | null>(null);

    async function getGitHubReleaseInfo() {
        const res = await fetch("https://api.github.com/repos/CarrotRub/Fit-Launcher/releases/latest");
        if (!res.ok) throw new Error("Failed to fetch release info");
        const data = await res.json();

        const [year, month, day] = data.published_at.split("T")[0].split("-");
        return `${day}-${month}-${year}`;
    }

    onMount(async () => {
        try {
            const version = await getVersion();
            const tauriVersion = await getTauriVersion();
            const lastUpdated = String(await getGitHubReleaseInfo());
            setAppInfo({
                name: "FitLauncher",
                version,
                tauriVersion,
                lastUpdated
            });
        } catch (error) {
            console.error("Failed to fetch app info:", error);
        }
    });

    const openLink = async (url: string) => {
        try {
            await open(url);
            console.log("will open this link: ", url)
        } catch (error) {
            console.error("Failed to open link:", error);
        }
    };

    return (
        <div class="space-y-6">
            {/* App Information Card */}
            <div class="bg-background-30 rounded-xl border border-secondary-20 shadow-sm p-6">
                <h3 class="text-lg font-semibold text-text mb-4 flex items-center gap-2">
                    <InfoIcon class="w-5 h-5 text-accent" />
                    App Information
                </h3>

                <Show when={appInfo()} fallback={<div class="text-muted">Loading app info...</div>}>
                    <div class="grid grid-cols-2 gap-4">
                        <InfoItem label="App Name" value={appInfo()!.name} />
                        <InfoItem label="Version" value={`v${appInfo()!.version}`} />
                        <InfoItem label="Tauri Version" value={appInfo()!.tauriVersion} />
                        <InfoItem label="Last Updated" value={appInfo()!.lastUpdated} />
                    </div>
                </Show>

                {/* Dev Mode Button */}
                <div class="mt-6">
                    <button
                        onClick={async () => await commands.openDevtools()}
                        class="group relative flex items-center gap-3 px-4 py-3 rounded-lg bg-accent/10 hover:bg-accent/20 border border-accent/20 transition-colors w-full"
                    >
                        <div class="w-8 h-8 rounded-full bg-accent flex items-center justify-center">
                            <Code2 class="w-4 h-4 text-white" />
                        </div>
                        <span class="font-medium text-text">Open Dev Tools</span>
                        <div class="absolute inset-0 rounded-lg bg-accent/0 group-hover:bg-accent/5 transition-colors" />
                    </button>
                </div>
            </div>

            {/* Social Links */}
            <div class="bg-background-30 rounded-xl border border-secondary-20 shadow-sm p-6">
                <h3 class="text-lg font-semibold text-text mb-4">Contact Us</h3>

                <div class="flex flex-wrap gap-4">
                    {/* Discord Button */}
                    <button
                        onClick={() => openLink("https://discord.com/invite/cXaBWdcUSF")}
                        class="group relative flex items-center gap-3 px-4 py-3 rounded-lg bg-[#5865F2]/10 hover:bg-[#5865F2]/20 border border-[#5865F2]/20 transition-colors"
                    >
                        <div class="w-8 h-8 rounded-full bg-[#5865F2] flex items-center justify-center">
                            <MessageCircle class="w-4 h-4 text-white" />
                        </div>
                        <span class="font-medium text-text">Discord</span>
                        <div class="absolute inset-0 rounded-lg bg-[#5865F2]/0 group-hover:bg-[#5865F2]/5 transition-colors" />
                    </button>

                    {/* GitHub Button */}
                    <button
                        onClick={() => openLink("https://github.com/CarrotRub/Fit-Launcher")}
                        class="group relative flex items-center gap-3 px-4 py-3 rounded-lg bg-[#333]/10 hover:bg-[#333]/20 border border-[#333]/20 transition-colors"
                    >
                        <div class="w-8 h-8 rounded-full bg-[#333] flex items-center justify-center">
                            <Github class="w-4 h-4 text-white" />
                        </div>
                        <span class="font-medium text-text">GitHub</span>
                        <div class="absolute inset-0 rounded-lg bg-[#333]/0 group-hover:bg-[#333]/5 transition-colors" />
                    </button>
                </div>
            </div>
        </div>
    );
}

function InfoItem(props: { label: string; value: string }) {
    return (
        <div>
            <p class="text-xs text-muted">{props.label}</p>
            <p class="text-sm font-medium text-text">{props.value}</p>
        </div>
    );
}