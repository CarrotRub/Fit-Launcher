import { JSX } from "solid-js";

export const InfoContainer = (props: { children: JSX.Element; class?: string }) => {
    return (
        <div
            class={`bg-secondary-20/10 rounded-lg p-6 shadow-lg border border-primary/20 ${props.class ?? ""}`}
        >
            {props.children}
        </div>
    );
};
