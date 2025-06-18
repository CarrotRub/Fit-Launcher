import { createSignal, onMount, createEffect, Show } from "solid-js";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { message, open } from "@tauri-apps/plugin-dialog";
import { Select } from "@thisbeyond/solid-select";
import { copyFile, mkdir, readDir, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { appDataDir, basename, dirname, join } from "@tauri-apps/api/path";
import { load } from "@tauri-apps/plugin-store";
import { DefaultTheme, defaultThemes } from "../../../../../types/theme";
import type { GamehubSettings } from "../../../../../bindings";
import { SettingsSectionProps } from "../../../../../types/settings/types";
import LoadingPage from "../../../../LoadingPage-01/LoadingPage";
import PageGroup from "../../Components/PageGroup";
import LabelCheckboxSettings from "../../Components/UI/LabelCheckbox/LabelCheckbox";
import LabelDropdownSettings from "../../Components/UI/LabelDropdown/LabelDropdown";
import LabelButtonSettings from "../../Components/UI/LabelButton/LabelButton";
import LabelRangeSettings from "../../Components/UI/LabelRange/LabelRange";
import { ThemeManagerAPI } from "../../../../../api/theme/api";


export default function DisplayPart({
  settings,
  handleSwitchCheckChange
}: SettingsSectionProps<GamehubSettings>) {
  return (
    <Show when={settings} fallback={<LoadingPage />}>
      <PageGroup title="Display Settings">
        <DisplayPartContent settings={settings} handleSwitchCheckChange={handleSwitchCheckChange} />
      </PageGroup>
    </Show>
  )
}


const themeAPI = new ThemeManagerAPI();

function DisplayPartContent({
  settings,
  handleSwitchCheckChange
}: SettingsSectionProps<GamehubSettings>) {
  const [newThemes, setNewThemes] = createSignal<string[]>([]);
  const [currentTheme, setCurrentTheme] = createSignal<string>("Default Dark Purple");
  const [blurAmount, setBlurAmount] = createSignal<number>(5);
  const [bgApplied, setBgApplied] = createSignal<boolean>(false);

  onMount(async () => {
    try {
      const allThemes = await themeAPI.getAllThemes();
      setNewThemes(allThemes.filter(t => !defaultThemes.includes(t as DefaultTheme)));

      await themeAPI.applyStoredTheme();

      const stored = await themeAPI.loadBackgroundState();
      setBlurAmount(stored.blur);
      setBgApplied(stored.applied);

      const savedThemeKey = localStorage.getItem("theme");
      const savedThemeDisplay = savedThemeKey
        ? savedThemeKey.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())
        : "Default Dark Purple";
      setCurrentTheme(savedThemeDisplay);
    } catch (err) {
      console.error("Failed to initialize display settings", err);
    }
  });

  createEffect(() => {
    const el = document.querySelector(".background-blur-whole") as HTMLElement | null;
    if (el) el.style.backdropFilter = `blur(${blurAmount()}px)`;
    load("background_store.json", { autoSave: false }).then(store => {
      store.set("blur_amount", blurAmount());
    });
  });

  return (
    <>
      <LabelCheckboxSettings
        text="Hide NSFW Content"
        typeText="Hides any NSFW content everywhere except in downloaded games"
        action={() => handleSwitchCheckChange?.("display.nsfw_censorship")}
        checked={settings().nsfw_censorship}
      />
      <LabelCheckboxSettings
        text="Automatically Get Colors"
        typeText="Gets the color of the games in Popular Games, can slow down the process."
        action={() => handleSwitchCheckChange?.("display.auto_get_colors_popular_games")}
        checked={settings().auto_get_colors_popular_games}
      />
      <LabelDropdownSettings
        text="Change Themes"
        typeText="Change themes as you want, you can even add your own!"
        list={[...defaultThemes, ...newThemes()]}
        activeItem={currentTheme()}
        onListChange={async (selected) => {
          await themeAPI.applyTheme(selected);
          setCurrentTheme(selected);
        }}
        placeholder={currentTheme()}
        action={async () => {
          await themeAPI.addCustomTheme();
          const allThemes = await themeAPI.getAllThemes();
          setNewThemes(allThemes.filter(t => !defaultThemes.includes(t as DefaultTheme)));
        }}
        variants="bordered"
        removableList={newThemes()}
        onRemove={async (themeName) => {
          await themeAPI.removeCustomTheme(themeName);
          const allThemes = await themeAPI.getAllThemes();
          setNewThemes(allThemes.filter(t => !defaultThemes.includes(t as DefaultTheme)));

          // If the current theme was just removed, reset to default
          if (currentTheme() === themeName) {
            await themeAPI.revertToDefault();
            setCurrentTheme("Default Dark Purple");
          }
        }}
      />
      <LabelButtonSettings
        text="Add Background Image"
        typeText="Disabled for now, too unpredictable"
        action={async () => {
          await themeAPI.chooseAndSetBackgroundImage(blurAmount());
          setBgApplied(true);
        }}
        buttonLabel="+"
        disabled={true}
      />
      <LabelRangeSettings
        text="Change Background Blur"
        typeText="Only works when an image is chosen"
        min={0}
        max={50}
        value={blurAmount()}
        onInput={(val) => setBlurAmount(val)}
        disabled={true}
      />
    </>
  );
}
