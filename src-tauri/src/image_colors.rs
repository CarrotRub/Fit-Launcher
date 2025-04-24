use color_thief::{get_palette, ColorFormat};
use image::{load_from_memory, DynamicImage, ImageError};
use thiserror::Error;

#[derive(Debug, Error)]
enum DominantColorError {
    #[error("Failed to download image from URL: {0}")]
    Network(reqwest::Error),
    #[error("Failed to decode image data: {0}")]
    ImageDecoding(ImageError),
    #[error("Failed to extract dominant color")]
    ColorExtraction,
    #[error("Unexpected image format")]
    Format,
}

impl From<reqwest::Error> for DominantColorError {
    fn from(error: reqwest::Error) -> Self {
        DominantColorError::Network(error)
    }
}

impl From<ImageError> for DominantColorError {
    fn from(error: ImageError) -> Self {
        DominantColorError::ImageDecoding(error)
    }
}

async fn get_image_from_url(url: &str) -> Result<DynamicImage, DominantColorError> {
    let response = reqwest::get(url)
        .await
        .map_err(DominantColorError::Network)?;
    let bytes = response
        .bytes()
        .await
        .map_err(DominantColorError::Network)?;

    let img = load_from_memory(&bytes).map_err(DominantColorError::ImageDecoding)?;
    Ok(img)
}

fn get_image_buffer(img: DynamicImage) -> Result<(Vec<u8>, ColorFormat), DominantColorError> {
    match img {
        DynamicImage::ImageRgb8(buffer) => Ok((buffer.to_vec(), ColorFormat::Rgb)),
        DynamicImage::ImageRgba8(buffer) => Ok((buffer.to_vec(), ColorFormat::Rgba)),
        _ => Err(DominantColorError::Format),
    }
}

async fn fetch_dominant_color(url: &str) -> Result<String, DominantColorError> {
    let result_image = get_image_from_url(url).await?; // Await here
    let image_raw = get_image_buffer(result_image)?;

    let color_rgb = get_palette(&image_raw.0, image_raw.1, 10, 2)
        .map_err(|_| DominantColorError::ColorExtraction)?;

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
