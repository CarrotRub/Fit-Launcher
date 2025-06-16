import { createContext, useContext } from "solid-js";
import { createSignal, type Accessor, type Setter, type JSX } from "solid-js";
import type { SettingsContextType, SettingsGroup, SettingsPart } from "../../types/settings/types";

const SettingsContext = createContext<SettingsContextType>();

export function SettingsProvider(props: { children: JSX.Element }) {
    const [activeCategory, setActiveCategory] = createSignal<SettingsPart>("global-display");
    const [activeGroup, setActiveGroup] = createSignal<SettingsGroup>("global");

    return (
        <SettingsContext.Provider value={{
            activeCategory,
            setActiveCategory,
            activeGroup,
            setActiveGroup
        }}>
            {props.children}
        </SettingsContext.Provider>
    );
}

export function useSettingsContext(): SettingsContextType {
    const context = useContext(SettingsContext);
    if (!context) throw new Error("useSettingsContext must be used inside a <SettingsProvider>");
    return context;
}
