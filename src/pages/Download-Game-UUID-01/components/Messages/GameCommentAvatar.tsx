import { UserIcon } from "lucide-solid"
import { User } from "../../../../bindings"

interface Props {
  user?: User
  reply?: boolean
}

const iconSmall = "w-8 h-8" as const
const iconLarge = "w-16 h-16" as const

// TODO: Hack for now
export const GameCommentAvatar = ({ user, reply }: Props) => {

  if (!user) return null;

  return !user.ava ? <div class={`rounded-full bg-secondary/30 flex items-center justify-center ${reply ? iconSmall : iconLarge}`}>
    <UserIcon class="w-1/2 h-1/2" />
  </div> : <div>
    <div class="relative">
      <img src={user.ava} class={`rounded-full ${reply ? iconSmall : iconLarge}`} />
    </div>
  </div>
}