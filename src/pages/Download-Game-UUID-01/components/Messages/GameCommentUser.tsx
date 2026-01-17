import { BadgeCheckIcon } from "lucide-solid"
import { User } from "../../../../bindings"

interface Props {
    user: User | null
}

export const GameCommentUser = ({ user }: Props) => {
    if (!user) return null

    return (
        <div class='flex flex-row items-center gap-2'>
            {user.admin && <span class='text-xs font-bold text-white bg-blue-500 px-2 py-1 rounded-lg'>ADM</span>}
            <span class="font-bold text-md">{user.name}</span>
            {user.is_verified && <BadgeCheckIcon class={`fill-blue-600 w-4 h-4`} />}
        </div>
    )
}