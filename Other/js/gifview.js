        const gif = document.getElementById("gif");
        const exitBtn = document.getElementById("exitBtn");

        function loadGif() {
            const input = document.getElementById("gifUrl");
            const url = input.value.trim();
            const viewer = document.querySelector(".viewer");
            const body = document.body;

            if (url && (url.startsWith('http') || url.includes('.'))) {
                gif.src = url;
                body.classList.remove("error-bg");
                viewer.classList.remove("error-shake");
            } else {
                body.classList.add("error-bg");
                viewer.classList.add("error-shake");

                setTimeout(() => {
                    body.classList.remove("error-bg");
                    viewer.classList.remove("error-shake");
                }, 1000);
            }
        }

        function goFullscreen() {
            gif.classList.add("fullscreen");
            exitBtn.classList.add("show");
        }

        function backToSmol() {
            gif.classList.remove("fullscreen");
            exitBtn.classList.remove("show");
        }

        // Back button: return to wherever this tool was opened from, if possible
        const backBtn = document.getElementById('backBtn');
        if (backBtn) {
            backBtn.addEventListener('click', (e) => {
                e.preventDefault();
                document.body.classList.add('page-leaving');
                setTimeout(() => {
                    if (window.history.length > 1) {
                        window.history.back();
                    } else {
                        window.location.href = backBtn.getAttribute('href');
                    }
                }, 220);
            });
        }
        // Guard against a stuck fade if the browser restores this page from cache
        window.addEventListener('pageshow', () => {
            document.body.classList.remove('page-leaving');
        });
    