import { appDataDir, join, basename, dirname } from "@tauri-apps/api/path";
import { open } from "@tauri-apps/plugin-dialog";
import { message } from "@tauri-apps/plugin-dialog";
import {
  copyFile,
  mkdir,
  readDir,
  readTextFile,
  remove,
  writeTextFile,
} from "@tauri-apps/plugin-fs";
import { defaultThemes } from "../../types/theme";
import { convertFileSrc } from "@tauri-apps/api/core";
import { load } from "@tauri-apps/plugin-store";

export class ThemeManagerApi {
  private readonly themeRegex = /^[a-z0-9-]{1,40}$/;
  private readonly blockRegex =
    /:root\[data-theme="([a-z0-9-]{1,40})"\]\s*{([^}]+)}/;
  private readonly requiredVars = [
    "--accent-color",
    "--secondary-color",
    "--secondary-30-selected-color",
    "--non-selected-text-color",
    "--primary-color",
    "--secondary-20-color",
    "--text-color",
    "--background-color",
    "--70-background-color",
    "--30-background-color",
    "--popup-background-color",
    "--resume-button-accent-color",
    "--warning-orange",
  ];

  public async getAllThemes(): Promise<string[]> {
    const themesDir = await join(await appDataDir(), "themes");
    await mkdir(themesDir, { recursive: true });

    const themeFiles = await readDir(themesDir);
    const customThemes = themeFiles
      .filter((file) => file.name?.endsWith(".css"))
      .map((file) =>
        file
          .name!.replace(".css", "")
          .replace(/-/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase())
      );

    return [...defaultThemes, ...customThemes];
  }

  public async applyTheme(themeName: string): Promise<void> {
    const themeKey = themeName.replace(/\s+/g, "-").toLowerCase();
    const isDefault = defaultThemes
      .map((t) => t.replace(/\s+/g, "-").toLowerCase())
      .includes(themeKey);

    try {
      if (isDefault) {
        document.documentElement.setAttribute("data-theme", themeKey);
      } else {
        const themePath = await join(
          await appDataDir(),
          "themes",
          `${themeKey}.css`
        );
        const themeContent = await readTextFile(themePath);

        let styleEl =
          document.getElementById("theme-style") ||
          document.createElement("style");
        if (!styleEl.id) {
          styleEl.id = "theme-style";
          document.head.appendChild(styleEl);
        }

        styleEl.textContent = themeContent;
        document.documentElement.setAttribute("data-theme", themeKey);
      }

      localStorage.setItem("theme", themeKey);
    } catch (e) {
      console.error("Failed to apply theme:", e);
      await this.revertToDefault();
    }
  }

  public async revertToDefault(): Promise<void> {
    const fallback = "default-dark-purple";
    document.documentElement.setAttribute("data-theme", fallback);
    localStorage.setItem("theme", fallback);
  }

  public async addCustomTheme(): Promise<void> {
    try {
      const filePath = await open({
        directory: false,
        multiple: false,
        filters: [{ name: "CSS", extensions: ["css"] }],
      });

      if (!filePath) return;

      const content = await readTextFile(filePath as string);
      const match = content.match(this.blockRegex);

      if (!match) {
        return await message("Invalid theme block format", {
          title: "FitLauncher",
          kind: "error",
        });
      }

      const [_, themeName, variables] = match;

      if (!this.themeRegex.test(themeName)) {
        return await message(
          "Theme name must be lowercase, alphanumeric or hyphen, max 40 chars",
          {
            title: "FitLauncher",
            kind: "error",
          }
        );
      }

      const valid = this.requiredVars.every((v) => variables.includes(v));
      if (!valid) {
        return await message("Missing required variables in theme", {
          title: "FitLauncher",
          kind: "error",
        });
      }

      const saveDir = await join(await appDataDir(), "themes");
      await mkdir(saveDir, { recursive: true });
      const fullPath = await join(saveDir, `${themeName}.css`);
      await writeTextFile(fullPath, content);

      await message("Theme added successfully!", {
        title: "FitLauncher",
        kind: "info",
      });
    } catch (e) {
      console.error("Error adding theme:", e);
      await message("Could not add theme.", {
        title: "FitLauncher",
        kind: "error",
      });
    }
  }

  public async applyStoredTheme(): Promise<void> {
    const defaultThemeKeys = defaultThemes.map((t) =>
      t.replace(/\s+/g, "-").toLowerCase()
    );

    const savedTheme = localStorage.getItem("theme") || defaultThemeKeys[0];

    if (defaultThemeKeys.includes(savedTheme)) {
      document.documentElement.setAttribute("data-theme", savedTheme);
    } else {
      const displayName = savedTheme
        .replace(/-/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
      await this.applyTheme(displayName);
    }
  }

  public async removeCustomTheme(themeName: string): Promise<void> {
    const themeKey = themeName.replace(/\s+/g, "-").toLowerCase();
    const themePath = await join(
      await appDataDir(),
      "themes",
      `${themeKey}.css`
    );
    try {
      await remove(themePath);
      await message(`Theme "${themeName}" removed.`, {
        title: "FitLauncher",
        kind: "info",
      });
    } catch (err) {
      console.error("Failed to remove theme:", err);
      await message("Could not remove theme file.", {
        title: "FitLauncher",
        kind: "error",
      });
    }
  }

  public async addBackgroundImage(
    imagePath: string,
    blurAmount: number
  ): Promise<void> {
    const bgEl = document.querySelector(
      ".background-style"
    ) as HTMLElement | null;
    const blurEl = document.querySelector(
      ".background-blur-whole"
    ) as HTMLElement | null;

    if (!imagePath || !bgEl || !blurEl) return;

    const imageName = await basename(imagePath);
    const targetPath = await join(
      await appDataDir(),
      "backgroundImages",
      imageName
    );
    await mkdir(await dirname(targetPath), { recursive: true });
    await copyFile(imagePath, targetPath);

    const store = await load("background_store.json", { autoSave: false });
    await store.set("background_image", targetPath);
    await store.set("blur_amount", blurAmount);

    const link = await store.get<string>("background_image");
    if (link) {
      bgEl.style.backgroundImage = `url(${convertFileSrc(link)})`;
      blurEl.style.backdropFilter = `blur(${blurAmount}px)`;
    }
  }

  public async chooseAndSetBackgroundImage(blurAmount: number): Promise<void> {
    const imagePath = await open({
      multiple: false,
      filters: [{ name: "Image", extensions: ["png", "jpeg", "jpg", "webp"] }],
    });

    if (typeof imagePath === "string") {
      await this.addBackgroundImage(imagePath, blurAmount);
    }
  }

  public async removeBackground(): Promise<void> {
    const store = await load("background_store.json", { autoSave: false });
    await store.set("background_image", "");
    await store.set("blur_amount", 0);
    window.location.reload();
  }

  public async loadBackgroundState(): Promise<{
    applied: boolean;
    blur: number;
  }> {
    const store = await load("background_store.json", { autoSave: false });
    const path = await store.get<string>("background_image");
    const blur = await store.get<number>("blur_amount");
    return { applied: !!path, blur: blur ?? 5 };
  }
}
