import React from 'react';
import {
  Key,
  FileText,
  CreditCard,
  Server,
  Scroll,
  Terminal,
  Star,
  Clock,
  ChevronRight,
  Plus,
  SearchX,
  Folder,
  X,
} from 'lucide-react';
import { useVault } from '../context/VaultContext';
import { DecryptedEntry } from '../types';
import { getLicenseStatus, getLicenseStatusInfo } from '../utils/license';

export const EntryList: React.FC = () => {
  const {
    entries,
    selectedEntryId,
    setSelectedEntryId,
    activeCategory,
    searchQuery,
    setSearchQuery,
    openEditor,
    folders,
    selectedFolderId,
    setSelectedFolderId,
  } = useVault();

  // Filter entries based on active category, folder & search query
  const filteredEntries = entries.filter((item) => {
    // Category match
    if (activeCategory === 'favorites' && !item.favorite) return false;
    if (activeCategory === 'totp' && !item.totp_secret && item.category !== 'totp') return false;
    if (
      activeCategory !== 'all' &&
      activeCategory !== 'favorites' &&
      activeCategory !== 'totp' &&
      activeCategory !== 'health' &&
      item.category !== activeCategory
    ) {
      return false;
    }

    // Subfolder match when on logins view:
    // If user is searching, do not filter out matching logins from other folders (search finds logins across all subfolders)
    if (activeCategory === 'logins' && selectedFolderId && !searchQuery.trim()) {
      if (selectedFolderId === '__unfiled__') {
        if (item.folder_id) return false;
      } else {
        if (item.folder_id !== selectedFolderId) return false;
      }
    }

    // Search query match (Title, Username, Email, URL, Category, Tags, Host, Vendor, Cardholder, Folder name)
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const folderName = item.folder_id ? folders.find((f) => f.id === item.folder_id)?.name.toLowerCase() : '';
    return (
      item.title.toLowerCase().includes(q) ||
      item.username.toLowerCase().includes(q) ||
      item.email.toLowerCase().includes(q) ||
      item.url.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      Boolean(folderName && folderName.includes(q)) ||
      item.server_host?.toLowerCase().includes(q) ||
      item.license_vendor?.toLowerCase().includes(q) ||
      item.cardholder_name?.toLowerCase().includes(q) ||
      item.tags?.some((t) => t.toLowerCase().includes(q))
    );
  });

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'secure_notes':
        return <FileText className="w-4 h-4 stroke-[1.75]" />;
      case 'totp':
        return <Clock className="w-4 h-4 stroke-[1.75]" />;
      case 'cards':
        return <CreditCard className="w-4 h-4 stroke-[1.75]" />;
      case 'licenses':
        return <Scroll className="w-4 h-4 stroke-[1.75]" />;
      case 'servers':
        return <Server className="w-4 h-4 stroke-[1.75]" />;
      case 'api_credentials':
        return <Terminal className="w-4 h-4 stroke-[1.75]" />;
      default:
        return <Key className="w-4 h-4 stroke-[1.75]" />;
    }
  };

  const formatSubtitle = (item: DecryptedEntry) => {
    switch (item.category) {
      case 'cards': {
        const num = item.card_number || item.password || '';
        const last4 = num.replace(/\s+/g, '').slice(-4);
        if (last4) return `•••• ${last4}${item.cardholder_name ? ` • ${item.cardholder_name}` : ''}`;
        return item.cardholder_name || 'Payment Card';
      }
      case 'licenses': {
        if (item.license_vendor) {
          return `${item.license_vendor}${item.license_version ? ` • ${item.license_version}` : ''}`;
        }
        return item.username || 'Software License';
      }
      case 'servers': {
        const host = item.server_host || item.url || '';
        const proto = item.server_protocol || 'ssh';
        if (host) return `${proto}://${host}${item.server_port && item.server_port !== '22' ? `:${item.server_port}` : ''}`;
        return 'Server';
      }
      case 'api_credentials': {
        const env = item.api_environment || 'API';
        if (item.url) {
          try {
            return `${env} • ${new URL(item.url).hostname}`;
          } catch {
            return `${env} • ${item.url}`;
          }
        }
        return `${env} Key`;
      }
      case 'totp': {
        if (item.totp_issuer) return item.username ? `${item.totp_issuer} (${item.username})` : item.totp_issuer;
        if (item.username) return item.username;
        return '2FA Authenticator';
      }
      case 'secure_notes': {
        return 'Encrypted Note';
      }
      case 'logins':
      default: {
        if (item.url) {
          try {
            const u = item.url.startsWith('http') ? item.url : `https://${item.url}`;
            const domain = new URL(u).hostname.replace(/^www\./, '');
            if (domain) return domain;
          } catch {
            // fallback
          }
        }
        if (item.username) return item.username;
        if (item.email) return item.email;
        return 'No details';
      }
    }
  };

  const getCategoryLabel = () => {
    switch (activeCategory) {
      case 'all': return 'All Items';
      case 'favorites': return 'Favorites';
      case 'logins': return 'Logins';
      case 'secure_notes': return 'Secure Notes';
      case 'totp': return '2FA Authenticators';
      case 'cards': return 'Payment Cards';
      case 'licenses': return 'Software Licenses';
      case 'servers': return 'Servers';
      case 'api_credentials': return 'API Credentials';
      case 'health': return 'Security Health';
      default: return 'Items';
    }
  };

  // When browsing Software Licenses, partition entries into Active, No Expiry, and Expired sections
  const activeLicenses = filteredEntries.filter(
    (item) => getLicenseStatus(item.license_expires_at) === 'active'
  );
  const noExpiryLicenses = filteredEntries.filter(
    (item) => getLicenseStatus(item.license_expires_at) === 'no_expiry'
  );
  const expiredLicenses = filteredEntries.filter(
    (item) => getLicenseStatus(item.license_expires_at) === 'expired'
  );

  const licenseSections = [
    {
      id: 'active',
      title: 'Active',
      entries: activeLicenses,
      badgeClass:
        'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40',
      dotClass: 'bg-emerald-500',
    },
    {
      id: 'no_expiry',
      title: 'No Expiry',
      entries: noExpiryLicenses,
      badgeClass:
        'bg-slate-50 dark:bg-slate-900/40 text-slate-700 dark:text-slate-400 border border-slate-200 dark:border-slate-800/50',
      dotClass: 'bg-slate-400',
    },
    {
      id: 'expired',
      title: 'Expired',
      entries: expiredLicenses,
      badgeClass:
        'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/40',
      dotClass: 'bg-rose-500',
    },
  ].filter((sec) => sec.entries.length > 0);

  const renderEntryItem = (item: DecryptedEntry) => {
    const isSelected = selectedEntryId === item.id;
    return (
      <div
        key={item.id}
        onClick={() => setSelectedEntryId(item.id)}
        className={`p-3.5 sm:p-4 cursor-pointer transition-all flex items-center justify-between group relative min-h-[68px] ${
          isSelected
            ? 'bg-purple-50/90 dark:bg-purple-600/10 text-theme-text border-l-3 border-purple-600 dark:border-purple-400 shadow-2xs'
            : 'hover:bg-slate-100/80 dark:hover:bg-theme-hover text-theme-text-muted'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-2xs transition-transform group-hover:scale-105 ${
              isSelected
                ? 'bg-purple-100 dark:bg-purple-600/15 border border-purple-300 dark:border-purple-500/30 text-purple-700 dark:text-purple-400'
                : 'bg-white dark:bg-theme-surface border border-slate-200/90 dark:border-theme-border text-slate-600 dark:text-theme-text-muted group-hover:text-slate-950 dark:group-hover:text-theme-text'
            }`}
          >
            {getCategoryIcon(item.category)}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-semibold truncate text-slate-900 dark:text-theme-text leading-snug">
                {item.title}
              </h3>
              {item.favorite && (
                <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500 shrink-0" />
              )}
            </div>
            <p
              className={`text-xs truncate mt-0.5 font-mono ${
                isSelected
                  ? 'text-purple-900/90 dark:text-purple-300 font-medium'
                  : 'text-slate-600 dark:text-theme-text-muted'
              }`}
            >
              {formatSubtitle(item)}
            </p>

            {/* License Expiry Status Pill */}
            {item.category === 'licenses' && (
              <div className="flex items-center gap-1 mt-1">
                <span
                  className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium border ${
                    getLicenseStatusInfo(item.license_expires_at).badgeClass
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      getLicenseStatusInfo(item.license_expires_at).dotClass
                    }`}
                  />
                  <span>
                    {getLicenseStatusInfo(item.license_expires_at).label}
                    {item.license_expires_at ? ` • ${item.license_expires_at}` : ''}
                  </span>
                </span>
              </div>
            )}

            {/* Folder Badge if item belongs to a folder */}
            {item.category === 'logins' && item.folder_id && (
              <div className="flex items-center gap-1 mt-1">
                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-purple-100/70 dark:bg-purple-950/40 text-purple-900 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40 font-medium">
                  <Folder className="w-2.5 h-2.5 shrink-0" />
                  <span className="truncate max-w-[120px]">
                    {folders.find((f) => f.id === item.folder_id)?.name || 'Folder'}
                  </span>
                </span>
              </div>
            )}

            {/* Tag Chips Preview */}
            {item.tags && item.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {item.tags.slice(0, 2).map((t) => (
                  <span
                    key={t}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-white dark:bg-theme-surface border border-slate-200 dark:border-theme-border text-slate-700 dark:text-theme-text-muted font-medium"
                  >
                    #{t}
                  </span>
                ))}
                {item.tags.length > 2 && (
                  <span className="text-xs text-slate-500 dark:text-theme-text-dim">
                    +{item.tags.length - 2}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 pl-2">
          {item.totp_secret && (
            <span title="2FA Authenticator Active">
              <Clock className="w-4 h-4 stroke-[1.75] text-purple-600 dark:text-purple-400 shrink-0" />
            </span>
          )}
          <ChevronRight
            className={`w-4.5 h-4.5 group-hover:translate-x-0.5 transition-all ${
              isSelected
                ? 'text-purple-600 dark:text-purple-400 opacity-100'
                : 'text-slate-400 dark:text-theme-text-dim opacity-50 group-hover:opacity-100'
            }`}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="w-full h-full md:border-r border-theme-border bg-theme-surface/40 flex flex-col select-none text-theme-text">
      {/* List Header */}
      <div className="px-4 py-3 border-b border-theme-border flex items-center justify-between text-xs font-medium bg-theme-surface/60">
        <span className="font-semibold text-theme-text">{getCategoryLabel()}</span>
        <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-theme-elevated border border-theme-border text-theme-text-muted">
          {filteredEntries.length}
        </span>
      </div>

      {/* Folder Breadcrumb Filter Header if filtered by folder */}
      {activeCategory === 'logins' && selectedFolderId && (
        <div className="px-4 py-2 bg-purple-50 dark:bg-purple-950/20 border-b border-purple-200 dark:border-purple-800/30 flex items-center justify-between text-xs animate-fade-in">
          <div className="flex items-center gap-1.5 text-purple-950 dark:text-purple-200">
            <Folder className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
            <span className="font-semibold">
              {selectedFolderId === '__unfiled__'
                ? 'Unfiled Logins'
                : folders.find((f) => f.id === selectedFolderId)?.name || 'Folder'}
            </span>
          </div>
          <button
            onClick={() => setSelectedFolderId(null)}
            className="text-purple-700 dark:text-purple-300 hover:text-purple-950 dark:hover:text-white flex items-center gap-1 font-medium cursor-pointer"
            title="View all logins"
          >
            <X className="w-3 h-3" />
            <span>All Logins</span>
          </button>
        </div>
      )}

      {/* Items Scroll Area */}
      <div className="flex-1 overflow-y-auto divide-y divide-theme-border/60 pb-28 md:pb-4">
        {filteredEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center h-full text-theme-text-muted">
            {searchQuery ? (
              <>
                <SearchX className="w-8 h-8 mb-3 text-theme-text-dim stroke-[1.5]" />
                <p className="text-sm font-semibold text-theme-text mb-1">No matching results</p>
                <p className="text-xs text-theme-text-muted mb-4 max-w-[220px]">
                  No items match "{searchQuery}" in this view.
                </p>
                <button
                  onClick={() => setSearchQuery('')}
                  className="px-3.5 py-2 rounded-xl bg-theme-surface hover:bg-theme-hover text-theme-text border border-theme-border text-xs font-medium transition-colors cursor-pointer"
                >
                  Clear Search
                </button>
              </>
            ) : (
              <>
                <div className="w-11 h-11 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400 mb-3">
                  <Key className="w-5 h-5 stroke-[1.75]" />
                </div>
                <p className="text-sm font-semibold text-theme-text mb-1">No entries yet</p>
                <p className="text-xs text-theme-text-muted mb-4 max-w-[220px]">
                  Add your first item to this category to get started.
                </p>
                <button
                  onClick={() => openEditor()}
                  className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white text-xs font-medium flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
                >
                  <Plus className="w-4 h-4 stroke-[1.75]" />
                  <span>Create Item</span>
                </button>
              </>
            )}
          </div>
        ) : activeCategory === 'licenses' ? (
          <div>
            {licenseSections.map((sec) => (
              <div key={sec.id}>
                <div className="px-4 py-2 bg-theme-surface/90 dark:bg-theme-surface/80 border-b border-theme-border/60 flex items-center justify-between text-xs font-semibold tracking-wide text-theme-text-muted sticky top-0 backdrop-blur-md z-10 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${sec.dotClass}`} />
                    <span className="uppercase text-[11px] font-bold text-slate-800 dark:text-theme-text tracking-wider">
                      {sec.title}
                    </span>
                  </div>
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${sec.badgeClass}`}>
                    {sec.entries.length}
                  </span>
                </div>
                <div className="divide-y divide-theme-border/60">
                  {sec.entries.map((item) => renderEntryItem(item))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          filteredEntries.map((item) => renderEntryItem(item))
        )}
      </div>
    </div>
  );
};
