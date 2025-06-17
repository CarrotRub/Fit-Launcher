import { PageGroupProps } from "../../../../types/settings/ui";

function PageGroup(props: PageGroupProps) {
    return (
        <div class="flex flex-col w-full h-full gap-6">
            <h2 class="text-2xl font-bold text-text">{props.title}</h2>
            <ul class="flex flex-col gap-3">
                {props.children}
            </ul>
        </div>
    );
}


export default PageGroup;