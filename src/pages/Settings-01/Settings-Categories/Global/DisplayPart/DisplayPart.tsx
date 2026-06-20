import { createSignal, onMount, createEffect, Show } from "solid-js";
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
import TitleLabel from "../../Components/UI/TitleLabel/TitleLabel";
import Dropdown from "../../../../../components/UI/Dropdown/Dropdown";
import { ThemeManagerApi } from "../../../../../api/theme/api";
import { changeLanguage, languageCodeToDisplay, languageDisplayToCode, locale, SUPPORTED_LANGUAGES, t } from "../../../../../i18n";

const themeAPI = new ThemeManagerApi();

export default function DisplayPart(props: SettingsSectionProps<GamehubSettings>) {
    const [newThemes, setNewThemes] = createSignal<string[]>([]);
    const [currentTheme, setCurrentTheme] = createSignal<string>("Dark Purple");
    const [blurAmount, setBlurAmount] = createSignal<number>(5);

    onMount(async () => {
        try {
            const allThemes = await themeAPI.getAllThemes();
            setNewThemes(allThemes.filter(t => !defaultThemes.includes(t as DefaultTheme)));

            await themeAPI.applyStoredTheme();

            const stored = await themeAPI.loadBackgroundState();
            setBlurAmount(stored.blur);

            const savedThemeKey = localStorage.getItem("theme");
            const savedThemeDisplay = savedThemeKey
                ? savedThemeKey.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())
                : "Dark Purple";
            setCurrentTheme(savedThemeDisplay);
        } catch (err) {
            console.error("Failed to initialize display settings", err);
        }
    });

    createEffect(() => {
        const el = document.querySelector(".background-blur-whole") as HTMLElement | null;
        if (el) el.style.backdropFilter = `blur(${blurAmount()}px)`;
        load("background_store.json", { autoSave: false, defaults: {} }).then(store => {
            store.set("blur_amount", blurAmount());
        });
    });

    return (
        <Show when={props.settings} fallback={<LoadingPage />}>
            <PageGroup title={t("settings.display.title")}>
                <li class="flex items-center justify-between gap-4 bg-background-70 p-4 rounded-lg border border-secondary-20 hover:border-accent/30 transition-colors">
                    <TitleLabel
                        text={t("settings.display.language")}
                        typeText={t("settings.display.languageDescription")}
                    />
                    <Dropdown
                        list={Object.values(SUPPORTED_LANGUAGES)}
                        activeItem={languageCodeToDisplay(locale())}
                        onListChange={async (selected) => changeLanguage(languageDisplayToCode(selected))}
                        placeholder={languageCodeToDisplay(locale())}
                    />
                </li>
                <LabelCheckboxSettings
                    text={t("settings.display.hideNsfw")}
                    typeText={t("settings.display.hideNsfwDescription")}
                    action={() => props.handleSwitchCheckChange?.("display.nsfw_censorship")}
                    checked={props.settings().nsfw_censorship}
                />
                <LabelCheckboxSettings
                    text={t("settings.display.comments")}
                    typeText={t("settings.display.commentsDescription")}
                    action={() => props.handleSwitchCheckChange?.("display.game_page_allow_comments")}
                    checked={props.settings().game_page_allow_comments}
                />
                <LabelCheckboxSettings
                    text={t("settings.display.closeToTray")}
                    typeText={t("settings.display.closeToTrayDescription")}
                    action={() => props.handleSwitchCheckChange?.("display.close_to_tray")}
                    checked={props.settings().close_to_tray}
                />
                <LabelDropdownSettings
                    text={t("settings.display.themes")}
                    typeText={t("settings.display.themesDescription")}
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

                        if (currentTheme() === themeName) {
                            await themeAPI.revertToDefault();
                            setCurrentTheme("Blue Cyan");
                        }
                    }}
                />
                <LabelButtonSettings
                    text={t("settings.display.backgroundImage")}
                    typeText={t("settings.display.backgroundImageDescription")}
                    action={async () => {
                        await themeAPI.chooseAndSetBackgroundImage(blurAmount());
                    }}
                    buttonLabel="+"
                    disabled={true}
                />
                <LabelRangeSettings
                    text={t("settings.display.backgroundBlur")}
                    typeText={t("settings.display.backgroundBlurDescription")}
                    min={0}
                    max={50}
                    value={blurAmount()}
                    onInput={(val) => setBlurAmount(val)}
                    disabled={true}
                />
            </PageGroup>
        </Show>
    );
}
