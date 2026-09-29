import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Camera,
  Upload,
  Grid,
  List,
  Star,
  FileText,
  Layers,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Eye,
  Pencil,
  Trash2,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { useVault } from '../../context/VaultContext';
import { DOCUMENT_CATEGORIES, getCategoryConfig, getDocumentExpiryDisplay } from './documentUtils';
import { useHorizontalScroll } from '../../utils/useHorizontalScroll';
import { formatDisplayDate, getDualDateInfo } from '../../utils/nepaliCalendar';
import { DocumentEditModal } from './DocumentEditModal';

interface DocumentLibraryProps {
  onOpenScanner: (mode: 'camera' | 'upload') => void;
  onSelectDocument: (docId: string) => void;
}

export const DocumentLibrary: React.FC<DocumentLibraryProps> = ({
  onOpenScanner,
  onSelectDocument,
}) => {
  const {
    documents,
    toggleDocumentFavorite,
    deleteDocument,
    searchQuery,
    setSearchQuery,
    calendarPreference,
    numeralPreference,
    showToast,
  } = useVault();

  // Local filter states
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'title' | 'title_desc' | 'expiry'>('newest');

  // Menu, Edit & Delete modal states
  const [activeMenuDocId, setActiveMenuDocId] = useState<string | null>(null);
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [deletingDoc, setDeletingDoc] = useState<{ id: string; title: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);

  const addMenuRef = useRef<HTMLDivElement>(null);
  const cardMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setShowAddMenu(false);
      }
      if (cardMenuRef.current && !cardMenuRef.current.contains(e.target as Node)) {
        setActiveMenuDocId(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Mouse wheel and drag horizontal scrolling for category filter chips
  const {
    scrollRef: chipsScrollRef,
    canScrollLeft,
    canScrollRight,
    scrollByLeft,
    scrollByRight,
    isDragging,
  } = useHorizontalScroll<HTMLDivElement>();

  // Filter & sort documents
  const filteredDocuments = useMemo(() => {
    let list = [...documents];

    // Search query filter (matches title, description, tags, doc_type, and AD / BS dates)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((doc) => {
        if (
          doc.title.toLowerCase().includes(q) ||
          doc.description.toLowerCase().includes(q) ||
          doc.doc_type.toLowerCase().includes(q) ||
          doc.tags.some((t) => t.toLowerCase().includes(q))
        ) {
          return true;
        }

        // Match against dates in both AD and Bikram Sambat BS formats
        const checkDateMatch = (dateStr?: string) => {
          if (!dateStr) return false;
          if (dateStr.toLowerCase().includes(q)) return true;
          const info = getDualDateInfo(dateStr, false);
          if (info) {
            if (
              info.formattedDual.toLowerCase().includes(q) ||
              info.formattedBs.toLowerCase().includes(q) ||
              info.canonicalBsStr.includes(q) ||
              info.bs.year.toString().includes(q)
            ) {
              return true;
            }
          }
          const infoNe = getDualDateInfo(dateStr, true);
          if (infoNe && (infoNe.formattedBs.includes(q) || infoNe.formattedDual.includes(q))) {
            return true;
          }
          return false;
        };

        return checkDateMatch(doc.document_date) || checkDateMatch(doc.expiry_date);
      });
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

  // Confirm and execute document deletion
  const handleConfirmDelete = async () => {
    if (!deletingDoc) return;
    setIsDeleting(true);
    try {
      await deleteDocument(deletingDoc.id);
      setDeletingDoc(null);
    } catch {
      showToast("Couldn't delete the document.", 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex-1 min-h-0 min-w-0 w-full flex flex-col h-full overflow-hidden bg-theme-bg select-none">
      {/* HEADER SECTION */}
      <div className="px-3.5 sm:px-5 py-3 sm:py-3.5 border-b border-theme-border shrink-0 bg-theme-surface/50 backdrop-blur-md">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-theme-text tracking-tight truncate">
              Documents
            </h1>
            <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 shrink-0">
              {documents.length} {documents.length === 1 ? 'doc' : 'docs'}
            </span>
          </div>

          {/* Primary Add Document Button with 2-option choice */}
          <div className="relative shrink-0" ref={addMenuRef}>
            <button
              type="button"
              onClick={() => setShowAddMenu(!showAddMenu)}
              className="py-2 px-3.5 rounded-xl bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white text-xs font-semibold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer min-h-[38px]"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Add Document</span>
            </button>

            {/* Quick Choice Dropdown */}
            {showAddMenu && (
              <div className="absolute right-0 mt-1.5 w-44 rounded-2xl border border-theme-border bg-theme-surface shadow-2xl p-1.5 z-30 animate-scale-up text-xs font-medium">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddMenu(false);
                    onOpenScanner('camera');
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-theme-text hover:bg-theme-hover transition-colors cursor-pointer text-left"
                >
                  <Camera className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span>Scan Document</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddMenu(false);
                    onOpenScanner('upload');
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-theme-text hover:bg-theme-hover transition-colors cursor-pointer text-left"
                >
                  <Upload className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span>Choose File</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* SEARCH & FILTERS BAR */}
        <div className="mt-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          {/* Search Field */}
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search documents..."
              className="input-themed w-full rounded-xl pl-9 pr-8 py-2 text-xs"
            />
            <Search className="w-4 h-4 text-theme-text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-theme-text-muted hover:text-theme-text p-0.5 cursor-pointer"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* View Toggle & Sort Controls */}
          <div className="flex items-center justify-end gap-2 shrink-0">
            {/* Sort Dropdown */}
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-theme-surface border border-theme-border rounded-xl px-2.5 py-1.5 text-xs text-theme-text font-medium appearance-none pr-7 focus:outline-none cursor-pointer min-h-[34px]"
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
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-theme-text-muted hover:text-theme-text'
                }`}
                title="Grid View"
                aria-label="Grid View"
              >
                <Grid className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  viewMode === 'list'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-theme-text-muted hover:text-theme-text'
                }`}
                title="List View"
                aria-label="List View"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Category Filter Chips Bar */}
        <div className="relative mt-2.5 flex items-center group -mx-3.5 px-3.5 sm:mx-0 sm:px-0">
          {canScrollLeft && (
            <button
              type="button"
              onClick={() => scrollByLeft(220)}
              aria-label="Scroll categories left"
              className="absolute left-0 z-10 hidden sm:flex items-center justify-center w-6 h-6 rounded-full bg-white dark:bg-theme-surface border border-slate-200 dark:border-theme-border text-slate-700 dark:text-theme-text shadow-sm hover:bg-slate-100 dark:hover:bg-theme-hover active:scale-95 transition-all cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          )}

          <div
            ref={chipsScrollRef}
            className={`flex-1 flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none select-none scroll-smooth ${
              canScrollLeft ? 'sm:pl-7' : ''
            } ${canScrollRight ? 'sm:pr-7' : ''} ${
              isDragging ? 'cursor-grabbing' : 'cursor-grab'
            }`}
          >
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-white dark:bg-theme-surface border border-slate-200/90 dark:border-theme-border text-slate-700 dark:text-theme-text-muted hover:text-slate-950 dark:hover:text-theme-text hover:bg-slate-100/80 dark:hover:bg-theme-hover'
              }`}
            >
              All ({documents.length})
            </button>

            <button
              type="button"
              onClick={() => setSelectedCategory('favorites')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedCategory === 'favorites'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-white dark:bg-theme-surface border border-slate-200/90 dark:border-theme-border text-slate-700 dark:text-theme-text-muted hover:text-slate-950 dark:hover:text-theme-text hover:bg-slate-100/80 dark:hover:bg-theme-hover'
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
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'bg-white dark:bg-theme-surface border border-slate-200/90 dark:border-theme-border text-slate-700 dark:text-theme-text-muted hover:text-slate-950 dark:hover:text-theme-text hover:bg-slate-100/80 dark:hover:bg-theme-hover'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 stroke-[1.75] ${isSelected ? 'text-white' : 'text-purple-600 dark:text-purple-400'}`} />
                  <span>{cat.label}</span>
                  {count > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      isSelected
                        ? 'bg-purple-700 text-white'
                        : 'bg-slate-100 dark:bg-theme-elevated text-slate-700 dark:text-theme-text-muted border border-slate-200 dark:border-theme-border font-bold'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {canScrollRight && (
            <button
              type="button"
              onClick={() => scrollByRight(220)}
              aria-label="Scroll categories right"
              className="absolute right-0 z-10 hidden sm:flex items-center justify-center w-6 h-6 rounded-full bg-white dark:bg-theme-surface border border-slate-200 dark:border-theme-border text-slate-700 dark:text-theme-text shadow-sm hover:bg-slate-100 dark:hover:bg-theme-hover active:scale-95 transition-all cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* DOCUMENT LIST / GRID VIEWPORT */}
      <div
        className="flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-5 pb-28 sm:pb-8 pb-safe pl-safe pr-safe overscroll-y-contain focus:outline-none"
        tabIndex={0}
        role="region"
        aria-label="Documents library"
      >
        {filteredDocuments.length === 0 ? (
          /* EMPTY STATE */
          <div className="h-full flex flex-col items-center justify-center p-8 text-center max-w-sm mx-auto space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shadow-inner">
              <FileText className="w-8 h-8 stroke-[1.75]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-theme-text">
                {documents.length === 0 ? 'No documents yet.' : 'No matching documents'}
              </h3>
              <p className="text-xs text-theme-text-muted mt-1">
                {documents.length === 0
                  ? 'Keep personal IDs, bills, and warranties safe and offline.'
                  : 'Try selecting another category or clearing your search.'}
              </p>
            </div>

            <div className="flex items-center gap-2 pt-1 w-full justify-center">
              {documents.length === 0 ? (
                <>
                  <button
                    type="button"
                    onClick={() => onOpenScanner('camera')}
                    className="py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Scan Document</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenScanner('upload')}
                    className="py-2.5 px-4 rounded-xl bg-theme-surface hover:bg-theme-hover border border-theme-border text-theme-text text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Upload className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <span>Choose File</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory('all');
                    setSearchQuery('');
                  }}
                  className="py-2 px-4 rounded-xl bg-theme-surface hover:bg-theme-hover border border-theme-border text-theme-text text-xs font-semibold cursor-pointer"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>
        ) : viewMode === 'grid' ? (
          /* GRID VIEW */
          <div className="grid grid-cols-1 min-[340px]:grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5 sm:gap-4 animate-scale-up">
            {filteredDocuments.map((doc) => {
              const catConfig = getCategoryConfig(doc.doc_type);
              const CatIcon = catConfig.icon;
              const expiryInfo = getDocumentExpiryDisplay(doc.expiry_date);
              const isMenuOpen = activeMenuDocId === doc.id;

              return (
                <div
                  key={doc.id}
                  onClick={() => onSelectDocument(doc.id)}
                  className="glass-panel group relative rounded-2xl border border-theme-border hover:border-purple-500/50 p-3 flex flex-col justify-between transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 cursor-pointer bg-theme-surface/70"
                >
                  <div>
                    {/* Thumbnail Container */}
                    <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-black/60 border border-theme-border flex items-center justify-center group-hover:border-purple-500/30 transition-colors">
                      {doc.thumbnail_data ? (
                        <img
                          src={doc.thumbnail_data}
                          alt={doc.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-theme-text-muted">
                          <CatIcon className="w-8 h-8 opacity-40 text-purple-600 dark:text-purple-400 stroke-[1.75]" />
                        </div>
                      )}

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
                        title={doc.favorite ? 'Favorited' : 'Favorite'}
                        aria-label={doc.favorite ? 'Favorited' : 'Favorite'}
                      >
                        <Star className={`w-3.5 h-3.5 ${doc.favorite ? 'fill-amber-400' : ''}`} />
                      </button>

                      {/* Page Count Badge (Multi-page indicator) */}
                      {doc.page_count > 1 && (
                        <div className="absolute bottom-2 right-2">
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold bg-black/75 text-white backdrop-blur-md border border-white/10 shadow-xs">
                            <Layers className="w-2.5 h-2.5" />
                            <span>{doc.page_count} pgs</span>
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Metadata: 1. Title, 2. Type, 3. Expiry / Status */}
                    <div className="mt-2.5 space-y-1">
                      {/* 1. DOCUMENT TITLE */}
                      <h4 className="text-sm font-bold text-theme-text truncate group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                        {doc.title}
                      </h4>

                      {/* 2. DOCUMENT TYPE */}
                      <div className="flex items-center gap-1 text-xs text-theme-text-muted">
                        <CatIcon className="w-3 h-3 text-purple-600 dark:text-purple-400 shrink-0" />
                        <span className="truncate">{catConfig.label}</span>
                      </div>

                      {/* 3. EXPIRY / STATUS */}
                      <div className="pt-0.5">
                        <span className={`text-[11px] block truncate ${expiryInfo.badgeClass}`}>
                          {expiryInfo.label}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer: Date & 3-dot Menu */}
                  <div className="mt-3 pt-2 border-t border-theme-border/60 flex items-center justify-between text-[11px] text-theme-text-muted relative">
                    <span className="truncate">
                      {doc.document_date
                        ? formatDisplayDate(doc.document_date, calendarPreference, numeralPreference)
                        : new Date(doc.created_at).toLocaleDateString()}
                    </span>

                    {/* 3-Dot Menu Button */}
                    <div className="relative" ref={isMenuOpen ? cardMenuRef : undefined}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuDocId(isMenuOpen ? null : doc.id);
                        }}
                        className="p-1 rounded-lg text-theme-text-muted hover:text-theme-text hover:bg-theme-hover transition-colors cursor-pointer"
                        title="Document options"
                        aria-label="Document options"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {/* 3-Dot Action Menu */}
                      {isMenuOpen && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute right-0 bottom-full mb-1.5 w-36 rounded-2xl border border-theme-border bg-theme-surface shadow-2xl p-1 z-30 animate-scale-up text-xs font-medium"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuDocId(null);
                              onSelectDocument(doc.id);
                            }}
                            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-theme-text hover:bg-theme-hover transition-colors cursor-pointer text-left"
                          >
                            <Eye className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                            <span>View</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuDocId(null);
                              setEditingDocId(doc.id);
                            }}
                            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-theme-text hover:bg-theme-hover transition-colors cursor-pointer text-left"
                          >
                            <Pencil className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuDocId(null);
                              toggleDocumentFavorite(doc.id);
                            }}
                            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-theme-text hover:bg-theme-hover transition-colors cursor-pointer text-left"
                          >
                            <Star className={`w-3.5 h-3.5 ${doc.favorite ? 'fill-amber-400 text-amber-400' : 'text-slate-400'}`} />
                            <span>{doc.favorite ? 'Unfavorite' : 'Favorite'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuDocId(null);
                              setDeletingDoc({ id: doc.id, title: doc.title });
                            }}
                            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer text-left"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete</span>
                          </button>
                        </div>
                      )}
                    </div>
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
              const expiryInfo = getDocumentExpiryDisplay(doc.expiry_date);
              const isMenuOpen = activeMenuDocId === doc.id;

              return (
                <div
                  key={doc.id}
                  onClick={() => onSelectDocument(doc.id)}
                  className="glass-panel group rounded-xl border border-theme-border hover:border-purple-500/50 p-3 flex items-center justify-between gap-3 transition-all hover:bg-theme-surface/70 cursor-pointer bg-theme-surface/60"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Thumbnail */}
                    <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-black/60 border border-theme-border shrink-0 flex items-center justify-center">
                      {doc.thumbnail_data ? (
                        <img
                          src={doc.thumbnail_data}
                          alt={doc.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <CatIcon className="w-5 h-5 opacity-40 text-purple-600 dark:text-purple-400 stroke-[1.75]" />
                      )}
                    </div>

                    {/* Metadata details */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-theme-text truncate group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                          {doc.title}
                        </h4>
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 shrink-0">
                          {catConfig.label}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-theme-text-muted mt-0.5 truncate">
                        <span className={`text-[11px] ${expiryInfo.badgeClass}`}>
                          {expiryInfo.label}
                        </span>
                        <span>&bull;</span>
                        <span>
                          {doc.document_date
                            ? formatDisplayDate(doc.document_date, calendarPreference, numeralPreference)
                            : new Date(doc.created_at).toLocaleDateString()}
                        </span>
                        {doc.page_count > 1 && (
                          <>
                            <span>&bull;</span>
                            <span>{doc.page_count} pgs</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Actions: Favorite & 3-Dot Menu */}
                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => toggleDocumentFavorite(doc.id)}
                      className={`p-2 rounded-xl transition-colors cursor-pointer ${
                        doc.favorite
                          ? 'text-amber-400 bg-amber-500/10'
                          : 'text-theme-text-muted hover:text-theme-text hover:bg-theme-hover'
                      }`}
                      title={doc.favorite ? 'Favorited' : 'Favorite'}
                      aria-label={doc.favorite ? 'Favorited' : 'Favorite'}
                    >
                      <Star className={`w-4 h-4 ${doc.favorite ? 'fill-amber-400' : ''}`} />
                    </button>

                    <div className="relative" ref={isMenuOpen ? cardMenuRef : undefined}>
                      <button
                        type="button"
                        onClick={() => setActiveMenuDocId(isMenuOpen ? null : doc.id)}
                        className="p-2 rounded-xl text-theme-text-muted hover:text-theme-text hover:bg-theme-hover transition-colors cursor-pointer"
                        title="More options"
                        aria-label="More options"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {/* 3-Dot Action Menu */}
                      {isMenuOpen && (
                        <div className="absolute right-0 top-full mt-1 w-36 rounded-2xl border border-theme-border bg-theme-surface shadow-2xl p-1 z-30 animate-scale-up text-xs font-medium">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuDocId(null);
                              onSelectDocument(doc.id);
                            }}
                            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-theme-text hover:bg-theme-hover transition-colors cursor-pointer text-left"
                          >
                            <Eye className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                            <span>View</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuDocId(null);
                              setEditingDocId(doc.id);
                            }}
                            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-theme-text hover:bg-theme-hover transition-colors cursor-pointer text-left"
                          >
                            <Pencil className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuDocId(null);
                              toggleDocumentFavorite(doc.id);
                            }}
                            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-theme-text hover:bg-theme-hover transition-colors cursor-pointer text-left"
                          >
                            <Star className={`w-3.5 h-3.5 ${doc.favorite ? 'fill-amber-400 text-amber-400' : 'text-slate-400'}`} />
                            <span>{doc.favorite ? 'Unfavorite' : 'Favorite'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuDocId(null);
                              setDeletingDoc({ id: doc.id, title: doc.title });
                            }}
                            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer text-left"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Document Modal */}
      {editingDocId && (
        <DocumentEditModal
          documentId={editingDocId}
          isOpen={true}
          onClose={() => setEditingDocId(null)}
        />
      )}

      {/* Delete Document Confirmation Dialog */}
      {deletingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md select-none animate-scale-up">
          <div className="w-full max-w-sm glass-panel rounded-2xl p-5 border border-theme-border bg-theme-bg shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-theme-text">Delete document?</h3>
                <p className="text-xs text-theme-text-muted mt-0.5">
                  "{deletingDoc.title}" will be permanently deleted.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDeletingDoc(null)}
                disabled={isDeleting}
                className="py-2.5 rounded-xl border border-theme-border bg-theme-surface hover:bg-theme-hover text-theme-text text-xs font-semibold cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer shadow-xs transition-colors disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
