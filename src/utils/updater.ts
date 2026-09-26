import { invoke } from '@tauri-apps/api/core';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { openUrl } from '@tauri-apps/plugin-opener';
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
    version: '1.3.2',
    os: 'linux',
    arch: 'x86_64',
  };

  try {
    appVersion = await invoke<AppVersionInfo>('get_app_version');
  } catch {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent.toLowerCase() : '';
    if (ua.includes('android')) appVersion.os = 'android';
    else if (ua.includes('win')) appVersion.os = 'windows';
    else if (ua.includes('mac')) appVersion.os = 'macos';
  }

  const isAndroid = appVersion.os.toLowerCase().includes('android');

  // 1. On Desktop platforms, first try official Tauri 2 Updater with cryptographic signature verification
  if (!isAndroid) {
    try {
      const update = await check();
      if (update) {
        return {
          currentVersion: update.currentVersion || appVersion.version,
          latestVersion: update.version,
          hasUpdate: true,
          releaseTitle: `TotumVault v${update.version}`,
          releaseNotes: update.body || 'New features, performance enhancements, and security updates.',
          publishedAt: update.date || '',
          htmlUrl: `https://github.com/RoyalRohan/TotumVault/releases/tag/v${update.version}`,
          updateObject: update,
          isDesktopUpdater: true,
        };
      }
    } catch (err: any) {
      // In development or if latest.json not hosted, fallback gracefully to GitHub API check
      console.warn('Tauri desktop updater check notice:', err);
    }
  }

  // 2. Fallback or Android release check via GitHub Releases API
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

  // Match platform-appropriate distribution asset
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
      } else if (arch.includes('armv7') || arch.includes('armeabi')) {
        if (name.includes('armv7')) {
          matchedAsset = asset;
          break;
        }
      }
      if (name.includes('universal')) {
        matchedAsset = asset;
      } else if (!matchedAsset) {
        matchedAsset = asset;
      }
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
    releaseNotes: data.body || 'New features, performance enhancements, and security updates.',
    publishedAt: data.published_at || '',
    htmlUrl: data.html_url || 'https://github.com/RoyalRohan/TotumVault/releases',
    assetName: matchedAsset?.name,
    assetDownloadUrl: matchedAsset?.browser_download_url,
    assetSize: matchedAsset?.size,
    isDesktopUpdater: false,
  };
}

/**
 * Downloads and installs the update.
 * For desktop: uses the signed Tauri 2 updater downloadAndInstall + restart.
 * For Android: downloads the APK or opens the direct release asset to trigger package installer.
 */
export async function downloadAndInstallUpdate(
  updateInfo: UpdateInfo,
  onProgress?: (progressPercent: number, statusText: string) => void
): Promise<void> {
  if (updateInfo.updateObject && updateInfo.isDesktopUpdater) {
    let totalLength = 0;
    let downloaded = 0;

    onProgress?.(5, 'Preparing secure download...');

    await updateInfo.updateObject.downloadAndInstall((event: any) => {
      switch (event.event) {
        case 'Started':
          totalLength = event.data?.contentLength || 0;
          onProgress?.(10, 'Downloading update...');
          break;
        case 'Progress':
          downloaded += event.data?.chunkLength || 0;
          if (totalLength > 0) {
            const pct = Math.min(95, Math.round(10 + (downloaded / totalLength) * 85));
            onProgress?.(
              pct,
              `Downloading: ${Math.round((downloaded / 1024 / 1024) * 10) / 10} MB / ${Math.round((totalLength / 1024 / 1024) * 10) / 10} MB`
            );
          } else {
            onProgress?.(50, 'Downloading update package...');
          }
          break;
        case 'Finished':
          onProgress?.(98, 'Verifying cryptographic signature and installing...');
          break;
      }
    });

    onProgress?.(100, 'Update installed! Restarting TotumVault...');
    await relaunch();
    return;
  }

  // Android or manual asset flow
  if (updateInfo.assetDownloadUrl) {
    onProgress?.(50, 'Opening update package...');
    try {
      await openUrl(updateInfo.assetDownloadUrl);
    } catch {
      if (typeof window !== 'undefined') {
        window.open(updateInfo.assetDownloadUrl, '_blank');
      }
    }
    onProgress?.(100, 'Installer opened. Please confirm update installation.');
  } else if (updateInfo.htmlUrl) {
    try {
      await openUrl(updateInfo.htmlUrl);
    } catch {
      if (typeof window !== 'undefined') {
        window.open(updateInfo.htmlUrl, '_blank');
      }
    }
  }
}
