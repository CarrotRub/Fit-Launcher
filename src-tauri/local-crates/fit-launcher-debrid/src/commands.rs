use specta::specta;

use crate::{
    AllDebridProvider, DebridError, DebridProvider, DebridRegistry, ProviderInfo,
    RealDebridProvider, SubscriptionInfo,
};

/// Get the global debrid registry with all available providers
fn get_registry() -> DebridRegistry {
    let mut registry = DebridRegistry::new();
    registry.register(RealDebridProvider::new());
    registry.register(AllDebridProvider::new());
    registry
}

/// List all available debrid providers
#[tauri::command]
#[specta]
pub async fn debrid_list_providers() -> Vec<ProviderInfo> {
    get_registry().list_providers()
}

/// Validate an API key for a specific provider
#[tauri::command]
#[specta]
pub async fn debrid_validate_api_key(
    provider_id: String,
    api_key: String,
) -> Result<bool, DebridError> {
    let registry = get_registry();
    let provider = registry.get_or_err(&provider_id)?;
    provider.validate_api_key(&api_key).await
}

/// Get subscription information for a provider
#[tauri::command]
#[specta]
pub async fn debrid_get_subscription(
    provider_id: String,
    api_key: String,
) -> Result<SubscriptionInfo, DebridError> {
    let registry = get_registry();
    let provider = registry.get_or_err(&provider_id)?;
    provider.get_subscription_info(&api_key).await
}

/// Check if a magnet is cached (instant available) on a provider
#[tauri::command]
#[specta]
pub async fn debrid_is_cached(
    provider_id: String,
    api_key: String,
    magnet: String,
) -> Result<bool, DebridError> {
    let registry = get_registry();
    let provider = registry.get_or_err(&provider_id)?;
    provider.is_cached(&api_key, &magnet).await
}

/// Get the provider for use in download manager
pub fn get_provider(provider_id: &str) -> Result<std::sync::Arc<dyn DebridProvider>, DebridError> {
    get_registry().get_or_err(provider_id)
}

