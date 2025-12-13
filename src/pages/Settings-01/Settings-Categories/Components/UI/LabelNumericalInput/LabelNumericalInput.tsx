import { createSignal, Show } from "solid-js";
import NumericalInput from "../../../../../../components/UI/NumericalInput/NumericalInput";
import { SettingsButtonLabelProps, SettingsNumericalInputLabelProps, UnitType } from "../../../../../../types/settings/ui";
import TitleLabel from "../TitleLabel/TitleLabel";
import Dropdown from "../../../../../../components/UI/Dropdown/Dropdown";



export default function LabelNumericalInput(props: SettingsNumericalInputLabelProps) {
    const [unit, setUnit] = createSignal<UnitType>(props.defaultUnitType || "KB");
    const [draft, setDraft] = createSignal<number | null>(null);


    const getDivider = () => {
        switch (unit()) {
            case "KB": return 1024;
            case "MB": return 1024 * 1024;
            default: return 1;
        }
    };

    const displayValue = () => {
        if (draft() !== null) return draft()!;

        let raw = (props.value ?? 0) / getDivider();
        raw = props.min ? Math.max(props.min, raw) : raw;

        return unit() === "MB"
            ? Math.round(raw * 100) / 100
            : Math.round(raw);
    };


    const handleInput = (v: number) => {
        setDraft(v);
    };


    const commit = () => {
        if (draft() === null) return;

        const v = draft()!;
        const final = v === 0 ? 0 : Math.round(v * getDivider());

        props.onInput?.(final);
        setDraft(null);
    };

    return (
        <li class="flex items-center justify-between py-3 px-4 bg-popup-background hover:bg-secondary-20 rounded-lg border border-secondary-20 transition-colors w-full gap-2">
            <TitleLabel text={props.text} typeText={props.typeText} />

            <Show when={props.unit} fallback={
                <NumericalInput {...props} />
            }>
                <div class="flex items-center gap-2">
                    <NumericalInput
                        {...props}
                        value={displayValue()}
                        onInput={handleInput}
                        onBlur={commit}
                        valueType={`${unit()}${props.unitPerUnit ? "/" + props.unitPerUnit : ""}`}
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
