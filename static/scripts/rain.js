(() => {
    const canvas = document.getElementById('rain-canvas');
    const ctx = canvas.getContext('2d');
    const dropOffset = 8; 
    const dropSpawnOffset = 800;
    const fadeLatency = 0.01;
    const opacityValue = 0.75;
    const MAX_FADING_DROPS = 100;

    let width, height;
    let fallingDrops = [];
    let fadingDrops = [];
    let fadingDropPool = []; 
    function resizeCanvas() {
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = width;
        canvas.height = height;
    }

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    function createFallingDrop() {
        const speed = 8;
        const angle = 0.5 + Math.random() * 0.2;
        return {
            x: Math.random() * (width + dropSpawnOffset * 2) - dropSpawnOffset,
            y: Math.random() * height, 
            length: Math.random() * 20 + 25,
            speedX: speed * angle,
            speedY: speed,
            opacity: opacityValue
        };
    }

    function getFadingDrop(x, y) {
        let drop = fadingDropPool.pop() || {};
        drop.x = x;
        drop.y = y;
        drop.radiusX = 4 + Math.random() * 5;
        drop.radiusY = 0.8 + Math.random() * 1;
        drop.fadeOpacity = opacityValue;
        return drop;
    }

    function recycleFadingDrop(drop) {
        fadingDropPool.push(drop); // 
    }

    // Initialize drops
    for (let i = 0; i < 200; i++) {
        fallingDrops.push(createFallingDrop());
    }

    function drawRain() {
        ctx.clearRect(0, 0, width, height);
        ctx.lineWidth = 1;

        fallingDrops.forEach(drop => {
            ctx.strokeStyle = `rgba(130,0,0,${drop.opacity})`;
            ctx.beginPath();
            ctx.moveTo(drop.x, drop.y);
            ctx.lineTo(drop.x + drop.speedX * 4, drop.y + drop.length);
            ctx.stroke();
        });

        fadingDrops.forEach(fDrop => {
            ctx.fillStyle = `rgba(130,0,0,${fDrop.fadeOpacity})`;
            ctx.beginPath();
            ctx.ellipse(fDrop.x, fDrop.y, fDrop.radiusX, fDrop.radiusY, 0, 0, Math.PI * 2);
            ctx.fill();
        });

        updateRain();
    }

    function updateRain() {
        for (let drop of fallingDrops) {
            drop.x += drop.speedX;
            drop.y += drop.speedY;

            if (drop.y > height - (dropOffset+35)) {
                if (fadingDrops.length >= MAX_FADING_DROPS) {
                    recycleFadingDrop(fadingDrops.shift());
                }
                const fadingX = Math.min(Math.max(drop.x, 0), width); 
                const fadingY = height - dropOffset; 
                fadingDrops.push(getFadingDrop(fadingX, fadingY));

                drop.x = Math.random() * (width + dropSpawnOffset * 2) - dropSpawnOffset;
                drop.y = -drop.length;
                drop.length = Math.random() * 20 + 25;
                const speed = 8;
                const angle = 0.5 + Math.random() * 0.2;
                drop.speedX = speed * angle;
                drop.speedY = speed;
                drop.opacity = opacityValue;
            }
        }

        for (let i = fadingDrops.length - 1; i >= 0; i--) {
            const f = fadingDrops[i];
            f.fadeOpacity -= fadeLatency;
            f.radiusX *= 0.989;
            f.radiusY *= 0.989;
            if (f.fadeOpacity <= 0) {
                recycleFadingDrop(f);
                fadingDrops.splice(i, 1);
            }
        }
    }

    function animateRain() {
        drawRain();
        requestAnimationFrame(animateRain);
    }

    animateRain();
})();
