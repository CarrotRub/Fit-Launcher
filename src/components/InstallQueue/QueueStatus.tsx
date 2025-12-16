import { createSignal, onMount, onCleanup, For, Show, createMemo } from 'solid-js';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { Package, Loader, X, CheckCircle2 } from 'lucide-solid';

type QueueStatus = {
    queue: string[];
    active: string | null;
};

export default function InstallQueueStatus() {
    // Source state (signals)
    const [status, setStatus] = createSignal<QueueStatus>({ queue: [], active: null });
    const [isOpen, setIsOpen] = createSignal(false);
    const [progress, setProgress] = createSignal(0);
    const [currentPhase, setCurrentPhase] = createSignal('');
    const [isInstalling, setIsInstalling] = createSignal(false);

    // Derived state (memos)
    const totalItems = createMemo(() => {
        const s = status();
        return (s.queue?.length ?? 0) + (s.active ? 1 : 0);
    });

    const hasActivity = createMemo(() => {
        const s = status();
        return s.active !== null
            || (s.queue?.length ?? 0) > 0
            || isInstalling();
    });

    const formatSlug = (slug: string): string => {
        return slug
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };

    const fetchStatus = async () => {
        try {
            const queueStatus = await invoke<QueueStatus>('get_install_queue_status');
            setStatus(queueStatus);
        } catch (e) {
            console.error('Failed to fetch installation queue status:', e);
        }
    };

    onMount(async () => {
        const unlisteners: UnlistenFn[] = [];

        // Initial fetch
        await fetchStatus();

        // Listen to installation events
        unlisteners.push(
            await listen<{ id: string; success: boolean }>('setup::hook::started', () => {
                setIsInstalling(true);
                setProgress(0);
                setCurrentPhase('Starting');
                fetchStatus();
            })
        );

        unlisteners.push(
            await listen<number>('setup::progress::percent', (event) => {
                setProgress(event.payload);
            })
        );

        unlisteners.push(
            await listen<string>('setup::progress::phase', (event) => {
                setCurrentPhase(event.payload);
            })
        );

        unlisteners.push(
            await listen<string | null>('setup::progress::finished', () => {
                setIsInstalling(false);
                setProgress(100);
                setCurrentPhase('Completed');
                fetchStatus();
            })
        );

        unlisteners.push(
            await listen<string>('setup::progress::error', () => {
                setIsInstalling(false);
                setCurrentPhase('Error');
                fetchStatus();
            })
        );

        // Listen to download events
        unlisteners.push(
            await listen('download::complete', () => {
                fetchStatus();
            })
        );

        unlisteners.push(
            await listen('download::started', () => {
                fetchStatus();
            })
        );

        unlisteners.push(
            await listen('download::queued', () => {
                fetchStatus();
            })
        );

        // Listen to install queue state changes
        unlisteners.push(
            await listen('install::queue::changed', () => {
                fetchStatus();
            })
        );

        onCleanup(() => {
            unlisteners.forEach((unlisten) => unlisten());
        });
    });

    return (
        <Show when={hasActivity()}>
            {/* Floating Button */}
            <button
                class="fixed right-6 bottom-6 z-40 flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-accent to-primary rounded-full shadow-2xl shadow-accent/30 hover:shadow-accent/50 hover:scale-105 transition-all duration-300 border border-accent/30"
                onClick={() => setIsOpen(true)}
            >
                <div class="relative">
                    <Show when={isInstalling()} fallback={<Package size={20} class="text-background" />}>
                        <Loader size={20} class="text-background animate-spin" />
                    </Show>
                    <Show when={totalItems() > 0}>
                        <div class="absolute -top-1 -right-1 w-4 h-4 bg-background rounded-full flex items-center justify-center">
                            <span class="text-[10px] font-bold text-accent">{totalItems()}</span>
                        </div>
                    </Show>
                </div>
                <span class="text-sm font-bold text-background">
                    {isInstalling() ? 'Installing...' : 'Queue'}
                </span>
            </button>

            {/* Backdrop */}
            <Show when={isOpen()}>
                <div
                    class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity duration-300"
                    onClick={() => setIsOpen(false)}
                />
            </Show>

            {/* Side Drawer */}
            <div
                class="fixed right-0 top-0 h-full w-[420px] bg-gradient-to-b from-popup-background to-background z-50 shadow-2xl transform transition-transform duration-300 ease-out"
                style={{
                    transform: isOpen() ? 'translateX(0)' : 'translateX(100%)',
                }}
            >
                {/* Header */}
                <div class="p-6 border-b border-secondary-20/30 bg-popup/50 backdrop-blur">
                    <div class="flex items-center justify-between mb-2">
                        <h2 class="text-2xl font-bold bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent">
                            Install Queue
                        </h2>
                        <button
                            class="p-2 hover:bg-secondary-20/30 rounded-lg transition-colors"
                            onClick={() => setIsOpen(false)}
                        >
                            <X size={20} class="text-muted" />
                        </button>
                    </div>
                    <Show when={isInstalling()}>
                        <div class="flex items-center gap-2">
                            <div class="flex-1 h-1.5 bg-secondary-20/30 rounded-full overflow-hidden">
                                <div
                                    class="h-full bg-gradient-to-r from-accent to-primary rounded-full transition-all duration-300"
                                    style={{ width: `${progress()}%` }}
                                />
                            </div>
                            <span class="text-sm font-medium text-accent">
                                {Math.round(progress())}%
                            </span>
                        </div>
                    </Show>
                </div>

                {/* Content */}
                <div class="h-[calc(100%-140px)] overflow-y-auto p-6 space-y-6">
                    {/* Active Installation */}
                    <Show when={status().active || isInstalling()}>
                        <div>
                            <div class="flex items-center gap-2 mb-3">
                                <div class="w-2 h-2 rounded-full bg-accent animate-pulse" />
                                <span class="text-xs uppercase tracking-wider font-bold text-accent">
                                    Installing Now
                                </span>
                            </div>

                            <div class="p-4 rounded-lg bg-secondary-20/20 border border-accent/30">
                                <div class="flex items-start gap-3">
                                    <div class="p-2 rounded-lg bg-accent/10 mt-1">
                                        <Loader size={20} class="text-accent animate-spin" />
                                    </div>
                                    <div class="flex-1 min-w-0">
                                        <h3 class="font-semibold text-text mb-1 truncate">
                                            {status().active ? formatSlug(status().active!) : 'Installing...'}
                                        </h3>
                                        <p class="text-xs text-muted">
                                            {currentPhase() || 'Running installer...'}
                                        </p>
                                        <div class="mt-3 h-1.5 bg-secondary-20/30 rounded-full overflow-hidden">
                                            <div
                                                class="h-full bg-gradient-to-r from-accent to-primary rounded-full transition-all duration-300"
                                                style={{ width: `${progress()}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Show>

                    {/* Install Queue */}
                    <Show when={(status().queue?.length ?? 0) > 0}>
                        <div>
                            <div class="flex items-center gap-2 mb-3">
                                <Package size={14} class="text-blue-400" />
                                <span class="text-xs uppercase tracking-wider font-bold text-blue-400">
                                    Ready to Install ({status().queue.length})
                                </span>
                            </div>

                            <div class="space-y-2">
                                <For each={status().queue}>
                                    {(slug, index) => (
                                        <div class="group p-4 rounded-lg bg-blue-500/5 hover:bg-blue-500/10 border border-blue-500/20 hover:border-blue-500/40 transition-all">
                                            <div class="flex items-center gap-3">
                                                <div class="flex items-center justify-center w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/30">
                                                    <span class="text-xs font-bold text-blue-400">
                                                        {index() + 1}
                                                    </span>
                                                </div>
                                                <div class="flex-1 min-w-0">
                                                    <h4 class="font-medium text-text truncate group-hover:text-blue-400 transition-colors">
                                                        {formatSlug(slug)}
                                                    </h4>
                                                    <p class="text-xs text-muted">Waiting to install</p>
                                                </div>
                                                <Package size={16} class="text-blue-400/40 flex-shrink-0" />
                                            </div>
                                        </div>
                                    )}
                                </For>
                            </div>
                        </div>
                    </Show>



                    {/* Empty State */}
                    <Show when={!status().active && !isInstalling() && (status().queue?.length ?? 0) === 0}>
                        <div class="flex flex-col items-center justify-center h-64 text-center">
                            <div class="p-4 rounded-full bg-accent/10 mb-4">
                                <CheckCircle2 size={32} class="text-accent" />
                            </div>
                            <h3 class="text-lg font-semibold text-text mb-2">All Done!</h3>
                            <p class="text-sm text-muted">No downloads or installations pending</p>
                        </div>
                    </Show>
                </div>

                {/* Footer */}
                <div class="absolute bottom-0 left-0 right-0 p-4 border-t border-secondary-20/30 bg-popup/80 backdrop-blur">
                    <div class="flex items-center justify-between text-xs text-muted">
                        <span>{totalItems()} total items</span>
                        <div class="flex items-center gap-1">
                            <div class={`w-2 h-2 rounded-full ${isInstalling() ? 'bg-accent animate-pulse' : 'bg-green-500'}`} />
                            <span>{isInstalling() ? 'Installing' : 'Ready'}</span>
                        </div>
                    </div>
                </div>
            </div>
        </Show>
    );
}
