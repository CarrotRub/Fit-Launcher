use std::{
    fs,
    path::{Path, PathBuf},
};

use unrar::Archive;

use crate::errors::ExtractError;

pub(crate) fn find_first_rar_file(dir: &Path) -> Option<PathBuf> {
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if let Some(ext) = path.extension() {
                if ext == "rar" {
                    return Some(path);
                }
            }
        }
    }
    None
}

pub fn extract_archive(file: &Path) -> Result<(), ExtractError> {
    let target_dir = file.parent().ok_or(ExtractError::NoParentDirectory)?;

    let first_archive = Archive::new(&file).as_first_part();
    let mut archive = first_archive.open_for_processing()?;

    while let Some(header) = archive.read_header()? {
        archive = header.extract_with_base(target_dir)?;
    }

    Ok(())
}

pub fn extract_multiple_files(file: &Path) -> Result<(), ExtractError> {
    extract_archive(file)?;

    let archive_dir = file.parent().ok_or(ExtractError::NoParentDirectory)?;

    for entry in fs::read_dir(archive_dir)? {
        let entry = entry?;
        let path = entry.path();
        if let Some(ext) = path.extension() {
            if ext == "rar" {
                fs::remove_file(path)?;
            }
        }
    }

    Ok(())
}
