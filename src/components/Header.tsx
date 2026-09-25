import React, { useRef } from 'react';
import { Search, Plus, Sparkles, X, Menu } from 'lucide-react';
import { useVault } from '../context/VaultContext';
import logoImg from '../assets/logo.png';

export const Header: React.FC = () => {
  const { searchQuery, setSearchQuery, openEditor, setIsGeneratorOpen, setIsMobileNavOpen } = useVault();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    inputRef: React.RefObject<HTMLInputElement | null>
  ) => {
    if (e.key === 'Escape') {
      setSearchQuery('');
      inputRef.current?.blur();
    }
  };

  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

  return (
    <header className="border-b border-theme-border bg-theme-surface/80 backdrop-blur-xl shrink-0 select-none pt-safe text-theme-text transition-colors">
      {/* ===================== MOBILE VIEW (< md) ===================== */}
      <div className="flex flex-col md:hidden">
        {/* Tier 1: Top Navigation Bar ([Menu] --- [TotumVault Logo] --- [Generator] [+]) */}
        <div className="h-13 px-3.5 flex items-center justify-between relative">
          {/* Left: Hamburger Drawer Button */}
          <button
            onClick={() => setIsMobileNavOpen(true)}
            className="w-10 h-10 rounded-xl bg-theme-surface hover:bg-theme-hover border border-theme-border text-theme-text-muted hover:text-theme-text transition-all cursor-pointer shadow-sm flex items-center justify-center active:scale-95 shrink-0"
            title="Open Navigation Menu"
            aria-label="Open Navigation Menu"
          >
            <Menu className="w-5 h-5 text-theme-text" />
          </button>

          {/* Center: Brand Logo & Title (Proportional & Mathematically Centered) */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2 select-none pointer-events-none">
            <img
              src={logoImg}
              alt="TotumVault"
              className="w-7.5 h-7.5 rounded-lg object-cover shadow-sm ring-1 ring-white/10"
            />
            <span className="font-bold text-base tracking-tight text-theme-text">TotumVault</span>
          </div>

          {/* Right: Quick Action Buttons (Uniform Sizing, Touch-Friendly) */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setIsGeneratorOpen(true)}
              title="Password Generator"
              aria-label="Password Generator"
              className="w-10 h-10 rounded-xl bg-theme-surface hover:bg-theme-hover border border-theme-border text-theme-text-muted hover:text-purple-600 dark:hover:text-purple-400 transition-all cursor-pointer shadow-sm flex items-center justify-center active:scale-95 group"
            >
              <Sparkles className="w-4.5 h-4.5 text-purple-600 dark:text-purple-400 group-hover:rotate-12 transition-transform" />
            </button>

            <button
              onClick={() => openEditor()}
              title="New Item"
              aria-label="New Item"
              className="w-10 h-10 rounded-xl bg-purple-600 hover:bg-purple-700 active:scale-95 text-white transition-all cursor-pointer shadow-sm shadow-purple-500/25 flex items-center justify-center"
            >
              <Plus className="w-5 h-5 stroke-[2.25]" />
            </button>
          </div>
        </div>

        {/* Tier 2: Search Input with Full Width and Breathing Room */}
        <div className="px-3.5 pb-2.5 pt-0.5">
          <div className="relative w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-theme-text-muted pointer-events-none" />
            <input
              ref={mobileSearchInputRef}
              id="vault-search-input-mobile"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, mobileSearchInputRef)}
              placeholder="Search items, tags, usernames..."
              className="w-full input-themed rounded-xl pl-9.5 pr-9 py-2 text-xs sm:text-sm placeholder:text-theme-text-muted/60 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 transition-all shadow-inner shadow-black/10 min-h-[40px]"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  mobileSearchInputRef.current?.focus();
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-theme-text-muted hover:text-theme-text hover:bg-theme-hover rounded-md transition-colors cursor-pointer"
                title="Clear search"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ===================== DESKTOP VIEW (>= md) ===================== */}
      <div className="hidden md:flex h-14 px-6 items-center justify-between gap-4">
        {/* Search Input with Clear Button */}
        <div className="relative flex-1 max-w-md lg:w-84 min-w-0">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-theme-text-muted pointer-events-none" />
          <input
            ref={searchInputRef}
            id="vault-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, searchInputRef)}
            placeholder="Search items, tags, usernames..."
            className="w-full input-themed rounded-xl pl-9 pr-14 py-2.5 text-sm placeholder:text-theme-text-muted focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all shadow-inner shadow-black/10 min-h-[42px]"
          />

          {searchQuery ? (
            <button
              onClick={() => {
                setSearchQuery('');
                searchInputRef.current?.focus();
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-theme-text-muted hover:text-theme-text hover:bg-theme-hover transition-colors cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
              title="Clear search (Esc)"
              aria-label="Clear search (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <kbd className="inline-block absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono font-medium text-theme-text-muted bg-theme-surface px-1.5 py-0.5 rounded border border-theme-border pointer-events-none">
              {isMac ? '⌘K' : 'Ctrl+K'}
            </kbd>
          )}
        </div>

        {/* Quick Action Buttons with Text Labels */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => setIsGeneratorOpen(true)}
            title={`Generate Password (${isMac ? '⌘G' : 'Ctrl+G'})`}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-theme-surface hover:bg-theme-hover border border-theme-border text-theme-text text-sm font-medium transition-all shadow-sm cursor-pointer group active:scale-98 min-h-[42px]"
          >
            <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400 group-hover:rotate-12 transition-transform" />
            <span>Generator</span>
          </button>

          <button
            onClick={() => openEditor()}
            title={`New Item (${isMac ? '⌘N' : 'Ctrl+N'})`}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold transition-all shadow-sm shadow-purple-600/20 cursor-pointer active:scale-98 min-h-[42px]"
          >
            <Plus className="w-4 h-4 stroke-[2.25]" />
            <span>New Entry</span>
          </button>
        </div>
      </div>
    </header>
  );
};
