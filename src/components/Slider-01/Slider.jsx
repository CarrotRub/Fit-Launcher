import { createSignal } from "solid-js";
import './Slider.css';

const Slider = (props) => {
    const { images = [], filePath = "", titles = [] } = props;
    const [currentIndex, setCurrentIndex] = createSignal(0);
  
    const goPrevious = () => {
      setCurrentIndex((prevIndex) => Math.max(prevIndex - 1, 0));
    };
  
    const goNext = () => {
      setCurrentIndex((prevIndex) => Math.min(prevIndex + 1, images.length - 1));
    };
  
    return (
      <div className="slider-container">

        <div
          className={`skipper left ${currentIndex() === 0 ? "hidden" : ""}`}
          onClick={goPrevious}
        >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-circle-arrow-left"><circle cx="12" cy="12" r="10"/><path d="M16 12H8m4-4-4 4 4 4"/></svg>
        </div>
  


        {images.length > 0 ? (
          images.map((image, index) => (
            <div className="slider-image-container" key={index}>
              <img
                src={image}
                alt={Array.isArray(titles) ? titles[index] : titles}
                filepath={filePath}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </div>
          ))
        ) : (
          <p>No images to display</p>
        )}

        <div
          className={`skipper right ${currentIndex() === images.length - 1 ? "hidden" : ""}`}
          onClick={goNext}
        >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-circle-arrow-right"><circle cx="12" cy="12" r="10"/><path d="M8 12h8m-4 4 4-4-4-4"/></svg>
        </div>
  
      </div>
    );
}
  
export default Slider;
