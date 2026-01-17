use crate::core_commands::fetch_comments;
use crate::types::Comments;
use specta::specta;
use tauri;

#[tauri::command]
#[specta]
pub async fn get_game_comments(url: String) -> Result<Comments, String> {
    fetch_comments(&url).await.map_err(|e| e.to_string())
}
