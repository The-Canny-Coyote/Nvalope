import { Moon, Sun } from 'lucide-react';
import { useState, useEffect } from 'react';
import { STORAGE_KEYS } from '@/app/constants/storageKeys';

function getThemeFromDOM(): 'light' | 'dark' {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>(getThemeFromDOM);

  useEffect(() => {
    try {
      const legacy = localStorage.getItem('theme');
      const saved = localStorage.getItem(STORAGE_KEYS.THEME) ?? legacy;
      if (legacy && !localStorage.getItem(STORAGE_KEYS.THEME)) {
        localStorage.setItem(STORAGE_KEYS.THEME, legacy);
        localStorage.removeItem('theme');
      }
      if (saved === 'dark' && !document.documentElement.classList.contains('dark')) {
        document.documentElement.classList.add('dark');
        setTheme('dark');
      } else if (saved === 'light' && document.documentElement.classList.contains('dark')) {
        document.documentElement.classList.remove('dark');
        setTheme('light');
      } else {
        setTheme(getThemeFromDOM());
      }
    } catch {
      setTheme(getThemeFromDOM());
    }
  }, []);

  const toggleTheme = () => {
    const currentlyDark = document.documentElement.classList.contains('dark');
    const newTheme = currentlyDark ? 'light' : 'dark';
    setTheme(newTheme);
    try {
      localStorage.setItem(STORAGE_KEYS.THEME, newTheme);
    } catch {
      /* ignore */
    }
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const ariaLabel = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="inline-flex items-center justify-center shrink-0 min-w-[var(--chonk-touch-min,44px)] min-h-[var(--chonk-touch-min,44px)] rounded-lg border border-primary/30 bg-card hover:bg-primary/10 transition-colors duration-200"
      aria-label={ariaLabel}
    >
      {theme === 'dark' ? (
        <Sun className="w-5 h-5 text-primary" aria-hidden />
      ) : (
        <Moon className="w-5 h-5 text-primary" aria-hidden />
      )}
    </button>
  );
}
