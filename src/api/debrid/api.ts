import { commands } from "../../bindings";

/**
 * Provider information from the backend
 */
export type ProviderInfo = {
  id: string;
  name: string;
  website_url: string;
};

/**
 * Subscription information from a debrid provider
 */
export type SubscriptionInfo = {
  is_premium: boolean;
  expires_at: string | null;
  points: number | null;
  username: string | null;
};

/**
 * Stored credentials for a provider
 */
export type StoredCredentials = {
  provider_id: string;
  api_key_encoded: string;
  enabled: boolean;
};

/**
 * Debrid settings
 */
export type DebridSettings = {
  default_provider: string | null;
  auto_fallback: boolean;
};

/**
 * Debrid API wrapper for frontend use
 */
export const DebridApi = {
  /**
   * List all available debrid providers
   */
  async listProviders(): Promise<ProviderInfo[]> {
    try {
      const result = await commands.debridListProviders();
      return result as ProviderInfo[];
    } catch (error) {
      console.error("Failed to list providers:", error);
      return [];
    }
  },

  /**
   * Validate an API key for a provider
   */
  async validateApiKey(providerId: string, apiKey: string): Promise<boolean> {
    try {
      const result = await commands.debridValidateApiKey(providerId, apiKey);
      if (result.status === "ok") {
        return result.data;
      }
      console.error("API key validation error:", result.error);
      return false;
    } catch (error) {
      console.error("Failed to validate API key:", error);
      return false;
    }
  },

  /**
   * Get subscription information for a provider
   */
  async getSubscription(
    providerId: string,
    apiKey: string
  ): Promise<SubscriptionInfo | null> {
    try {
      const result = await commands.debridGetSubscription(providerId, apiKey);
      if (result.status === "ok") {
        return result.data as SubscriptionInfo;
      }
      console.error("Subscription error:", result.error);
      return null;
    } catch (error) {
      console.error("Failed to get subscription:", error);
      return null;
    }
  },

  /**
   * Check if a magnet is cached (instant available) on a provider
   */
  async isCached(
    providerId: string,
    apiKey: string,
    magnet: string
  ): Promise<boolean> {
    try {
      const result = await commands.debridIsCached(providerId, apiKey, magnet);
      if (result.status === "ok") {
        return result.data;
      }
      return false;
    } catch (error) {
      console.error("Failed to check cache:", error);
      return false;
    }
  },

  /**
   * Save credentials for a provider
   */
  async saveCredentials(
    providerId: string,
    apiKey: string,
    enabled: boolean
  ): Promise<boolean> {
    try {
      const result = await commands.debridSaveCredentials(
        providerId,
        apiKey,
        enabled
      );
      return result.status === "ok";
    } catch (error) {
      console.error("Failed to save credentials:", error);
      return false;
    }
  },

  /**
   * Get credentials for a provider (note: api_key is encoded)
   */
  async getCredentials(providerId: string): Promise<StoredCredentials | null> {
    try {
      const result = await commands.debridGetCredentials(providerId);
      if (result.status === "ok") {
        return result.data as StoredCredentials | null;
      }
      return null;
    } catch (error) {
      console.error("Failed to get credentials:", error);
      return null;
    }
  },

  /**
   * Get the decoded API key for a provider
   */
  async getApiKey(providerId: string): Promise<string | null> {
    try {
      const result = await commands.debridGetApiKey(providerId);
      if (result.status === "ok") {
        return result.data;
      }
      return null;
    } catch (error) {
      console.error("Failed to get API key:", error);
      return null;
    }
  },

  /**
   * List all configured providers (those with saved credentials)
   */
  async listConfiguredProviders(): Promise<StoredCredentials[]> {
    try {
      const result = await commands.debridListConfiguredProviders();
      if (result.status === "ok") {
        return result.data as StoredCredentials[];
      }
      return [];
    } catch (error) {
      console.error("Failed to list configured providers:", error);
      return [];
    }
  },

  /**
   * Remove credentials for a provider
   */
  async removeCredentials(providerId: string): Promise<boolean> {
    try {
      const result = await commands.debridRemoveCredentials(providerId);
      return result.status === "ok";
    } catch (error) {
      console.error("Failed to remove credentials:", error);
      return false;
    }
  },

  /**
   * Get debrid settings
   */
  async getSettings(): Promise<DebridSettings> {
    try {
      const result = await commands.debridGetSettings();
      if (result.status === "ok") {
        return result.data as DebridSettings;
      }
      return { default_provider: null, auto_fallback: false };
    } catch (error) {
      console.error("Failed to get settings:", error);
      return { default_provider: null, auto_fallback: false };
    }
  },

  /**
   * Save debrid settings
   */
  async saveSettings(settings: DebridSettings): Promise<boolean> {
    try {
      const result = await commands.debridSaveSettings(settings);
      return result.status === "ok";
    } catch (error) {
      console.error("Failed to save settings:", error);
      return false;
    }
  },

  /**
   * Set the default provider
   */
  async setDefaultProvider(providerId: string | null): Promise<boolean> {
    try {
      const result = await commands.debridSetDefaultProvider(providerId);
      return result.status === "ok";
    } catch (error) {
      console.error("Failed to set default provider:", error);
      return false;
    }
  },

  /**
   * Check if any provider is configured and enabled
   */
  async hasConfiguredProvider(): Promise<boolean> {
    try {
      const result = await commands.debridHasConfiguredProvider();
      if (result.status === "ok") {
        return result.data;
      }
      return false;
    } catch (error) {
      console.error("Failed to check configured provider:", error);
      return false;
    }
  },

  /**
   * Get the list of enabled providers with their info
   */
  async getEnabledProviders(): Promise<
    Array<ProviderInfo & { credentials: StoredCredentials }>
  > {
    const providers = await this.listProviders();
    const configured = await this.listConfiguredProviders();

    const enabled: Array<ProviderInfo & { credentials: StoredCredentials }> =
      [];

    for (const cred of configured) {
      if (cred.enabled) {
        const providerInfo = providers.find((p) => p.id === cred.provider_id);
        if (providerInfo) {
          enabled.push({ ...providerInfo, credentials: cred });
        }
      }
    }

    return enabled;
  },
};

