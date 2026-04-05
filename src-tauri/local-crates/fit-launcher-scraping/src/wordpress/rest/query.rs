use serde::Serialize;
use specta::Type;

#[derive(Debug, Serialize, Type)]
pub struct QueryWpLosslessRepack {
    pub per_page: u8,
    pub page: Option<u8>,
}
