export default function TitleLabel(props: {
    text: string;
    typeText?: string;
}) {
    return (
        <span class="text-text font-medium flex flex-col w-full">
            {props.text}
            {<i class="text-muted ml-2"><small>{props.typeText}</small></i>}
        </span>
    )
}