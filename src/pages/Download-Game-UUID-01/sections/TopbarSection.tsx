import { ArrowLeft, Bookmark, BookmarkCheck } from "lucide-solid"
import Button from "../../../components/UI/Button/Button"
import { Accessor } from "solid-js";
import { useNavigate } from "@solidjs/router";

export type TopbarSectionProps = {
    isSaved: Accessor<boolean>;
    onToggleDownloadLater: () => void;
};

export const TopbarSection = (props: TopbarSectionProps) => {
    const navigate = useNavigate();

    const handleReturn = () => navigate(localStorage.getItem("latestGlobalHref") || "/");

    return (
        <div class="flex items-center justify-between px-4 py-3 border-b border-secondary-20 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
            <Button icon={<ArrowLeft class="w-5 h-5" />} onClick={handleReturn} size="sm" variant="glass" label="Back" />
            <Button
                icon={props.isSaved() ? <BookmarkCheck class="w-5 h-5 text-accent" /> : <Bookmark class="w-5 h-5" />}
                onClick={props.onToggleDownloadLater}
                size="sm"
                variant="glass"
                label={props.isSaved() ? "Saved" : "Save"}
            />
        </div>
    )
}