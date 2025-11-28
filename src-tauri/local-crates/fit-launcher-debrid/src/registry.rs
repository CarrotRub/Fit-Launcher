use std::collections::HashMap;
use std::sync::Arc;

use crate::{DebridError, DebridProvider, ProviderInfo};

/// Registry for managing available debrid providers
///
/// The registry holds references to all available debrid provider implementations
/// and allows for dynamic lookup and instantiation.
pub struct DebridRegistry {
    providers: HashMap<String, Arc<dyn DebridProvider>>,
}

impl DebridRegistry {
    /// Create a new empty registry
    pub fn new() -> Self {
        Self {
            providers: HashMap::new(),
        }
    }

    /// Register a new provider
    ///
    /// The provider's ID is used as the key for lookup.
    pub fn register<P: DebridProvider + 'static>(&mut self, provider: P) {
        let id = provider.id().to_string();
        self.providers.insert(id, Arc::new(provider));
    }

    /// Register a provider from an Arc
    pub fn register_arc(&mut self, provider: Arc<dyn DebridProvider>) {
        let id = provider.id().to_string();
        self.providers.insert(id, provider);
    }

    /// Get a provider by ID
    pub fn get(&self, id: &str) -> Option<Arc<dyn DebridProvider>> {
        self.providers.get(id).cloned()
    }

    /// Check if a provider is registered
    pub fn has(&self, id: &str) -> bool {
        self.providers.contains_key(id)
    }

    /// Get a provider by ID, returning an error if not found
    pub fn get_or_err(&self, id: &str) -> Result<Arc<dyn DebridProvider>, DebridError> {
        self.get(id)
            .ok_or_else(|| DebridError::ProviderNotFound(id.to_string()))
    }

    /// List all registered providers
    pub fn list_providers(&self) -> Vec<ProviderInfo> {
        self.providers.values().map(|p| p.info()).collect()
    }

    /// Get the IDs of all registered providers
    pub fn provider_ids(&self) -> Vec<String> {
        self.providers.keys().cloned().collect()
    }

    /// Get the number of registered providers
    pub fn len(&self) -> usize {
        self.providers.len()
    }

    /// Check if the registry is empty
    pub fn is_empty(&self) -> bool {
        self.providers.is_empty()
    }

    /// Remove a provider by ID
    pub fn unregister(&mut self, id: &str) -> Option<Arc<dyn DebridProvider>> {
        self.providers.remove(id)
    }

    /// Clear all providers
    pub fn clear(&mut self) {
        self.providers.clear();
    }
}

impl Default for DebridRegistry {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Test that the registry compiles and basic operations work
    // Actual provider tests will be added when providers are implemented

    #[test]
    fn test_registry_new() {
        let registry = DebridRegistry::new();
        assert!(registry.is_empty());
        assert_eq!(registry.len(), 0);
    }

    #[test]
    fn test_registry_list_empty() {
        let registry = DebridRegistry::new();
        let providers = registry.list_providers();
        assert!(providers.is_empty());
    }
}

