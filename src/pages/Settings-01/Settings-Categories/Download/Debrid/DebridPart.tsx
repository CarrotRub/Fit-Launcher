import { createSignal, createEffect, For, Show, onMount, type JSX } from "solid-js";
import PageGroup from "../../Components/PageGroup";
import { DebridApi, ProviderInfo, StoredCredentials, SubscriptionInfo } from "../../../../../api/debrid/api";
import Button from "../../../../../components/UI/Button/Button";
import { CheckCircle, XCircle, Loader2, ExternalLink, Clock } from "lucide-solid";

type ProviderState = {
  provider: ProviderInfo;
  credentials: StoredCredentials | null;
  apiKey: string;
  enabled: boolean;
  subscription: SubscriptionInfo | null;
  validating: boolean;
  validated: boolean;
  error: string | null;
};

export default function DebridPart(): JSX.Element {
  const [providers, setProviders] = createSignal<ProviderState[]>([]);
  const [loading, setLoading] = createSignal(true);

  onMount(async () => {
    await loadProviders();
  });

  async function loadProviders() {
    setLoading(true);
    try {
      const providerList = await DebridApi.listProviders();
      const configured = await DebridApi.listConfiguredProviders();

      const states: ProviderState[] = [];
      for (const provider of providerList) {
        const cred = configured.find((c) => c.provider_id === provider.id);
        let apiKey = "";
        
        // Get the decoded API key if credentials exist
        if (cred) {
          const key = await DebridApi.getApiKey(provider.id);
          apiKey = key || "";
        }

        states.push({
          provider,
          credentials: cred || null,
          apiKey,
          enabled: cred?.enabled || false,
          subscription: null,
          validating: false,
          validated: false,
          error: null,
        });
      }
      setProviders(states);
    } catch (error) {
      console.error("Failed to load providers:", error);
    } finally {
      setLoading(false);
    }
  }

  function updateProvider(id: string, updates: Partial<ProviderState>) {
    setProviders((prev) =>
      prev.map((p) =>
        p.provider.id === id ? { ...p, ...updates } : p
      )
    );
  }

  async function handleTestConnection(providerId: string) {
    const state = providers().find((p) => p.provider.id === providerId);
    if (!state || !state.apiKey) return;

    updateProvider(providerId, { validating: true, error: null, subscription: null, validated: false });

    try {
      const isValid = await DebridApi.validateApiKey(providerId, state.apiKey);
      if (isValid) {
        const sub = await DebridApi.getSubscription(providerId, state.apiKey);
        updateProvider(providerId, { 
          subscription: sub, 
          validated: true, 
          validating: false,
          error: null
        });
      } else {
        updateProvider(providerId, { 
          validated: false, 
          validating: false, 
          error: "Invalid API key" 
        });
      }
    } catch (error) {
      updateProvider(providerId, { 
        validated: false, 
        validating: false, 
        error: "Connection failed" 
      });
    }
  }

  async function handleSave(providerId: string) {
    const state = providers().find((p) => p.provider.id === providerId);
    if (!state) return;

    const success = await DebridApi.saveCredentials(
      providerId,
      state.apiKey,
      state.enabled
    );

    if (success) {
      updateProvider(providerId, { 
        credentials: { 
          provider_id: providerId, 
          api_key_encoded: "", 
          enabled: state.enabled 
        } 
      });
    }
  }

  async function handleRemove(providerId: string) {
    const success = await DebridApi.removeCredentials(providerId);
    if (success) {
      updateProvider(providerId, { 
        credentials: null, 
        apiKey: "", 
        enabled: false, 
        subscription: null, 
        validated: false 
      });
    }
  }

  return (
    <PageGroup title="Debrid Services">
      <p class="text-muted text-sm mb-4">
        Configure debrid services for faster downloads. Debrid services convert torrent links 
        to direct download links, providing faster speeds without requiring a VPN.
      </p>

      <Show when={!loading()} fallback={
        <div class="flex items-center justify-center py-8">
          <Loader2 class="w-6 h-6 animate-spin text-accent" />
          <span class="ml-2 text-muted">Loading providers...</span>
        </div>
      }>
        <div class="flex flex-col gap-4">
          <For each={providers()}>
            {(state) => (
              <ProviderCard
                state={state}
                onApiKeyChange={(key) => updateProvider(state.provider.id, { apiKey: key })}
                onEnabledChange={(enabled) => updateProvider(state.provider.id, { enabled })}
                onTest={() => handleTestConnection(state.provider.id)}
                onSave={() => handleSave(state.provider.id)}
                onRemove={() => handleRemove(state.provider.id)}
              />
            )}
          </For>
        </div>
      </Show>
    </PageGroup>
  );
}

