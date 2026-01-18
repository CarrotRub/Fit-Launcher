import { AttachType } from "../../../../../bindings"

interface Props {
    attach: AttachType
}

export const GiffyAttachment = ({ attach }: Props) => {

    return (
        <video src={attach.video!} autoplay muted loop controls={false}></video>
    )
}