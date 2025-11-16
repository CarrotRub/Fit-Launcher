# Search Index Documentation

## Overview

Fit Launcher uses a backend-driven search index to provide fast, reliable game search functionality. The search index is built from sitemap XML files downloaded by the Rust backend and cached as a JSON file for the frontend to consume.

## Architecture

### Backend (Rust)

The search index is built in the `fit-launcher-scraping` crate:

- **Location**: `src-tauri/local-crates/fit-launcher-scraping/src/search_index.rs`
- **Index File**: `$APPDATA/com.fitlauncher.carrotrub/sitemaps/search-index.json`
- **Build Process**: Automatically triggered after sitemap downloads complete during app bootstrap

### Frontend (SolidJS)

The search UI component:

- **Location**: `src/components/Topbar-01/Topbar-Components-01/Searchbar-01/Searchbar.tsx`
- **Behavior**: Loads the cached index once on mount, performs in-memory filtering with debouncing
- **Events**: Listens to `search-index-ready` and `search-index-error` events for dynamic updates

## Maintainer Expectations

Following the maintainer's guidance, **all network access and heavy I/O operations stay in the Rust backend**:

- ✅ Sitemap XML files are downloaded and parsed by Rust
- ✅ Search index is built and cached by Rust
- ✅ Frontend only reads the cached JSON file (no network requests)
- ✅ All errors are logged via `tracing` and surfaced to UI via events

## Index Lifecycle

1. **Bootstrap**: When the app starts, the bootstrap thread:
   - Downloads sitemap XML files via `get_sitemaps_website()`
   - Runs game scrapers via `run_all_scrapers()`
   - Builds the search index via `rebuild_search_index()`
   - Emits `search-index-ready` or `search-index-error` events

2. **Frontend Load**: The Searchbar component:
   - Loads `search-index.json` once on mount
   - Stores it in component state
   - Filters results in-memory with 150ms debounce

3. **Dynamic Updates**: If the index is rebuilt:
   - Backend emits `search-index-ready` event
   - Frontend automatically reloads the index

## Index File Format

The search index is a JSON array of entries:

```json
[
  {
    "slug": "game-name",
    "title": "Game Name",
    "href": "https://fitgirl-repacks.site/game-name/"
  },
  ...
]
```

## Tauri Commands

Three commands are exposed for search index management:

- `rebuild_search_index(app_handle: AppHandle) -> Result<(), ScrapingError>`
  - Rebuilds the search index from all available sitemap files
  - Called automatically during bootstrap

- `get_search_index_path_cmd(app_handle: AppHandle) -> String`
  - Returns the file path to the search index JSON file

- `query_search_index(app_handle: AppHandle, query: String) -> Result<Vec<SearchIndexEntry>, ScrapingError>`
  - Optional backend filtering (currently unused by frontend)
  - Returns up to 25 matching entries

## Forcing a Rebuild

To manually rebuild the search index:

1. **Via Tauri Command** (from frontend):
   ```typescript
   await commands.rebuild_search_index();
   ```

2. **Via Rust** (during development):
   ```rust
   use fit_launcher_scraping::global::commands::rebuild_search_index;
   rebuild_search_index(app_handle).await?;
   ```

## Troubleshooting

### Search returns no results

1. **Check if index file exists**:
   - Location: `$APPDATA/com.fitlauncher.carrotrub/sitemaps/search-index.json`
   - On Windows: `%APPDATA%\com.fitlauncher.carrotrub\sitemaps\search-index.json`
   - On Linux: `~/.config/com.fitlauncher.carrotrub/sitemaps/search-index.json`
   - On macOS: `~/Library/Application Support/com.fitlauncher.carrotrub/sitemaps/search-index.json`

2. **Check bootstrap logs**:
   - Look for "Search index built successfully" or "Failed to build search index"
   - Check if sitemap downloads completed successfully

3. **Verify sitemap files exist**:
   - Check `$APPDATA/sitemaps/post-sitemap*.xml` files
   - If missing, the index cannot be built

4. **Manually trigger rebuild**:
   - Use the `rebuild_search_index` command
   - Check console for errors

### Search index error events

The frontend listens to `search-index-error` events. If you see error messages:

1. Check backend logs for detailed error information
2. Verify sitemap directory exists and is writable
3. Ensure sitemap XML files are valid

### Performance considerations

- The index is built once during bootstrap (typically < 1 second)
- Frontend filtering is instant (in-memory, debounced)
- Index file size is typically < 1MB for thousands of games

## Running Tests

### Rust Tests

Run tests for the search index module:

```bash
cd src-tauri
cargo test --package fit-launcher-scraping search_index
```

### Frontend Tests

Frontend tests are not yet configured. To test manually:

1. Start the app in dev mode: `npm run tauri dev`
2. Open the search bar
3. Type a query and verify results appear
4. Test keyboard navigation (Arrow keys, Enter, Tab)
5. Verify error states when index is missing

## Future Improvements

- Add fuzzy matching/scoring for better search results
- Cache index in IndexedDB for faster initial load
- Add search history/autocomplete
- Implement backend-side filtering for very large indices

