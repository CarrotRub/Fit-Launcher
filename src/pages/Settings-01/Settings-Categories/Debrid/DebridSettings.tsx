import { createSignal, For, onMount, Show } from "solid-js";
import type { JSX } from "solid-js";
import { message } from "@tauri-apps/plugin-dialog";
import {
    Zap,
    Key,
    CheckCircle,
    XCircle,
    Eye,
    EyeOff,
    Trash2,
    ExternalLink,
    Loader2,
    Shield,
    Info
} from "lucide-solid";

import * as Debrid from "../../../../api/debrid/api";
import { CREDENTIAL_STORE_SALT } from "../../../../api/debrid/api";
import type { DebridProvider, DebridProviderInfo, CredentialStatus } from "../../../../bindings";
import Button from "../../../../components/UI/Button/Button";
import LoadingPage from "../../../LoadingPage-01/LoadingPage";

type ProviderState = {
    hasCredential: boolean;
    status: CredentialStatus | null;
    loading: boolean;
    showApiKey: boolean;
    apiKeyInput: string;
};

function DebridSettingsPage(): JSX.Element {
    const [initialized, setInitialized] = createSignal(false);
    const [initializing, setInitializing] = createSignal(true);
    const [initError, setInitError] = createSignal<string | null>(null);
    const [providers, setProviders] = createSignal<DebridProviderInfo[]>([]);
    const [providerStates, setProviderStates] = createSignal<Map<DebridProvider, ProviderState>>(new Map());

    onMount(async () => {
        // Load providers from Rust (source of truth)
        const providerList = await Debrid.listProviders();
        setProviders(providerList);

        const success = await initializeCredentials();
        if (success) {
            await loadProviderStates();
        }
    });

    async function initializeCredentials(): Promise<boolean> {
        setInitializing(true);
        setInitError(null);
        try {
            console.log("[Debrid] Initializing credential store...");
            // Initialize the credential store with a derived password
            const result = await Debrid.initCredentials(CREDENTIAL_STORE_SALT);
            console.log("[Debrid] Init result:", result);
            if (result.status === "ok") {
                console.log("[Debrid] Credential store initialized successfully");
                setInitialized(true);
                return true;
            } else {
                const errorMsg = typeof result.error === "string"
                    ? result.error
                    : JSON.stringify(result.error);
                console.error("[Debrid] Failed to initialize credentials:", errorMsg);
                setInitError(`Failed to initialize secure storage: ${errorMsg}`);
                return false;
            }
        } catch (e) {
            console.error("[Debrid] Exception during credential store init:", e);
            setInitError(`Failed to initialize secure storage: ${e}`);
            return false;
        } finally {
            setInitializing(false);
        }
    }

    async function retryInitialization() {
        const success = await initializeCredentials();
        if (success) {
            await loadProviderStates();
        }
    }

    async function loadProviderStates() {
        console.log("[Debrid] Loading provider states...");
        const states = new Map<DebridProvider, ProviderState>();

        for (const provider of providers()) {
            const state: ProviderState = {
                hasCredential: false,
                status: null,
                loading: false,
                showApiKey: false,
                apiKeyInput: ""
            };

            try {
                const hasResult = await Debrid.hasCredential(provider.id);
                console.log(`[Debrid] hasCredential(${provider.id}):`, hasResult);
                if (hasResult.status === "ok") {
                    state.hasCredential = hasResult.data;
                } else if (hasResult.status === "error") {
                    // If we get NotInitialized here, something is wrong
                    console.error(`[Debrid] hasCredential failed for ${provider.id}:`, hasResult.error);
                    if (hasResult.error === "NotInitialized") {
                        setInitialized(false);
                        setInitError("Credential store was lost. Please retry initialization.");
                        return;
                    }
                }

                if (state.hasCredential) {
                    const statusResult = await Debrid.getCredentialStatus(provider.id);
                    if (statusResult.status === "ok") {
                        state.status = statusResult.data;
                    }
                }
            } catch (e) {
                console.error(`[Debrid] Failed to load state for ${provider.id}:`, e);
            }

            states.set(provider.id, state);
        }

        console.log("[Debrid] Provider states loaded:", states);
        setProviderStates(states);
    }

    function updateProviderState(providerId: DebridProvider, updates: Partial<ProviderState>) {
        setProviderStates(prev => {
            const newMap = new Map(prev);
            const current = newMap.get(providerId) || {
                hasCredential: false,
                status: null,
                loading: false,
                showApiKey: false,
                apiKeyInput: ""
            };
            newMap.set(providerId, { ...current, ...updates });
            return newMap;
        });
    }

    async function handleSaveApiKey(providerId: DebridProvider) {
        const state = providerStates().get(providerId);
        if (!state || !state.apiKeyInput.trim()) return;

        // Make sure we're initialized before trying to save
        if (!initialized()) {
            await message("Credential store not initialized. Please wait or retry.", {
                title: "Error",
                kind: "error"
            });
            return;
        }

        updateProviderState(providerId, { loading: true });

        try {
            console.log(`[Debrid] Storing API key for ${providerId}...`);
            const result = await Debrid.storeCredential(providerId, state.apiKeyInput.trim());
            console.log(`[Debrid] Store result:`, result);
            if (result.status === "ok") {
                await message(`API key saved for ${getProviderName(providerId)}!`, {
                    title: "Success",
                    kind: "info"
                });
                updateProviderState(providerId, {
                    hasCredential: true,
                    apiKeyInput: "",
                    showApiKey: false
                });

                // Reload status
                const statusResult = await Debrid.getCredentialStatus(providerId);
                if (statusResult.status === "ok") {
                    updateProviderState(providerId, { status: statusResult.data });
                }
            } else {
                await message(`Failed to save API key: ${result.error}`, {
                    title: "Error",
                    kind: "error"
                });
            }
        } catch (e) {
            await message(`Error saving API key: ${e}`, {
                title: "Error",
                kind: "error"
            });
        } finally {
            updateProviderState(providerId, { loading: false });
        }
    }

    async function handleRemoveApiKey(providerId: DebridProvider) {
        updateProviderState(providerId, { loading: true });

        try {
            const result = await Debrid.removeCredential(providerId);
            if (result.status === "ok") {
                await message(`API key removed for ${getProviderName(providerId)}`, {
                    title: "Success",
                    kind: "info"
                });
                updateProviderState(providerId, {
                    hasCredential: false,
                    status: null,
                    apiKeyInput: ""
                });
            } else {
                await message(`Failed to remove API key: ${result.error}`, {
                    title: "Error",
                    kind: "error"
                });
            }
        } catch (e) {
            await message(`Error removing API key: ${e}`, {
                title: "Error",
                kind: "error"
            });
        } finally {
            updateProviderState(providerId, { loading: false });
        }
    }

    function getProviderName(id: DebridProvider): string {
        return providers().find(p => p.id === id)?.name || id;
    }

    return (
        <Show when={!initializing()} fallback={<LoadingPage />}>
            <div class="flex flex-col gap-6 h-full w-auto p-3">
                {/* Header */}
                <div class="flex flex-col gap-2">
                    <div class="flex items-center gap-3">
                        <div class="p-2 bg-accent/10 rounded-lg">
                            <Zap class="w-6 h-6 text-accent" />
                        </div>
                        <div>
                            <h1 class="text-2xl font-bold text-text">Debrid Services</h1>
                            <p class="text-sm text-muted">Configure your premium debrid providers for instant cached downloads</p>
                        </div>
                    </div>
                </div>

                {/* Initialization Error */}
                <Show when={initError()}>
                    <div class="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-start gap-3">
                        <XCircle class="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                        <div class="flex-1">
                            <p class="text-sm font-medium text-red-400 mb-1">Initialization Failed</p>
                            <p class="text-sm text-red-300/80">{initError()}</p>
                            <button
                                onClick={retryInitialization}
                                class="mt-2 px-3 py-1.5 text-sm bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
                            >
                                Retry Initialization
                            </button>
                        </div>
                    </div>
                </Show>

                {/* Info Box */}
                <Show when={initialized()}>
                    <div class="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 flex items-start gap-3">
                        <Info class="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                        <div class="text-sm text-blue-200">
                            <p class="font-medium mb-1">What are Debrid Services?</p>
                            <p class="text-blue-300/80">
                                Debrid services cache torrents on their servers. If a torrent is already cached,
                                you can download it instantly via direct download - no seeding required, maximum speed!
                            </p>
                        </div>
                    </div>
                </Show>

                {/* Security Notice */}
                <Show when={initialized()}>
                    <div class="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 flex items-start gap-3">
                        <Shield class="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                        <div class="text-sm text-emerald-200">
                            <p class="font-medium mb-1">Secure Storage</p>
                            <p class="text-emerald-300/80">
                                Your API keys are encrypted and stored securely using IOTA Stronghold -
                                the same technology used in cryptocurrency wallets.
                            </p>
                        </div>
                    </div>
                </Show>

                {/* Provider Cards */}
                <Show when={initialized()}>
                    <div class="flex flex-col gap-4">
                        <For each={providers()}>
                            {(provider) => {
                                const state = () => providerStates().get(provider.id) || {
                                    hasCredential: false,
                                    status: null,
                                    loading: false,
                                    showApiKey: false,
                                    apiKeyInput: ""
                                };

                                return (
                                    <div class={`bg-background-30 border border-secondary-20 rounded-xl p-5 transition-all hover:border-secondary-30 ${!provider.is_implemented ? 'opacity-60' : ''}`}>
                                        <div class="flex items-start justify-between gap-4">
                                            {/* Provider Info */}
                                            <div class="flex items-start gap-4">
                                                <div class={`p-3 rounded-xl bg-${provider.color}-500/10 border border-${provider.color}-500/30`}>
                                                    <Zap class={`w-6 h-6 text-${provider.color}-500`} />
                                                </div>
                                                <div class="flex flex-col gap-1">
                                                    <div class="flex items-center gap-2">
                                                        <h3 class="text-lg font-semibold text-text">{provider.name}</h3>
                                                        <Show when={!provider.is_implemented}>
                                                            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                                                                Coming Soon
                                                            </span>
                                                        </Show>
                                                    </div>
                                                    <p class="text-sm text-muted">{provider.description}</p>
                                                    <a
                                                        href={provider.website}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        class="inline-flex items-center gap-1 text-xs text-accent hover:underline mt-1"
                                                    >
                                                        <ExternalLink class="w-3 h-3" />
                                                        Get API Key from {provider.name}
                                                    </a>
                                                </div>
                                            </div>
                                        </div>

                                        {/* API Key Input Section - only show for implemented providers */}
                                        <Show when={provider.is_implemented}>
                                            <div class="mt-4 pt-4 border-t border-secondary-20">
                                                <Show when={state().hasCredential} fallback={
                                                    /* New API Key Input */
                                                    <div class="flex flex-col gap-3">
                                                        <label class="text-sm font-medium text-text">Enter API Key</label>
                                                        <div class="flex gap-2">
                                                            <div class="relative flex-1">
                                                                <Key class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                                                                <input
                                                                    type={state().showApiKey ? "text" : "password"}
                                                                    placeholder="Paste your API key here..."
                                                                    value={state().apiKeyInput}
                                                                    onInput={(e) => updateProviderState(provider.id, { apiKeyInput: e.currentTarget.value })}
                                                                    class="w-full pl-10 pr-10 py-2.5 bg-background border border-secondary-20 rounded-lg text-text placeholder:text-muted focus:border-accent focus:outline-none transition-colors"
                                                                />
                                                                <button
                                                                    onClick={() => updateProviderState(provider.id, { showApiKey: !state().showApiKey })}
                                                                    class="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-text transition-colors"
                                                                >
                                                                    <Show when={state().showApiKey} fallback={<Eye class="w-4 h-4" />}>
                                                                        <EyeOff class="w-4 h-4" />
                                                                    </Show>
                                                                </button>
                                                            </div>
                                                            <Button
                                                                onClick={() => handleSaveApiKey(provider.id)}
                                                                label={state().loading ? "Saving..." : "Save"}
                                                                variant="solid"
                                                                disabled={state().loading || !state().apiKeyInput.trim()}
                                                            />
                                                        </div>
                                                    </div>
                                                }>
                                                    {/* Configured State */}
                                                    <div class="flex items-center justify-between">
                                                        <div class="flex items-center gap-3">
                                                            <div class="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/30 rounded-lg">
                                                                <CheckCircle class="w-4 h-4 text-green-500" />
                                                                <span class="text-sm text-green-400">API Key Configured</span>
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => handleRemoveApiKey(provider.id)}
                                                            disabled={state().loading}
                                                            class="flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                                                        >
                                                            <Show when={state().loading} fallback={<Trash2 class="w-4 h-4" />}>
                                                                <Loader2 class="w-4 h-4 animate-spin" />
                                                            </Show>
                                                            Remove
                                                        </button>
                                                    </div>
                                                </Show>
                                            </div>
                                        </Show>
                                    </div>
                                );
                            }}
                        </For>
                    </div>
                </Show>
            </div>
        </Show>
    );
}

export default DebridSettingsPage;
