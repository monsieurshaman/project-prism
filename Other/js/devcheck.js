        document.addEventListener("DOMContentLoaded", async function() {
            document.getElementById('res-val').textContent = `${window.screen.width} x ${window.screen.height}`;
            document.getElementById('view-val').textContent = `${window.innerWidth} x ${window.innerHeight}`;

            const netVal = document.getElementById('net-val');
            netVal.textContent = navigator.onLine ? "Online" : "Offline";
            netVal.style.color = navigator.onLine ? "#00e676" : "#ff3d00";

            const uaRaw = document.getElementById('ua-raw');
            const osVal = document.getElementById('os-val');
            const browserVal = document.getElementById('browser-val');
            const deviceTypeVal = document.getElementById('device-type-val');

            if (navigator.userAgentData) {
                try {
                    const hints = await navigator.userAgentData.getHighEntropyValues([
                        "architecture", "bitness", "model", "platformVersion", "uaFullVersion"
                    ]);

                    const brandString = navigator.userAgentData.brands.map(b => `${b.brand} ${b.version}`).join(', ');
                    
                    uaRaw.textContent = `Brands: ${brandString}\nMobile: ${navigator.userAgentData.mobile}\nPlatform: ${hints.platform} ${hints.platformVersion}\nArchitecture: ${hints.architecture} ${hints.bitness}-bit\nModel: ${hints.model || 'N/A'}`;

                    osVal.textContent = `${hints.platform} ${hints.platformVersion}`;

                    const mainBrand = navigator.userAgentData.brands.find(b => !b.brand.includes("Not") && !b.brand.includes("A") && !b.brand.includes("Brand"));
                    browserVal.textContent = mainBrand ? `${mainBrand.brand} ${mainBrand.version}` : "Unknown Browser";

                    deviceTypeVal.textContent = navigator.userAgentData.mobile ? "Phone/Tablet" : "Desktop/Laptop";
                    
                } catch (error) {
                    fallbackUA();
                }
            } else {
                fallbackUA();
            }

            function fallbackUA() {
                const ua = navigator.userAgent;
                uaRaw.textContent = ua;

                let os = "Unknown OS";
                let version = "";

                const getVer = (regex) => {
                    const match = ua.match(regex);
                    return match ? match[1] : "";
                };

                if (/Tizen/i.test(ua)) {
                    os = "Samsung Tizen";
                    version = getVer(/Tizen[\s\/]([0-9\.]+)/i);
                } 
                else if (/Web0S|WebOS/i.test(ua)) {
                    os = "LG WebOS";
                    version = getVer(/Web0S|WebOS[\s\/]([0-9\.]+)/i);
                } 
                else if (/Android/i.test(ua)) {
                    const isMobile = /Mobile/i.test(ua);
                    const isTV = /TV|Smart|GoogleTV|AndroidTV/i.test(ua);
                    
                    version = getVer(/Android\s([0-9\.]+)/i);

                    if (isTV && !isMobile) {
                        os = "Android TV";
                    } else if (isMobile) {
                        os = "Android Mobile"; 
                    } else {
                        os = "Android (Tablet/Generic)";
                    }
                } 
                else if (/iPhone|iPad|iPod/i.test(ua)) {
                    os = "iOS";
                    version = getVer(/OS\s([0-9_]+)/i).replace(/_/g, '.');
                }
                else if (/Macintosh|Mac OS X/i.test(ua)) {
                    os = "macOS";
                } 
                else if (/Windows/i.test(ua)) {
                    os = "Windows";
                } 
                else if (/CrOS/i.test(ua)) {
                    os = "Chrome OS";
                } 
                else if (/Linux/i.test(ua)) {
                    os = "Linux (Generic)";
                }

                if (version) os += ` ${version}`;
                osVal.textContent = os;

                let browser = "Unknown";
                if (/SamsungBrowser/i.test(ua)) browser = "Samsung Internet " + getVer(/SamsungBrowser\/([0-9\.]+)/i);
                else if (/Chrome/i.test(ua) && !/Edge/i.test(ua) && !/OPR/i.test(ua)) browser = "Chrome " + getVer(/Chrome\/([0-9\.]+)/i);
                else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = "Safari";
                else if (/Firefox/i.test(ua)) browser = "Firefox";
                else if (/Edge/i.test(ua)) browser = "Edge";
                
                browserVal.textContent = browser;

                let type = "Desktop/Laptop";
                if (/Mobile/i.test(ua)) type = "Phone";
                else if (/Tablet|iPad/i.test(ua)) type = "Tablet";
                else if (/TV|Smart|Tizen|WebOS|BRAVIA|KDL|Viera/i.test(ua)) type = "Smart TV";
                
                if (type === "Desktop/Laptop" && /Android/i.test(ua)) {
                    type = "Tablet or TV";
                }

                deviceTypeVal.textContent = type;
            }
        });

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
    