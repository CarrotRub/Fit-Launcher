import { createMemo, Show } from 'solid-js';
import Slider from '../../../../components/Slider-01/Slider';
import { useGamehub } from '../../GamehubContext';

export default function RecentlyUpdatedGames() {
    const { filteredRecentlyUpdated } = useGamehub();

    // Derive slider data from filtered games
    const sliderData = createMemo(() => ({
        images: filteredRecentlyUpdated().map(g => g.img),
        titles: filteredRecentlyUpdated().map(g => g.title),
        hrefs: filteredRecentlyUpdated().map(g => g.href),
    }));

    return (
        <div class="flex flex-col h-fit pb-4">
            <div class="text-2xl font-bold text-text text-center pl-3">
                <p>Recently Updated Games</p>
            </div>
            <Show when={filteredRecentlyUpdated().length > 0}>
                <Slider
                    images={sliderData().images}
                    filePath=""
                    titles={sliderData().titles}
                    hrefs={sliderData().hrefs}
                />
            </Show>
        </div>
    );
}
