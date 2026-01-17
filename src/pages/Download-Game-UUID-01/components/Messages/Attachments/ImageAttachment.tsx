import { AttachType } from "../../../../../bindings"

interface Props {
    attach: AttachType
}

export const ImageAttachment = ({ attach }: Props) => {
    return (
        <img src={attach.src!} class="max-w-full h-auto mt-4 rounded-md" />
    )
}