import { CheckboxProps } from "../../../types/components/types";

export default function Checkbox(props: CheckboxProps) {
    const handleChange = async () => {
        const result = props.action?.();
        if (result instanceof Promise) {
            await result;
        }
    };

    return (
        <label class="relative inline-flex items-center cursor-pointer ">
            <input
                type="checkbox"
                class="sr-only peer"
                checked={props.checked}
                onChange={handleChange}
            />
            <div class="w-9 h-5 bg-secondary-20 peer-focus:outline-none peer-focus:ring-1 peer-focus:ring-accent rounded-full peer peer-checked:bg-accent peer-checked:after:translate-x-4 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-text after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
        </label>
    );
};


