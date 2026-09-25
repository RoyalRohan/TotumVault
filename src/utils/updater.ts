import { invoke } from '@tauri-apps/api/core';
import { AppVersionInfo, UpdateInfo } from '../types';

export function compareSemver(current: string, latest: string): number {
  const clean = (v: string) => v.replace(/^v/, '').trim();
  const cParts = clean(current).split('.').map((n) => parseInt(n, 10) || 0);
  const lParts = clean(latest).split('.').map((n) => parseInt(n, 10) || 0);

  for (let i = 0; i < Math.max(cParts.length, lParts.length); i++) {
    const c = cParts[i] || 0;
    const l = lParts[i] || 0;
    if (l > c) return 1; // latest is greater (update available)
    if (l < c) return -1; // current is greater
  }
  return 0; // identical
}

export async function checkAppUpdate(): Promise<UpdateInfo> {
  let appVersion: AppVersionInfo = {
    version: '1.3.0',
    os: 'linux',
    arch: 'x86_64',
  };

  try {
    appVersion = await invoke<AppVersionInfo>('get_app_version');
  } catch {
    // If running in browser or fallback
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('android')) appVersion.os = 'android';
    else if (ua.includes('win')) appVersion.os = 'windows';
    else if (ua.includes('mac')) appVersion.os = 'macos';
  }

  const endpoint = 'https://api.github.com/repos/RoyalRohan/TotumVault/releases/latest';

  const res = await fetch(endpoint, {
    headers: {
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error('No GitHub releases published yet for TotumVault.');
    }
    throw new Error(`Failed to check updates (GitHub HTTP ${res.status})`);
  }

  const data = await res.json();
  const tagName: string = data.tag_name || '';
  const latestVersion = tagName.replace(/^v/, '');
  const hasUpdate = compareSemver(appVersion.version, latestVersion) > 0;

  // Match best asset for OS & Arch
  let matchedAsset: any = null;
  const assets: any[] = data.assets || [];

  const os = appVersion.os.toLowerCase();
  const arch = appVersion.arch.toLowerCase();

  for (const asset of assets) {
    const name: string = (asset.name || '').toLowerCase();

    if (os.includes('win') && name.endsWith('.exe')) {
      matchedAsset = asset;
      break;
    } else if (os.includes('mac') && (name.endsWith('.dmg') || name.endsWith('.app.tar.gz'))) {
      matchedAsset = asset;
      break;
    } else if (os.includes('linux')) {
      if (name.endsWith('.appimage')) {
        matchedAsset = asset;
        break;
      } else if (name.endsWith('.deb')) {
        matchedAsset = asset;
      }
    } else if (os.includes('android') && name.endsWith('.apk')) {
      if (arch.includes('arm64') || arch.includes('aarch64')) {
        if (name.includes('arm64') || name.includes('aarch64')) {
          matchedAsset = asset;
          break;
        }
      }
      if (!matchedAsset) matchedAsset = asset;
    }
  }

  // Fallback to first asset if none specifically matched
  if (!matchedAsset && assets.length > 0) {
    matchedAsset = assets[0];
  }

  return {
    currentVersion: appVersion.version,
    latestVersion,
    hasUpdate,
    releaseTitle: data.name || tagName,
    releaseNotes: data.body || 'No release notes provided for this release.',
    publishedAt: data.published_at || '',
    htmlUrl: data.html_url || 'https://github.com/RoyalRohan/TotumVault/releases',
    assetName: matchedAsset?.name,
    assetDownloadUrl: matchedAsset?.browser_download_url,
    assetSize: matchedAsset?.size,
  };
}
