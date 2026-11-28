(function checkEngineLibraries() {
    window.addEventListener('load', function () {
        setTimeout(function () {
            let missing = [];

            if (typeof BABYLON === 'undefined') missing.push('Babylon.js');
            if (typeof CANNON === 'undefined') missing.push('Cannon.js');

            if (missing.length > 0) {
                var msg = 'The following 3D engine libraries failed to load:\n\n' +
                    missing.join('\n') +
                    '\n\nThe sandbox may not work properly.\n\nClick OK to reload the page and try again.\nClick Cancel to continue anyway.';
                if (confirm(msg)) {
                    window.location.reload();
                }
            }
        }, 1000);
    });
})();