import { createSignal, createEffect } from 'solid-js';
import './Slider.css';

const Slider = (props) => {
    const { images = [], filePath = '', titles = [] } = props;
    const [currentIndex, setCurrentIndex] = createSignal(0);

    const goPrevious = () => {
        setCurrentIndex((prevIndex) => Math.max(prevIndex - 1, 0));
    };

    const goNext = () => {
        setCurrentIndex((prevIndex) => Math.min(prevIndex + 1, images.length - 1));
    };

    // That shit of scrollable thing was hard to find.
    createEffect(() => {
        const container = document.querySelector('.slider-container');
        const linearGradientContainer = document.querySelector('.image-slider-gradient');
        const skipperRight = document.querySelector('.skipper.right');
    
        let distance = 375 * 0.5; // This is the width of the image container calc(375px * 0.5);
        const offset = -currentIndex() * distance;
        let containerWidth;
        if (container) {
            containerWidth = container.offsetWidth;
        }

        
        let screenWidth = screen.width; 

        let traveledOffset = 0;

        // Set the slider transform to scroll to the correct position
        if (container) {
            container.style.transform = `translateX(${offset}px)`;

            traveledOffset += offset;

            let visibleWidthContainer = (Math.abs(traveledOffset) + screenWidth);

            if (visibleWidthContainer >= containerWidth) {
                skipperRight.style.display = 'none'
            } else if (visibleWidthContainer < containerWidth) {
                if(skipperRight.style.display === 'none') {
                    skipperRight.style.display = 'flex';
                }
            }

        }

        // Handle gradient mask based on the current index
        if (currentIndex() > 0 && linearGradientContainer != null) {
            linearGradientContainer.style.webkitMaskImage = `linear-gradient(to right, var(--background-color) 0%, transparent 30%, transparent 70%,  var(--background-color)  100%)`;
            linearGradientContainer.style.maskImage = `linear-gradient(to right,  var(--background-color)  0%, transparent 30%, transparent 70%,  var(--background-color)  100%)`;
        } else if (currentIndex() === 0 && linearGradientContainer != null) {
            linearGradientContainer.style.webkitMaskImage = `linear-gradient(to right, transparent 70%,  var(--background-color)  100%)`;
            linearGradientContainer.style.maskImage =  `linear-gradient(to right, transparent 70%,  var(--background-color)  100%)`;
        }

    });
    


    return (
        <div className="slider-wrapper">
            <div className="skipper-slider-container">
                <div
                    className={`skipper left ${currentIndex() === 0 ? 'hidden' : ''}`}
                    onClick={goPrevious}
                >
                    {/* Left Arrow SVG */}
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M16 12H8m4-4-4 4 4 4"/></svg>
                </div>
                <div
                    className={`skipper right ${currentIndex() === images.length - 1 ? 'hidden' : ''}`}
                    onClick={goNext}
                >
                    {/* Right Arrow SVG */}
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12h8m-4 4 4-4-4-4"/></svg>
                </div>
            </div>
            <div className="image-slider-gradient"/>
            <div className="slider-container">

                {images.length > 0 ? (
                    images.map((image, index) => (
                        <div className="slider-image-container" key={index}>
                            <img
                                src={image}
                                alt={Array.isArray(titles) ? titles[index] : titles}
                                filepath={filePath}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                        </div>
                    ))
                ) : (
                    <p>No images to display</p>
                )}
            </div>
        </div>
    );
};

export default Slider;
