import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export function useCtrlFHighlight() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const targetId = params.get('highlightId');
    if (!targetId) return;

    let attempts = 0;
    const maxAttempts = 30; // 3 seconds total polling time

    const findAndHighlight = () => {
      const element = document.getElementById(`row-${targetId}`) || document.getElementById(`item-${targetId}`);
      
      if (element) {
        // 1. Center in viewport smoothly
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // 2. Apply high-visibility styling
        element.classList.add('bg-amber-100', 'dark:bg-amber-900/40', 'ring-2', 'ring-amber-500', 'transition-all', 'duration-300');

        // 3. Define outside click dismissal
        const dismissHighlight = (e: MouseEvent) => {
          if (!element.contains(e.target as Node)) {
            element.classList.remove('bg-amber-100', 'dark:bg-amber-900/40', 'ring-2', 'ring-amber-500');
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.delete('highlightId');
            navigate(`${newUrl.pathname}${newUrl.search}`, { replace: true });
            document.removeEventListener('click', dismissHighlight);
          }
        };

        // Attach listener safely on the next tick
        setTimeout(() => {
          document.addEventListener('click', dismissHighlight);
        }, 100);

        return true;
      }
      return false;
    };

    if (!findAndHighlight()) {
      const interval = setInterval(() => {
        attempts++;
        if (findAndHighlight() || attempts >= maxAttempts) {
          clearInterval(interval);
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, [location.pathname, location.search, navigate]);
}