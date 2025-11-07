use std::path::Path;

use unrar::Archive;

use crate::errors::ExtractError;

pub fn extract_archive(file: &Path) -> Result<(), ExtractError> {
    let target_dir = file.parent().ok_or(ExtractError::NoParentDirectory)?;

    let first_archive = Archive::new(&file).as_first_part();
    let mut archive = first_archive.open_for_processing()?;

    while let Some(header) = archive.read_header()? {
        archive = header.extract_with_base(target_dir)?;
    }

    Ok(())
}
