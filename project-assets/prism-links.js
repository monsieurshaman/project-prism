(function () {
    const DEEP_LINK_ACTIONS = {
        openToolsModal: 'modal-tools',
        openOtherModal: 'modal-other'
    };

    function runDeepLink() {
        const params = new URLSearchParams(window.location.search);
        const action = params.get('action');
        const modalId = DEEP_LINK_ACTIONS[action];
        if (!modalId) return;

        params.delete('action');
        const query = params.toString();
        history.replaceState(null, '', window.location.pathname + (query ? '?' + query : '') + window.location.hash);

        requestAnimationFrame(() => openModal(modalId));
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', runDeepLink);
    } else {
        runDeepLink();
    }
})();