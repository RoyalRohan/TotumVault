import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

export type ThemePreference = 'dark' | 'light' | 'system';
export type ResolvedTheme = 'dark' | 'light';

export type AppFont =
  | 'inter'
  | 'geist'
  | 'ibm-plex-sans'
  | 'jetbrains-mono-nerd'
  | 'fira-code-nerd';

export interface FontDefinition {
  id: AppFont;
  name: string;
  category: string;
  fontFamily: string;
  previewText: string;
  nerdGlyphs?: string;
}

export const APP_FONTS: FontDefinition[] = [
  {
    id: 'inter',
    name: 'Inter',
    category: 'Clean Sans',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    previewText: 'Aa Bb Gg 0123 &%#@!',
  },
  {
    id: 'geist',
    name: 'Geist Sans',
    category: 'Modern Sans',
    fontFamily: "'Geist Sans', 'Geist', -apple-system, BlinkMacSystemFont, sans-serif",
    previewText: 'Aa Bb Gg 0123 &%#@!',
  },
  {
    id: 'ibm-plex-sans',
    name: 'IBM Plex Sans',
    category: 'Engineered Sans',
    fontFamily: "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif",
    previewText: 'Aa Bb Gg 0123 &%#@!',
  },
  {
    id: 'jetbrains-mono-nerd',
    name: 'JetBrains Mono',
    category: 'Developer Mono',
    fontFamily: "'JetBrainsMono Nerd Font', 'JetBrains Mono', monospace",
    previewText: 'def lock(): 󰌆 󰌾 󰘚 => 0x9333ea',
    nerdGlyphs: '󰌆 󰌾 󰘚 󰒲',
  },
  {
    id: 'fira-code-nerd',
    name: 'Fira Code',
    category: 'Ligature Mono',
    fontFamily: "'FiraCode Nerd Font', 'Fira Code', monospace",
    previewText: 'const key = [󰌆, 󰌾, 󰘚] !== null',
    nerdGlyphs: '󰌆 󰌾 󰘚 󰒲',
  },
];

interface ThemeContextType {
  theme: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemePreference) => void;
  font: AppFont;
  setFont: (font: AppFont) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

const THEME_STORAGE_KEY = 'totumvault_theme_preference';
const FONT_STORAGE_KEY = 'totumvault_font_preference';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Theme state
  const [theme, setThemeState] = useState<ThemePreference>(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY) || localStorage.getItem('veylock_theme_preference');
      if (saved === 'dark' || saved === 'light' || saved === 'system') {
        return saved;
      }
    } catch {
      // Ignore localStorage error
    }
    return 'system';
  });

  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => {
    if (theme === 'system') {
      const isDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      return isDark ? 'dark' : 'light';
    }
    return theme === 'light' ? 'light' : 'dark';
  });

  // Font state
  const [font, setFontState] = useState<AppFont>(() => {
    try {
      const savedFont = localStorage.getItem(FONT_STORAGE_KEY);
      if (
        savedFont === 'inter' ||
        savedFont === 'geist' ||
        savedFont === 'ibm-plex-sans' ||
        savedFont === 'jetbrains-mono-nerd' ||
        savedFont === 'fira-code-nerd'
      ) {
        return savedFont;
      }
    } catch {
      // Ignore localStorage error
    }
    return 'inter';
  });

  const applyTheme = useCallback((activeTheme: ThemePreference) => {
    let resolved: ResolvedTheme = 'dark';
    if (activeTheme === 'system') {
      const isDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      resolved = isDark ? 'dark' : 'light';
    } else {
      resolved = activeTheme === 'light' ? 'light' : 'dark';
    }

    setResolvedTheme(resolved);
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', resolved);
      document.documentElement.classList.remove('dark', 'light');
      document.documentElement.classList.add(resolved);
    }
  }, []);

  const setTheme = useCallback((newTheme: ThemePreference) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch {
      // Ignore error
    }
    applyTheme(newTheme);
  }, [applyTheme]);

  const applyFont = useCallback((activeFont: AppFont) => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-font', activeFont);
    }
  }, []);

  const setFont = useCallback((newFont: AppFont) => {
    setFontState(newFont);
    try {
      localStorage.setItem(FONT_STORAGE_KEY, newFont);
    } catch {
      // Ignore error
    }
    applyFont(newFont);
  }, [applyFont]);

  useEffect(() => {
    applyTheme(theme);
    applyFont(font);

    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = () => {
      if (theme === 'system') {
        applyTheme('system');
      }
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleSystemChange);
      return () => mediaQuery.removeEventListener('change', handleSystemChange);
    } else if ((mediaQuery as any).addListener) {
      (mediaQuery as any).addListener(handleSystemChange);
      return () => (mediaQuery as any).removeListener(handleSystemChange);
    }
  }, [theme, font, applyTheme, applyFont]);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, font, setFont }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};
