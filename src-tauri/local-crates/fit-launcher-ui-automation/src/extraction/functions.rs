use std::path::Path;

use unrar::Archive;

use crate::errors::ExtractError;

/// Find first archive of a rar group, and extract files
///
/// DO NOT call this multiple times for the same RAR group
/// (foo.part*1~N*.rar e.g.), or it will extract files for N times
pub fn extract_archive(file: &Path) -> Result<(), ExtractError> {
    let target_dir = file.parent().ok_or(ExtractError::NoParentDirectory)?;

    let first_archive = first_part(file);
    let mut archive = first_archive.open_for_processing()?;

    while let Some(header) = archive.read_header()? {
        archive = header.extract_with_base(target_dir)?;
    }

    Ok(())
}

fn first_part(p: &Path) -> Archive<'_> {
    Archive::new(p).as_first_part()
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use crate::functions::first_part;

    #[test]
    fn find_first_archive() {
        assert_eq!(
            first_part(&PathBuf::from("game.rar"))
                .filename()
                .display()
                .to_string(),
            "game.rar",
        );

        for i in 1..10 {
            let filename = PathBuf::from(format!("game.part{i}.rar"));
            let first = first_part(&filename);
            assert_eq!(first.filename().display().to_string(), "game.part1.rar");
        }

        for i in 1..100 {
            let filename = PathBuf::from(format!("game.part{i:02}.rar"));
            let first = first_part(&filename);
            assert_eq!(first.filename().display().to_string(), "game.part01.rar");
        }

        for i in 1..1000 {
            let filename = PathBuf::from(format!("game.part{i:03}.rar"));
            let first = first_part(&filename);
            assert_eq!(first.filename().display().to_string(), "game.part001.rar");
        }

        for i in 1..10000 {
            let filename = PathBuf::from(format!("game.part{i:04}.rar"));
            let first = first_part(&filename);
            assert_eq!(first.filename().display().to_string(), "game.part0001.rar");
        }
    }
}
