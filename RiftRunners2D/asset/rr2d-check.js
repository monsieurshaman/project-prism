window.addEventListener('load', () => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || document.documentElement.clientWidth < 900;
    if (isMobile) {
        document.body.innerHTML = '<div id="game-container"></div>';
        const config = {
            type: Phaser.AUTO,
            parent: 'game-container',
            width: window.innerWidth,
            height: window.innerHeight,
            scene: {
                create: function () {
                    const text = this.add.text(this.cameras.main.centerX, this.cameras.main.centerY,
                        'ERROR: RIFT INSTABILITY\nPC TERMINAL REQUIRED', {
                        fontFamily: 'monospace', fontSize: '24px', color: '#ff6060', align: 'center'
                    }).setOrigin(0.5);
                    this.time.addEvent({
                        delay: 100,
                        callback: () => {
                            text.setAlpha(Math.random());
                            text.setPosition(
                                this.cameras.main.centerX + Phaser.Math.Between(-5, 5),
                                this.cameras.main.centerY + Phaser.Math.Between(-5, 5)
                            );
                        },
                        loop: true
                    });
                }
            }
        };
        new Phaser.Game(config);
    }
})();