import { UserIcon } from "lucide-solid"
import { User } from "../../../../bindings"

interface Props {
    user: User | null
    reply?: boolean
}

const iconSmall = "w-8 h-8" as const
const iconLarge = "w-16 h-16" as const

export const GameCommentAvatar = ({ user, reply }: Props) => {

    if (!user) return null;

    if (!user.ava) {
        return (<div class={`rounded-full bg-secondary/30 flex items-center justify-center ${reply ? iconSmall : iconLarge}`}>
            <UserIcon class="w-1/2 h-1/2" />
        </div>)
    }

    return <img src={user.ava} class={`rounded-full ${reply ? iconSmall : iconLarge}`} />

}