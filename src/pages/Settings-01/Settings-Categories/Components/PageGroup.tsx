import { JSX } from "solid-js";


type PageGroupProps = {
    children: JSX.Element;
};

function PageGroup(props: PageGroupProps) {
    return (
        <div class="flex flex-col w-full h-full gap-6" id="global-display">
            <p class="text-2xl">DNS Settings</p>
            <ul class="flex flex-col gap-4 ">
                {props.children}
            </ul>
        </div>
    );
}

export default PageGroup;