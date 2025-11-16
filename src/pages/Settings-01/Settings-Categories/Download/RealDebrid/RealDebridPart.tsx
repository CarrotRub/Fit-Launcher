import { createSignal, onMount, JSX } from "solid-js";
import { message } from "@tauri-apps/plugin-dialog";
import LabelCheckboxSettings from "../../Components/UI/LabelCheckbox/LabelCheckbox";
import PageGroup from "../../Components/PageGroup";
import LabelTextInputSettings from "../../Components/UI/LabelTextInput/LabelTextInput";
import { RealDebridSettings } from "../../../../../bindings";
import { RealDebridSettingsApi } from "../../../../../api/realdebrid/api";
import Button from "../../../../../components/UI/Button/Button";
import { Loader2 } from "lucide-solid";

export default function RealDebridPart(): JSX.Element {
  const [settings, setSettings] = createSignal<RealDebridSettings>({
    api_token: "",
    enabled: false,
  });
  const [loading, setLoading] = createSignal(true);
  const [saving, setSaving] = createSignal(false);
  const [testing, setTesting] = createSignal(false);

  onMount(async () => {
    try {
      const loadedSettings = await RealDebridSettingsApi.getRealDebridSettings();
      setSettings(loadedSettings);
    } catch (error) {
      console.error("Error loading Real-Debrid settings:", error);
      await message("Failed to load Real-Debrid settings", {
        title: "Error",
        kind: "error",
      });
    } finally {
      setLoading(false);
    }
  });

  const handleTokenChange = (value: string) => {
    setSettings((prev) => ({ ...prev, api_token: value }));
  };

  const handleEnabledChange = () => {
    setSettings((prev) => ({ ...prev, enabled: !prev.enabled }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await RealDebridSettingsApi.setRealDebridSettings(settings());
      if (result.status === "ok") {
        await message("Real-Debrid settings saved successfully", {
          title: "Success",
          kind: "info",
        });
      } else {
        await message(`Error saving settings: ${result.error.message}`, {
          title: "Error",
          kind: "error",
        });
      }
    } catch (error) {
      console.error("Error saving Real-Debrid settings:", error);
      await message("Failed to save Real-Debrid settings", {
        title: "Error",
        kind: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    const currentSettings = settings();
    if (!currentSettings.api_token || currentSettings.api_token.trim() === "") {
      await message("Please enter an API token first", {
        title: "Error",
        kind: "error",
      });
      return;
    }

    setTesting(true);
    try {
      // Test by trying to get user info or making a simple API call
      // For now, we'll just validate the token format (Real-Debrid tokens are typically long strings)
      if (currentSettings.api_token.length < 10) {
        await message("API token appears to be invalid (too short)", {
          title: "Error",
          kind: "error",
        });
      } else {
        await message("API token format looks valid. Note: This doesn't verify the token is active.", {
          title: "Info",
          kind: "info",
        });
      }
    } catch (error) {
      console.error("Error testing connection:", error);
      await message("Failed to test connection", {
        title: "Error",
        kind: "error",
      });
    } finally {
      setTesting(false);
    }
  };

  if (loading()) {
    return (
      <div class="flex items-center justify-center py-8">
        <Loader2 class="w-8 h-8 text-accent animate-spin" />
      </div>
    );
  }

  return (
    <PageGroup title="Real-Debrid Configuration">
      <LabelCheckboxSettings
        text="Enable Real-Debrid"
        typeText="Enable Real-Debrid integration for faster downloads via premium links"
        action={handleEnabledChange}
        checked={settings().enabled}
      />
      <li class="flex flex-col gap-2 py-3 px-4 bg-popup-background hover:bg-secondary-20 rounded-lg border border-secondary-20 transition-colors w-full">
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium text-text">API Token</label>
          <p class="text-xs text-muted">Your Real-Debrid API token. Get it from https://real-debrid.com/apitoken</p>
        </div>
        <input
          type="password"
          value={settings().api_token}
          onInput={(e) => handleTokenChange((e.target as HTMLInputElement).value)}
          placeholder="Enter your Real-Debrid API token"
          class="w-full py-2 px-4 bg-background border border-secondary-20 rounded-lg text-text placeholder:text-muted/60 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 transition-all"
        />
      </li>
      <div class="flex items-center justify-end gap-3 mt-4">
        <Button
          onClick={handleTestConnection}
          label={testing() ? "Testing..." : "Test Connection"}
          variant="bordered"
          disabled={testing() || !settings().api_token}
        />
        <Button
          onClick={handleSave}
          label={saving() ? "Saving..." : "Save"}
          variant="solid"
          disabled={saving()}
        />
      </div>
    </PageGroup>
  );
}

