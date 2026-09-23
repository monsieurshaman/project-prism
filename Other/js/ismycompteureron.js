        const checkBtn = document.getElementById('checkBtn');
        const controls = document.getElementById('controls');
        const logOutput = document.getElementById('log-output');
        const finalResult = document.getElementById('final-result');

        // The "Fake" tasks intended to waste time and look cool
        const tasks = [
            "hmm...",
            "something here...",
            "okay someone's here...",
            "checking if it is looking at the page...",
            "okay it is looking at this...",
            "runnin' sum checks on stuff idk...",
            "eh, boring, next...",
            "found smth...",
			"okay, the comptuer is really on...",
            "done wif the boring stuff."
        ];

        checkBtn.addEventListener('click', () => {
            // Hide the button, show the log
            controls.style.display = 'none';
            logOutput.style.display = 'block';

            let delay = 0;
            
            // Loop through tasks and create a fake delay for each
            tasks.forEach((task, index) => {
                // Randomize delay slightly to feel "human" and "processed"
                const randomTime = Math.floor(Math.random() * 2500) + 2500; 
                delay += randomTime;

                setTimeout(() => {
                    addLog(task);
                    
                    // If it's the last task, show the result
                    if (index === tasks.length - 1) {
                        setTimeout(showResult, 500);
                    }
                }, delay);
            });
        });

        function addLog(text) {
            const div = document.createElement('div');
            div.className = 'log-line';
            div.innerHTML = `> ${text}`;
            logOutput.appendChild(div);
            logOutput.scrollTop = logOutput.scrollHeight; // Auto scroll to bottom
        }

        function showResult() {
            logOutput.style.display = 'none';
            finalResult.style.display = 'block';
        }
    