type ProviderCardProps = {
  state: ProviderState;
  onApiKeyChange: (key: string) => void;
  onEnabledChange: (enabled: boolean) => void;
  onTest: () => void;
  onSave: () => void;
  onRemove: () => void;
};

function ProviderCard(props: ProviderCardProps): JSX.Element {
  const { state } = props;

  return (
    <div class="bg-background-30 rounded-lg border border-secondary-20 p-4">
      {/* Header */}
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-secondary-20 flex items-center justify-center">
            <span class="text-lg font-bold text-accent">
              {state.provider.name.charAt(0)}
            </span>
          </div>
          <div>
            <h3 class="font-semibold text-text">{state.provider.name}</h3>
            <a 
              href={state.provider.website_url} 
              target="_blank" 
              rel="noopener noreferrer"
              class="text-xs text-muted hover:text-accent flex items-center gap-1"
            >
              {state.provider.website_url.replace(/^https?:\/\//, '')}
              <ExternalLink class="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Status indicator */}
        <div class="flex items-center gap-2">
          <Show when={state.validated}>
            <span class="flex items-center gap-1 text-green-500 text-sm">
              <CheckCircle class="w-4 h-4" />
              Connected
            </span>
          </Show>
          <Show when={state.error}>
            <span class="flex items-center gap-1 text-red-500 text-sm">
              <XCircle class="w-4 h-4" />
              {state.error}
            </span>
          </Show>
        </div>
      </div>

      {/* API Key Input */}
      <div class="mb-4">
        <label class="block text-sm text-muted mb-1">API Key</label>
        <input
          type="password"
          value={state.apiKey}
          onInput={(e) => props.onApiKeyChange(e.currentTarget.value)}
          placeholder="Enter your API key"
          class="w-full bg-background border border-secondary-20 rounded-lg px-3 py-2 text-text placeholder-muted focus:border-accent focus:outline-none transition-colors"
        />
      </div>

      {/* Enable Toggle */}
      <div class="flex items-center justify-between mb-4">
        <span class="text-sm text-text">Enable this provider</span>
        <label class="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={state.enabled}
            onChange={(e) => props.onEnabledChange(e.currentTarget.checked)}
            class="sr-only peer"
          />
          <div class="w-11 h-6 bg-secondary-20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
        </label>
      </div>

      {/* Subscription Info */}
      <Show when={state.subscription}>
        <div class="bg-background/50 rounded-lg p-3 mb-4 border border-secondary-20">
          <div class="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span class="text-muted">Username:</span>
              <span class="text-text ml-2">{state.subscription?.username || "N/A"}</span>
            </div>
            <div>
              <span class="text-muted">Status:</span>
              <span class={`ml-2 ${state.subscription?.is_premium ? "text-green-500" : "text-yellow-500"}`}>
                {state.subscription?.is_premium ? "Premium" : "Free"}
              </span>
            </div>
            <Show when={state.subscription?.expires_at}>
              <div class="col-span-2 flex items-center gap-1">
                <Clock class="w-4 h-4 text-muted" />
                <span class="text-muted">Expires:</span>
                <span class="text-text ml-1">
                  {new Date(state.subscription!.expires_at!).toLocaleDateString()}
                </span>
              </div>
            </Show>
            <Show when={state.subscription?.points !== null && state.subscription?.points !== undefined}>
              <div>
                <span class="text-muted">Points:</span>
                <span class="text-text ml-2">{state.subscription?.points}</span>
              </div>
            </Show>
          </div>
        </div>
      </Show>

      {/* Actions */}
      <div class="flex items-center gap-2">
        <Button
          onClick={props.onTest}
          label={state.validating ? "Testing..." : "Test Connection"}
          variant="outline"
          disabled={!state.apiKey || state.validating}
        />
        <Button
          onClick={props.onSave}
          label="Save"
          variant="solid"
          disabled={!state.apiKey}
        />
        <Show when={state.credentials}>
          <Button
            onClick={props.onRemove}
            label="Remove"
            variant="outline"
          />
        </Show>
      </div>
    </div>
  );
}

