import { createSignal, createMemo, Show } from "solid-js";
import NumericalInput from "../../../../../../components/UI/NumericalInput/NumericalInput";
import { SettingsNumericalInputLabelProps, UnitType } from "../../../../../../types/settings/ui";
import TitleLabel from "../TitleLabel/TitleLabel";
import Dropdown from "../../../../../../components/UI/Dropdown/Dropdown";



export default function LabelNumericalInput(props: SettingsNumericalInputLabelProps) {
    const [unit, setUnit] = createSignal<UnitType>(props.defaultUnitType || "KB");

    const unitMultiplier = createMemo(() => {
        switch (unit()) {
            case "B": return 1;
            case "KB": return 1024;
            case "MB": return 1024 * 1024;
            default: return 1;
        }
    });

    // ensures reactivity
    const displayValue = createMemo(() => {
        const rawValue = props.value ?? 0;
        if (!props.unit) {
            return rawValue;
        }
        const result = rawValue / unitMultiplier();
        return unit() === "MB" ? Math.round(result * 100) / 100 : Math.round(result);
    });

    const displayMin = createMemo(() => {
        if (props.min === undefined || !props.unit) return props.min;
        return props.min / unitMultiplier();
    });

    const displayMax = createMemo(() => {
        if (props.max === undefined || !props.unit) return props.max;
        return props.max / unitMultiplier();
    });

    const handleInput = (displayVal: number) => {
        if (!props.unit) {
            props.onInput(displayVal);
            return;
        }
        const bytes = Math.round(displayVal * unitMultiplier());
        props.onInput(bytes);
    };

    // Build valueType label: use unitPerUnit if provided (e.g., "/s"), otherwise just unit
    const valueTypeLabel = createMemo(() => {
        if (props.unitPerUnit) {
            return unit() + "/" + props.unitPerUnit;
        }
        return unit();
    });

    return (
        <li class="flex items-center justify-between py-3 px-4 bg-popup-background hover:bg-secondary-20 rounded-lg border border-secondary-20 transition-colors w-full gap-2">
            <TitleLabel text={props.text} typeText={props.typeText} />

            <Show
                when={props.unit}
                fallback={
                    <NumericalInput
                        value={displayValue()}
                        onInput={handleInput}
                        min={props.min}
                        max={props.max}
                        step={props.step}
                        valueType={props.valueType}
                        class={props.class}
                        isDirty={props.isDirty}
                        savePulse={props.savePulse}
                    />
                }
            >
                <div class="flex items-center gap-2">
                    <NumericalInput
                        value={displayValue()}
                        onInput={handleInput}
                        min={displayMin()}
                        max={displayMax()}
                        step={props.step ?? 1}
                        valueType={valueTypeLabel()}
                        class={props.class}
                        isDirty={props.isDirty}
                        savePulse={props.savePulse}
                    />

                    <div class="w-20">
                        <Dropdown<UnitType>
                            list={["B", "KB", "MB"]}
                            activeItem={unit()}
                            onListChange={async (newUnit) => {
                                setUnit(newUnit);
                            }}
                        />
                    </div>
                </div>
            </Show>
        </li>
    );
}
