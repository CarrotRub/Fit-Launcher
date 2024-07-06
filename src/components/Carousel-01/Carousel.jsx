import { createSignal } from 'solid-js';
import './Carousel.css';

const Carousel = ({ images }) => {
  const [currentIndex, setCurrentIndex] = createSignal(0);
  const [loadedImages, setLoadedImages] = createSignal(Array(images.length).fill(false));

  const prevSlide = () => {
    setCurrentIndex((prevIndex) => (prevIndex - 1 + images.length) % images.length);
  };

  const nextSlide = () => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % images.length);
  };

  const selectImage = (index) => {
    setCurrentIndex(index);
  };

  const handleImageLoad = (index) => {
    setLoadedImages((prev) => {
      const newLoadedImages = [...prev];
      newLoadedImages[index] = true;
      return newLoadedImages;
    });
  };

  return (
    <div class="carousel">
      <div class="carousel-images" style={{ transform: `translateX(-${currentIndex() * 100}%)` }}>
        {images.length === 0 ? (
          <div class="carousel-image-container">
            <div class="image-placeholder"></div>
          </div>
        ) : (
          images.map((image, index) => (
            <div class="carousel-image-container" key={index}>
              {!loadedImages()[index] && (
                <div class="image-placeholder"></div>
              )}
              <img
                loading="lazy"
                src={image}
                alt={`Slide ${index + 1}`}
                class="carousel-image"
                onLoad={() => handleImageLoad(index)}
              />
            </div>
          ))
        )}
      </div>
      <div class="carousel-controls">
        <button class="carousel-control prev" onClick={prevSlide}>
          &lt;
        </button>
        <div class="carousel-thumbnails">
          {images.map((image, index) => (
            <img
              key={index}
              src={image}
              alt={`Thumbnail ${index + 1}`}
              class={`carousel-thumbnail ${currentIndex() === index ? 'active' : ''}`}
              onClick={() => selectImage(index)}
            />
          ))}
        </div>
        <button class="carousel-control next" onClick={nextSlide}>
          &gt;
        </button>
      </div>
    </div>
  );
};

export default Carousel;