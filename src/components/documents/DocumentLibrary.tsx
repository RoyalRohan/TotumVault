import React, { useState, useMemo } from 'react';
import {
  Camera,
  Upload,
  Grid,
  List,
  Star,
  FileText,
  Calendar,
  Layers,
  ArrowUpDown,
} from 'lucide-react';
import { useVault } from '../../context/VaultContext';
import { DOCUMENT_CATEGORIES, getCategoryConfig } from './documentUtils';

interface DocumentLibraryProps {
  onOpenScanner: (mode: 'camera' | 'upload') => void;
  onSelectDocument: (docId: string) => void;
}

export const DocumentLibrary: React.FC<DocumentLibraryProps> = ({
  onOpenScanner,
  onSelectDocument,
}) => {
  const { documents, toggleDocumentFavorite, searchQuery, setSearchQuery } = useVault();

  // Local filter states
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'title' | 'title_desc' | 'expiry'>('newest');

  // Filter & sort documents
  const filteredDocuments = useMemo(() => {
    let list = [...documents];

    // Search query filter (matches title, description, tags, doc_type)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (doc) =>
          doc.title.toLowerCase().includes(q) ||
          doc.description.toLowerCase().includes(q) ||
          doc.doc_type.toLowerCase().includes(q) ||
          doc.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    // Category filter
    if (selectedCategory === 'favorites') {
      list = list.filter((doc) => doc.favorite);
    } else if (selectedCategory !== 'all') {
      list = list.filter((doc) => doc.doc_type.toLowerCase() === selectedCategory.toLowerCase());
    }

    // Sorting
    list.sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      } else if (sortBy === 'oldest') {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else if (sortBy === 'title') {
        return a.title.localeCompare(b.title);
      } else if (sortBy === 'title_desc') {
        return b.title.localeCompare(a.title);
      } else if (sortBy === 'expiry') {
        if (!a.expiry_date) return 1;
        if (!b.expiry_date) return -1;
        return new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime();
      }
      return 0;
    });

    return list;
  }, [documents, searchQuery, selectedCategory, sortBy]);

  // Counts for filter chips
  const favoritesCount = useMemo(() => documents.filter((d) => d.favorite).length, [documents]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-theme-bg select-none">
      {/* HEADER SECTION */}
      <div className="px-3.5 sm:px-5 py-3 sm:py-4 border-b border-theme-border shrink-0 bg-theme-surface/40 backdrop-blur-md">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-xl font-bold text-theme-text tracking-tight truncate">
                Document Vault
              </h1>
              <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 shrink-0">
                {documents.length} {documents.length === 1 ? 'doc' : 'docs'}
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-theme-text-muted mt-0.5 truncate hidden sm:block">
              Encrypted bills, IDs, receipts, and warranties. Decrypted only in memory.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onOpenScanner('camera')}
              className="py-2 px-3 sm:py-2.5 sm:px-3.5 rounded-xl bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer min-h-[38px]"
            >
              <Camera className="w-4 h-4" />
              <span>Take Photo</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenScanner('upload')}
              className="py-2 px-3 sm:py-2.5 sm:px-3.5 rounded-xl bg-theme-surface hover:bg-theme-bg border border-theme-border text-theme-text text-xs font-semibold transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer min-h-[38px]"
            >
              <Upload className="w-4 h-4 text-purple-400" />
              <span className="hidden sm:inline">Upload</span>
            </button>
          </div>
        </div>

        {/* SEARCH, FILTER CHIPS & TOOLBAR */}
        <div className="mt-3 sm:mt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3">
          {/* Category Filter Chips Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none -mx-3.5 px-3.5 sm:mx-0 sm:px-0">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-theme-surface border border-theme-border text-theme-text-muted hover:text-theme-text'
              }`}
            >
              All ({documents.length})
            </button>

            <button
              type="button"
              onClick={() => setSelectedCategory('favorites')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedCategory === 'favorites'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'bg-theme-surface border border-theme-border text-theme-text-muted hover:text-theme-text'
              }`}
            >
              <Star className="w-3.5 h-3.5 fill-current" />
              <span>Starred ({favoritesCount})</span>
            </button>

            {DOCUMENT_CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const count = documents.filter((d) => d.doc_type === cat.id).length;
              const isSelected = selectedCategory === cat.id;

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'bg-theme-surface border border-theme-border text-theme-text-muted hover:text-theme-text'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-purple-400'}`} />
                  <span>{cat.label}</span>
                  {count > 0 && <span className="opacity-70 text-[10px]">({count})</span>}
                </button>
              );
            })}
          </div>

          {/* View Toggle & Sort Controls */}
          <div className="flex items-center justify-end gap-2 shrink-0">
            {/* Sort Dropdown */}
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-theme-surface border border-theme-border rounded-xl px-2.5 py-1.5 text-xs text-theme-text font-medium appearance-none pr-7 focus:outline-none cursor-pointer"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="title">Title (A-Z)</option>
                <option value="title_desc">Title (Z-A)</option>
                <option value="expiry">Expiry Date</option>
              </select>
              <ArrowUpDown className="w-3.5 h-3.5 text-theme-text-muted absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* View Mode Toggle */}
            <div className="flex bg-theme-surface border border-theme-border rounded-xl p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-theme-text-muted hover:text-theme-text'
                }`}
                title="Grid View"
              >
                <Grid className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  viewMode === 'list'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-theme-text-muted hover:text-theme-text'
                }`}
                title="List View"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* DOCUMENT LIST / GRID VIEWPORT */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-5 pb-24 sm:pb-8">
        {filteredDocuments.length === 0 ? (
          /* EMPTY STATE */
          <div className="h-full flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shadow-inner">
              <FileText className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-bold text-theme-text">
                {documents.length === 0 ? 'No Documents Secured Yet' : 'No Matching Documents'}
              </h3>
              <p className="text-xs text-theme-text-muted mt-1 leading-relaxed">
                {documents.length === 0
                  ? 'Keep bills, ID cards, receipts, and warranties safe from prying eyes. All pages are encrypted with your master key and stored offline.'
                  : 'Try selecting a different category or clearing your search term to see other items.'}
              </p>
            </div>

            {documents.length === 0 ? (
              <div className="flex flex-col sm:flex-row items-center gap-2 pt-2 w-full">
                <button
                  type="button"
                  onClick={() => onOpenScanner('camera')}
                  className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <Camera className="w-4 h-4" />
                  <span>Scan with Camera</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenScanner('upload')}
                  className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-theme-surface hover:bg-theme-bg border border-theme-border text-theme-text text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <Upload className="w-4 h-4 text-purple-400" />
                  <span>Upload Image</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('all');
                  setSearchQuery('');
                }}
                className="py-2 px-4 rounded-xl bg-theme-surface hover:bg-theme-bg border border-theme-border text-theme-text text-xs font-semibold cursor-pointer"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          /* GRID VIEW */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 animate-scale-up">
            {filteredDocuments.map((doc) => {
              const catConfig = getCategoryConfig(doc.doc_type);
              const CatIcon = catConfig.icon;
              const isExpired = doc.expiry_date
                ? new Date(doc.expiry_date).getTime() < Date.now()
                : false;

              return (
                <div
                  key={doc.id}
                  onClick={() => onSelectDocument(doc.id)}
                  className="glass-panel group rounded-2xl border border-theme-border hover:border-purple-500/50 p-2.5 sm:p-3 flex flex-col justify-between transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 cursor-pointer"
                >
                  <div>
                    {/* Thumbnail Container */}
                    <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-black/60 border border-theme-border flex items-center justify-center group-hover:border-purple-500/30 transition-colors">
                      {doc.thumbnail_data ? (
                        <img
                          src={doc.thumbnail_data}
                          alt={doc.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-theme-text-muted">
                          <CatIcon className="w-8 h-8 sm:w-10 sm:h-10 opacity-40 text-purple-400" />
                        </div>
                      )}

                      {/* Category Badge */}
                      <div className="absolute top-2 left-2">
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-lg text-[9px] sm:text-[10px] font-bold border backdrop-blur-md shadow-sm ${catConfig.bgColor} ${catConfig.textColor} ${catConfig.borderColor}`}
                        >
                          <CatIcon className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                          <span className="hidden xs:inline sm:inline">{catConfig.label}</span>
                        </span>
                      </div>

                      {/* Favorite Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleDocumentFavorite(doc.id);
                        }}
                        className={`absolute top-2 right-2 p-1.5 rounded-lg backdrop-blur-md transition-all cursor-pointer ${
                          doc.favorite
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-black/40 text-white/70 hover:text-white hover:bg-black/60'
                        }`}
                        title="Toggle Favorite"
                      >
                        <Star className={`w-3.5 h-3.5 ${doc.favorite ? 'fill-amber-400' : ''}`} />
                      </button>

                      {/* Page Count Badge */}
                      <div className="absolute bottom-2 right-2">
                        <span className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-md text-[9px] sm:text-[10px] font-mono font-bold bg-black/70 text-white backdrop-blur-md border border-white/10 shadow-sm">
                          <Layers className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                          <span>
                            {doc.page_count} {doc.page_count === 1 ? 'pg' : 'pgs'}
                          </span>
                        </span>
                      </div>
                    </div>

                    {/* Metadata Details */}
                    <div className="mt-2.5 space-y-1">
                      <div className="flex items-start justify-between gap-1.5">
                        <h4 className="text-xs sm:text-sm font-bold text-theme-text truncate group-hover:text-purple-400 transition-colors">
                          {doc.title}
                        </h4>
                      </div>

                      {doc.description && (
                        <p className="text-[11px] sm:text-xs text-theme-text-muted line-clamp-1">
                          {doc.description}
                        </p>
                      )}

                      {/* Tags */}
                      {doc.tags && doc.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {doc.tags.slice(0, 2).map((t) => (
                            <span
                              key={t}
                              className="text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0.2 rounded bg-theme-surface text-theme-text-muted border border-theme-border font-medium truncate max-w-[80px]"
                            >
                              #{t}
                            </span>
                          ))}
                          {doc.tags.length > 2 && (
                            <span className="text-[9px] sm:text-[10px] text-theme-text-muted">
                              +{doc.tags.length - 2}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Footer: Dates */}
                  <div className="mt-2.5 pt-2 border-t border-theme-border/60 flex items-center justify-between text-[10px] sm:text-[11px] text-theme-text-muted">
                    <div className="flex items-center gap-1 min-w-0">
                      <Calendar className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-purple-400 shrink-0" />
                      <span className="truncate">{doc.document_date || new Date(doc.created_at).toLocaleDateString()}</span>
                    </div>

                    {doc.expiry_date && (
                      <span
                        className={`text-[9px] sm:text-[10px] font-semibold shrink-0 ml-1 ${
                          isExpired ? 'text-rose-500 font-bold' : 'text-theme-text-muted'
                        }`}
                      >
                        {isExpired ? 'Expired' : doc.expiry_date}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* LIST VIEW */
          <div className="space-y-2 animate-scale-up">
            {filteredDocuments.map((doc) => {
              const catConfig = getCategoryConfig(doc.doc_type);
              const CatIcon = catConfig.icon;
              const isExpired = doc.expiry_date
                ? new Date(doc.expiry_date).getTime() < Date.now()
                : false;

              return (
                <div
                  key={doc.id}
                  onClick={() => onSelectDocument(doc.id)}
                  className="glass-panel group rounded-xl border border-theme-border hover:border-purple-500/50 p-3 flex items-center justify-between gap-4 transition-all hover:bg-theme-surface/70 cursor-pointer"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    {/* Small thumbnail */}
                    <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-black/60 border border-theme-border shrink-0 flex items-center justify-center">
                      {doc.thumbnail_data ? (
                        <img
                          src={doc.thumbnail_data}
                          alt={doc.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <CatIcon className="w-6 h-6 opacity-40 text-purple-400" />
                      )}
                    </div>

                    {/* Title and tags */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold text-theme-text truncate group-hover:text-purple-400 transition-colors">
                          {doc.title}
                        </h4>
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold border ${catConfig.bgColor} ${catConfig.textColor} ${catConfig.borderColor} shrink-0`}
                        >
                          {catConfig.label}
                        </span>
                        {isExpired && (
                          <span className="text-[10px] font-bold text-rose-500 px-1.5 py-0.2 bg-rose-500/10 rounded border border-rose-500/20 shrink-0">
                            Expired
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-theme-text-muted mt-0.5">
                        <span>
                          {doc.page_count} {doc.page_count === 1 ? 'page' : 'pages'}
                        </span>
                        <span>&bull;</span>
                        <span>{doc.document_date || new Date(doc.created_at).toLocaleDateString()}</span>
                        {doc.tags && doc.tags.length > 0 && (
                          <>
                            <span>&bull;</span>
                            <span className="truncate max-w-xs">
                              {doc.tags.map((t) => `#${t}`).join(' ')}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleDocumentFavorite(doc.id);
                      }}
                      className={`p-2 rounded-lg transition-colors cursor-pointer ${
                        doc.favorite
                          ? 'text-amber-400 bg-amber-500/10'
                          : 'text-theme-text-muted hover:text-theme-text'
                      }`}
                    >
                      <Star className={`w-4 h-4 ${doc.favorite ? 'fill-amber-400' : ''}`} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
