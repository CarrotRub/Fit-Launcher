import { createSignal, onMount, createEffect, Show } from "solid-js";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { message, open } from "@tauri-apps/plugin-dialog";
import { Select } from "@thisbeyond/solid-select";
import { copyFile, mkdir, readDir, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { appDataDir, basename, dirname, join } from "@tauri-apps/api/path";
import { load } from "@tauri-apps/plugin-store";
import { defaultThemes } from "../../../../../types/theme";
import type { GamehubSettings } from "../../../../../bindings";
import { SettingsSectionProps } from "../../../../../types/settings/types";
import LoadingPage from "../../../../LoadingPage-01/LoadingPage";
import PageGroup from "../../Components/PageGroup";
import LabelCheckboxSettings from "../../Components/UI/LabelCheckbox/LabelCheckbox";
import LabelDropdownSettings from "../../Components/UI/LabelDropdown/LabelDropdown";
import LabelButtonSettings from "../../Components/UI/LabelButton/LabelButton";
import LabelRangeSettings from "../../Components/UI/LabelRange/LabelRange";


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

function DisplayPartContent({
  settings,
  handleSwitchCheckChange
}: SettingsSectionProps<GamehubSettings>) {

  const [newThemes, setNewThemes] = createSignal<string[]>([]);
  const [currentTheme, setCurrentTheme] = createSignal<string>(defaultThemes[0]);
  const [blurAmount, setBlurAmount] = createSignal<number>(5);
  const [bgApplied, setBgApplied] = createSignal<boolean>(false);

  onMount(async () => {
    try {
      const themesDir = await join(await appDataDir(), "themes");
      await mkdir(themesDir, { recursive: true });

      const themeFiles = await readDir(themesDir);
      const loadedThemes = themeFiles
        .filter(file => file.name?.endsWith(".css"))
        .map(file =>
          file.name!
            .replace(".css", "")
            .replace(/-/g, " ")
            .replace(/\b\w/g, char => char.toUpperCase())
        );

      setNewThemes(loadedThemes);

      const defaultThemeKeys = defaultThemes.map(t => t.replace(/\s+/g, "-").toLowerCase());
      const savedTheme = localStorage.getItem("theme") || defaultThemeKeys[0];

      if (defaultThemeKeys.includes(savedTheme)) {
        document.documentElement.setAttribute("data-theme", savedTheme);
        setCurrentTheme(defaultThemes[defaultThemeKeys.indexOf(savedTheme)]);
      } else {
        setCurrentTheme(savedTheme.replace(/-/g, " ").replace(/\b\w/g, char => char.toUpperCase()));
        await applyTheme(savedTheme);
      }

      const bgStore = await load('background_store.json', { autoSave: false });
      const bgPath = await bgStore.get<string>('background_image');
      const bgBlur = await bgStore.get<number>('blur_amount');

      setBgApplied(!!bgPath);
      setBlurAmount(bgBlur ?? 5);
    } catch (err) {
      await message(`Failed to load background/theme info:\n${err}`, {
        title: "FitLauncher",
        kind: "error"
      });
    }
  });
  //TODO: Add this to theme ts api
  async function applyTheme(themeName: string) {
    const themeKey = themeName.replace(/\s+/g, "-").toLowerCase();
    const isDefault = defaultThemes
      .map(t => t.replace(/\s+/g, "-").toLowerCase())
      .includes(themeKey);

    try {
      if (isDefault) {
        document.documentElement.setAttribute("data-theme", themeKey);
      } else {
        const themePath = await join(await appDataDir(), "themes", `${themeKey}.css`);
        const themeContent = await readTextFile(themePath);

        let styleEl = document.getElementById("theme-style") || document.createElement("style");
        if (!styleEl.id) {
          styleEl.id = "theme-style";
          document.head.appendChild(styleEl);
        }
        styleEl.textContent = themeContent;

        document.documentElement.setAttribute("data-theme", themeKey);
      }
      localStorage.setItem("theme", themeKey);
    } catch (e) {
      console.error("Failed to apply theme", e);
      await revertToDefault();
    }
  }

  async function revertToDefault() {
    const fallback = "default-dark-purple";
    document.documentElement.setAttribute("data-theme", fallback);
    localStorage.setItem("theme", fallback);
    setCurrentTheme("Default Dark Purple");
  }

  async function handleAddTheme() {
    const requiredVars = [
      "--accent-color", "--secondary-color", "--secondary-30-selected-color",
      "--non-selected-text-color", "--primary-color", "--secondary-20-color",
      "--text-color", "--background-color", "--70-background-color",
      "--30-background-color", "--popup-background-color",
      "--resume-button-accent-color", "--warning-orange"
    ];

    const themeRegex = /^[a-z0-9-]{1,40}$/;
    const blockRegex = /:root\[data-theme="([a-z0-9-]{1,40})"\]\s*{([^}]+)}/;

    try {
      const filePath = await open({
        directory: false,
        multiple: false,
        filters: [{ name: "CSS", extensions: ["css"] }]
      });

      if (!filePath) return;

      const content = await readTextFile(filePath as string);
      const match = content.match(blockRegex);

      if (!match) {
        return await message("Invalid theme block format", { title: "FitLauncher", kind: "error" });
      }

      const [_, themeName, variables] = match;
      if (!themeRegex.test(themeName)) {
        return await message("Theme name must be lowercase, alphanumeric or hyphen, max 40 chars", {
          title: "FitLauncher", kind: "error"
        });
      }

      const valid = requiredVars.every(v => variables.includes(v));
      if (!valid) {
        return await message("Missing required variables in theme", {
          title: "FitLauncher", kind: "error"
        });
      }

      const saveDir = await join(await appDataDir(), "themes");
      await mkdir(saveDir, { recursive: true });
      const fullPath = await join(saveDir, `${themeName}.css`);
      await writeTextFile(fullPath, content);

      const displayName = themeName.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
      setNewThemes([...newThemes(), displayName]);

      await message("Theme added successfully!", {
        title: "FitLauncher",
        kind: "info"
      });

    } catch (e) {
      console.error("Error adding theme:", e);
      await message("Could not add theme.", { title: "FitLauncher", kind: "error" });
    }
  }

  async function addBackgroundImage(imagePath: string) {
    const bgEl = document.querySelector(".background-style") as HTMLElement | null;
    const blurEl = document.querySelector(".background-blur-whole") as HTMLElement | null;

    if (!imagePath || !bgEl || !blurEl) return;

    const imageName = await basename(imagePath);
    const targetPath = await join(await appDataDir(), "backgroundImages", imageName);
    await mkdir(await dirname(targetPath), { recursive: true });
    await copyFile(imagePath, targetPath);

    await invoke('allow_dir', { path: targetPath });
    const store = await load('background_store.json', { autoSave: false });
    await store.set('background_image', targetPath);
    await store.set('blur_amount', blurAmount());

    const link = await store.get<string>('background_image');
    if (link) {
      bgEl.style.backgroundImage = `url(${convertFileSrc(link)})`;
      blurEl.style.backdropFilter = `blur(${blurAmount()}px)`;
    }
  }

  async function handleAddBackgroundImage() {
    const imagePath = await open({
      multiple: false,
      filters: [{ name: "Image", extensions: ["png", "jpeg", "jpg", "webp"] }]
    });

    if (typeof imagePath === "string") {
      await addBackgroundImage(imagePath);
      setBgApplied(true);
    }
  }

  async function handleRemoveBackground() {
    const store = await load('background_store.json', { autoSave: false });
    await store.set('background_image', '');
    await store.set('blur_amount', 0);
    window.location.reload();
  }

  createEffect(() => {
    const blurEl = document.querySelector(".background-blur-whole") as HTMLElement;
    if (blurEl) {
      blurEl.style.backdropFilter = `blur(${blurAmount()}px)`;
    }

    load('background_store.json', { autoSave: false }).then(store => {
      if (blurAmount() != null) {
        store.set("blur_amount", blurAmount());
      }
    });
  });

  return (
    <>
      <LabelCheckboxSettings
        text="Hide NSFW Content"
        typeText="Hides any NSFW content everywhere except in downloaded games"
        action={() => handleSwitchCheckChange?.("display.nsfw_censorship")}
        checked={settings().nsfw_censorship} />
      <LabelCheckboxSettings
        text="Automatically Get Colors"
        typeText="Gets the color of the games in Popular Games, can slow down the process."
        action={() => handleSwitchCheckChange?.("display.auto_get_colors_popular_games")}
        checked={settings().auto_get_colors_popular_games} />
      <LabelDropdownSettings
        text="Change Themes"
        typeText="Change themes as you want, you can even add your own !"
        list={[...defaultThemes, ...newThemes()]}
        activeItem={currentTheme()}
        onListChange={async (selected) => {
          const themeKey = selected.replace(/\s+/g, "-").toLowerCase();
          await applyTheme(themeKey);
          setCurrentTheme(selected);
        }}
        placeholder={currentTheme()}
        action={handleAddTheme}
        variants="bordered"
      />
      <LabelButtonSettings
        text="Add Background Image"
        typeText="Disabled for now, too unpredictable"
        action={handleAddBackgroundImage}
        buttonLabel="+"
        disabled={true}
      />
      <LabelRangeSettings
        text="Change Background Blur"
        typeText="Only work when an image is chosen"
        min={0}
        max={50}
        value={blurAmount()}
        onInput={(e) => setBlurAmount(e.valueOf())}
        disabled={true}
      />
    </>
  );
}