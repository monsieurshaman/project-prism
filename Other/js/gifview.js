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
    