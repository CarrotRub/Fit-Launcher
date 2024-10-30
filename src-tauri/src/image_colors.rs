pub mod dominant_colors {
    use color_thief::{get_palette, ColorFormat};
    use image::{load_from_memory, DynamicImage, ImageError};
    use reqwest::{self, blocking::Response};
    use std::fmt;
    use std::sync::{Arc, Mutex};
    use std::thread;
    use tokio::task;

    #[derive(Debug)]
    enum DominantColorError {
        NetworkError(reqwest::Error),
        ImageDecodingError(ImageError),
        ColorExtractionError,
        FormatError,
    }

    impl fmt::Display for DominantColorError {
        fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
            match self {
                DominantColorError::NetworkError(_) => {
                    write!(f, "Failed to download image from URL")
                }
                DominantColorError::ImageDecodingError(_) => {
                    write!(f, "Failed to decode image data")
                }
                DominantColorError::ColorExtractionError => {
                    write!(f, "Failed to extract dominant color")
                }
                DominantColorError::FormatError => write!(f, "Unexpected image format"),
            }
        }
    }

    impl From<reqwest::Error> for DominantColorError {
        fn from(error: reqwest::Error) -> Self {
            DominantColorError::NetworkError(error)
        }
    }

    impl From<ImageError> for DominantColorError {
        fn from(error: ImageError) -> Self {
            DominantColorError::ImageDecodingError(error)
        }
    }

    async fn get_image_from_url(url: &str) -> Result<DynamicImage, DominantColorError> {
        let response = reqwest::get(url)
            .await
            .map_err(DominantColorError::NetworkError)?;
        let bytes = response
            .bytes()
            .await
            .map_err(DominantColorError::NetworkError)?;

        let img = load_from_memory(&bytes).map_err(DominantColorError::ImageDecodingError)?;
        Ok(img)
    }

    fn get_image_buffer(img: DynamicImage) -> Result<(Vec<u8>, ColorFormat), DominantColorError> {
        match img {
            DynamicImage::ImageRgb8(buffer) => Ok((buffer.to_vec(), ColorFormat::Rgb)),
            DynamicImage::ImageRgba8(buffer) => Ok((buffer.to_vec(), ColorFormat::Rgba)),
            _ => Err(DominantColorError::FormatError),
        }
    }

    async fn fetch_dominant_color(url: &str) -> Result<String, DominantColorError> {
        let result_image = get_image_from_url(url).await?; // Await here
        let image_raw = get_image_buffer(result_image)?;

        let color_rgb = get_palette(&image_raw.0, image_raw.1, 10, 2)
            .map_err(|_| DominantColorError::ColorExtractionError)?;

        let dominant_color = color_rgb[0];
        Ok(format!(
            "({}, {}, {})",
            dominant_color.r, dominant_color.g, dominant_color.b
        ))
    }

    #[tauri::command]
    pub async fn check_dominant_color_vec(list_images: Vec<String>) -> Result<Vec<String>, String> {
        let mut rgb_color_list: Vec<String> = Vec::new();

        for link in list_images {
            match fetch_dominant_color(&link).await {
                Ok(rgb_value) => rgb_color_list.push(rgb_value),
                Err(e) => return Err(format!("Failed to fetch color for {}: {}", link, e)),
            }
        }

        Ok(rgb_color_list)
    }
}
