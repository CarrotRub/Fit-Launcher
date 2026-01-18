import { CheckboxClassicProps } from "../../../types/components/types";

export default function CheckboxClassic(props: CheckboxClassicProps) {
    const handleChange = (e: Event) => {
        const input = e.currentTarget as HTMLInputElement;
        props.action?.(input.checked);
    };

    return (
        <label class="inline-flex items-center cursor-pointer gap-2 select-none">
            <input
                type="checkbox"
                class="sr-only peer"
                checked={props.checked}
                onChange={handleChange}
                disabled={props.disabled}
            />

            <div class="
                w-4 h-4
                border border-secondary-40
                rounded-sm
                bg-secondary-10
                flex items-center justify-center
                transition-all duration-200 ease-in-out
                hover:border-accent
                peer-focus:ring-1 peer-focus:ring-accent 
                peer-checked:bg-accent
                peer-checked:border-accent
                peer-disabled:opacity-50 peer-disabled:cursor-not-allowed
            ">
                <svg
                    class="
                        w-3 h-3
                        text-text
                        opacity-0
                        transition-opacity duration-200
                        peer-checked:opacity-100
                        peer-disabled:opacity-30
                    "
                    viewBox="0 0 20 20"
                    fill="none"
                >
                    <path
                        d="M5 10.5L8.5 14L15 6"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    />
                </svg>
            </div>

            {props.label && (
                <span class={`
                    text-sm text-text
                    ${props.disabled ? "opacity-50 cursor-not-allowed" : ""}
                `}>
                    {props.label}
                </span>
            )}
        </label>
    );
}