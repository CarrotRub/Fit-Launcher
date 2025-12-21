import { Accessor } from "solid-js";
import { ScreenshotGallery } from "../components/ScreenshotGallery/ScreenshotGallery";

export const GallerySection = (props: { images: Accessor<string[]> }) => (
    <div class="bg-secondary-20/10 rounded-xl p-6">
        <ScreenshotGallery images={props.images} autoPlayInterval={5000} />
    </div>
);

export default GallerySection;