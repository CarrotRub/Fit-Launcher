// Unified debrid API for all providers (TorBox, RealDebrid, AllDebrid, etc.)

import { commands } from "../../bindings";
import type {
    CredentialError,
    CredentialInfo,
    CredentialStatus,
    DebridCacheStatus,
    DebridDirectLink,
    DebridError,
    DebridFile,
    DebridProvider,
    DebridProviderInfo,
    DebridTorrentInfo,
    DebridTorrentStatus,
    Result,
} from "../../bindings";

// Re-export types for convenience
export type {
    CredentialError,
    CredentialInfo,
    CredentialStatus,
    DebridCacheStatus,
    DebridDirectLink,
    DebridError,
    DebridFile,
    DebridProvider,
    DebridProviderInfo,
    DebridTorrentInfo,
    DebridTorrentStatus,
};

// Credential Management

// Store API key for a debrid provider securely
export async function storeCredential(
    provider: DebridProvider,
    apiKey: string
): Promise<Result<null, CredentialError>> {
    return commands.credentialsStore(provider, apiKey);
}

// Get stored API key for a provider
export async function getCredential(
    provider: DebridProvider
): Promise<Result<string, CredentialError>> {
    return commands.credentialsGet(provider);
}

// Check if credential exists for a provider
export async function hasCredential(
    provider: DebridProvider
): Promise<Result<boolean, CredentialError>> {
    return commands.credentialsExists(provider);
}

// Remove a stored credential
export async function removeCredential(
    provider: DebridProvider
): Promise<Result<null, CredentialError>> {
    return commands.credentialsRemove(provider);
}

// Get status of a provider's credential
export async function getCredentialStatus(
    provider: DebridProvider
): Promise<Result<CredentialStatus, CredentialError>> {
    return commands.credentialsStatus(provider);
}

// List all configured providers
export async function listCredentials(): Promise<Result<CredentialInfo, CredentialError>> {
    return commands.credentialsList();
}

// ============================================================================
// Provider Information (Source of truth for UI)
// ============================================================================

// Get all available debrid providers with metadata (source of truth for UI)
export async function listProviders(): Promise<DebridProviderInfo[]> {
    return commands.debridListProviders();
}

// ============================================================================
// Debrid Operations (API keys retrieved from secure store automatically)
// ============================================================================

// Check if a torrent is cached on a debrid provider
export async function checkCache(
    provider: DebridProvider,
    hash: string
): Promise<Result<DebridCacheStatus, DebridError>> {
    return commands.debridCheckCache(provider, hash);
}

// Add a torrent to a debrid provider (only adds if cached)
export async function addTorrent(
    provider: DebridProvider,
    magnet: string
): Promise<Result<string, DebridError>> {
    return commands.debridAddTorrent(provider, magnet);
}

// Get torrent info including file list from a debrid provider
export async function getTorrentInfo(
    provider: DebridProvider,
    torrentId: string
): Promise<Result<DebridTorrentInfo, DebridError>> {
    return commands.debridGetTorrentInfo(provider, torrentId);
}

// Get a direct download link for a single file
export async function getDownloadLink(
    provider: DebridProvider,
    torrentId: string,
    file: DebridFile
): Promise<Result<DebridDirectLink, DebridError>> {
    return commands.debridGetDownloadLink(provider, torrentId, file);
}

// Get download links for multiple files at once
export async function getDownloadLinks(
    provider: DebridProvider,
    torrentId: string,
    files: DebridFile[]
): Promise<Result<DebridDirectLink[], DebridError>> {
    return commands.debridGetDownloadLinks(provider, torrentId, files);
}

// Get torrent status for polling caching progress
export async function getTorrentStatus(
    provider: DebridProvider,
    torrentId: string
): Promise<Result<DebridTorrentStatus, DebridError>> {
    return commands.debridGetTorrentStatus(provider, torrentId);
}

// Delete a torrent from a debrid provider
export async function deleteTorrent(
    provider: DebridProvider,
    torrentId: string
): Promise<Result<null, DebridError>> {
    return commands.debridDeleteTorrent(provider, torrentId);
}

// Poll until torrent is ready or timeout
export async function waitForTorrentReady(
    provider: DebridProvider,
    torrentId: string,
    timeoutMs: number = 3000,
    pollIntervalMs: number = 500
): Promise<{ ready: boolean; status: DebridTorrentStatus | null }> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
        const result = await getTorrentStatus(provider, torrentId);
        if (result.status === "ok") {
            if (result.data.is_ready) {
                return { ready: true, status: result.data };
            }
        } else {
            // Error getting status, return failure
            return { ready: false, status: null };
        }

        // Wait before next poll
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    // Timeout - get final status
    const finalResult = await getTorrentStatus(provider, torrentId);
    if (finalResult.status === "ok") {
        return { ready: finalResult.data.is_ready, status: finalResult.data };
    }
    return { ready: false, status: null };
}

// Extract info hash from a magnet link
export function extractHashFromMagnet(magnet: string): string | null {
    // Accepts 40-hex (hexadecimal) or 32-base32 (magnet btih base32) info hashes
    const match = magnet.match(/xt=urn:btih:([a-f0-9]{40}|[A-Z2-7]{32})/i);
    return match ? match[1].toLowerCase() : null;
}

// Convert DebridDirectLink[] to DirectLink[] for aria2 integration
export function toDirectLinks(debridLinks: DebridDirectLink[]): {
    url: string;
    filename: string;
    size: number;
}[] {
    return debridLinks.map((link) => ({
        url: link.url,
        filename: link.filename,
        size: link.size,
    }));
}
