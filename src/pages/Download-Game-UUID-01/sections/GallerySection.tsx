import { Accessor } from "solid-js";
import { ScreenshotGallery } from "../components/ScreenshotGallery/ScreenshotGallery";
import { InfoContainer } from "../components/InfoContainer";

export const GallerySection = (props: { images: Accessor<string[]> }) => (
    <InfoContainer>
        <ScreenshotGallery images={props.images} autoPlayInterval={5000} />
    </InfoContainer>
);

export default GallerySection;