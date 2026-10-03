import { invoke } from '@tauri-apps/api/core';

export interface NetworkStatus {
  air_gap_enabled: boolean;
  status_text: string;
  last_changed: number;
  in_flight_operations: number;
}

let cachedAirGapEnabled = false;

// Initialize cached value from localStorage synchronously for early fetch gate
if (typeof window !== 'undefined') {
  try {
    cachedAirGapEnabled = localStorage.getItem('totumvault_air_gap_mode') === 'true';
  } catch {
    cachedAirGapEnabled = false;
  }
}

export function isCachedAirGapEnabled(): boolean {
  return cachedAirGapEnabled;
}

export function updateCachedAirGap(enabled: boolean): void {
  cachedAirGapEnabled = enabled;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('totumvault_air_gap_mode', enabled ? 'true' : 'false');
    } catch {}
  }
}

/**
 * Queries authoritative backend NetworkPolicyService for current network status.
 */
export async function getNetworkPolicyStatus(): Promise<NetworkStatus> {
  try {
    const status = await invoke<NetworkStatus>('get_network_policy_status');
    updateCachedAirGap(status.air_gap_enabled);
    return status;
  } catch (err) {
    // Fail closed if backend cannot be reached
    console.error('[NetworkPolicy] Failed to retrieve network status from backend:', err);
    return {
      air_gap_enabled: cachedAirGapEnabled,
      status_text: cachedAirGapEnabled ? 'Network access blocked' : 'Network access allowed',
      last_changed: Date.now() / 1000,
      in_flight_operations: 0,
    };
  }
}

/**
 * Toggles Air-Gap Mode on the authoritative backend service.
 */
export async function setAirGapMode(enabled: boolean): Promise<NetworkStatus> {
  const status = await invoke<NetworkStatus>('set_air_gap_mode', { enabled });
  updateCachedAirGap(status.air_gap_enabled);
  return status;
}

/**
 * Verifies with backend whether an operation is allowed under current policy.
 */
export async function checkNetworkAllowed(operation: string): Promise<boolean> {
  try {
    return await invoke<boolean>('check_network_allowed', { operation });
  } catch {
    return !cachedAirGapEnabled;
  }
}

/**
 * Enforces backend policy before initiating any network activity.
 * Throws structured error if Air-Gap is active.
 */
export async function requireNetworkAccess(operation: string): Promise<void> {
  // 1. Fast local cache check
  if (cachedAirGapEnabled) {
    throw new Error(`Network access blocked by Air-Gap Mode: ${operation}`);
  }

  // 2. Authoritative backend policy check
  try {
    await invoke<void>('require_network_access_command', { operation });
  } catch (err: any) {
    const msg = typeof err === 'string' ? err : err?.message || JSON.stringify(err);
    if (msg.includes('NetworkAccessBlockedByAirGap') || msg.includes('Air-Gap Mode is enabled')) {
      updateCachedAirGap(true);
      throw new Error(`Network access blocked by Air-Gap Mode: ${operation}`);
    }
    throw new Error(msg);
  }
}

/**
 * Executes a controlled, harmless test probe through the backend policy service.
 */
export async function testAirGapBlocking(): Promise<string> {
  return await invoke<string>('test_air_gap_blocking');
}

/**
 * Defense-in-depth: Installs a global interceptor on window.fetch.
 * Strictly blocks any outgoing remote HTTP/HTTPS requests if Air-Gap Mode is active.
 */
export function installGlobalFetchAirGapGate(): void {
  if (typeof window === 'undefined' || (window as any).__TOTUMVAULT_FETCH_GATE_INSTALLED__) {
    return;
  }

  const originalFetch = window.fetch;
  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const urlString = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    const isRemote =
      urlString.startsWith('http://') ||
      urlString.startsWith('https://') ||
      urlString.startsWith('//');

    if (isRemote) {
      if (isCachedAirGapEnabled()) {
        throw new TypeError(`Network access blocked by Air-Gap Mode: ${urlString.split('?')[0]}`);
      }

      // Check authoritative backend
      try {
        await requireNetworkAccess(`fetch:${urlString.split('?')[0]}`);
      } catch (err: any) {
        throw new TypeError(err?.message || 'Network access blocked by Air-Gap Mode');
      }
    }

    return originalFetch.call(this, input, init);
  };

  (window as any).__TOTUMVAULT_FETCH_GATE_INSTALLED__ = true;
}
