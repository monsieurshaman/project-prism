if ('serviceWorker' in navigator) {
    const SW_VERSION_KEY = 'PRISM_SW_VERSION';
    const isStandalone = window.__PRISM_ENV__.isStandalone;

    fetch('/sw.js', { cache: 'no-store' })
        .then(res => {
            if (!res.ok) return null;
            return res.text();
        })
        .then(text => {
            if (!text) return;
            const match = text.match(/const CACHE_NAME\s*=\s*['"](.+?)['"]/);
            if (!match) return;

            const liveVersion = match[1];
            const savedVersion = localStorage.getItem(SW_VERSION_KEY);

            if (savedVersion && savedVersion !== liveVersion) {
                if (typeof PrismYourDay !== 'undefined' && PrismYourDay.notifyUpdate) {
                    PrismYourDay.notifyUpdate(liveVersion);
                }
            }

            if (savedVersion !== liveVersion) {
                if (isStandalone) {
                    alert(`Prism Update\n\nWe have found a new version for you: ${liveVersion}\n\nYou can update Prism from its update option in Settings at any time you want.`);
                } else {
                    localStorage.setItem(SW_VERSION_KEY, liveVersion);
                    navigator.serviceWorker.register(`/sw.js?standalone=${isStandalone}&includeGames=false`);
                }
            } else {
                navigator.serviceWorker.register(`/sw.js?standalone=${isStandalone}&includeGames=false`);
            }
        })
        .catch(() => { });
}