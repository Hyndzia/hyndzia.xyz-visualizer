const canvas = document.getElementById('rain-canvas');
const ctx = canvas.getContext('2d');

let width, height;
let fallingDrops = [];
let fadingDrops = [];

function resizeCanvas() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
}

window.addEventListener('resize', () => {
    resizeCanvas();
});

resizeCanvas();

function createFallingDrop() {
    return {
        x: Math.random() * width,
        y: Math.random() * height,
        length: Math.random() * 20 + 10,
        speed: Math.random() * 2 + 1,
        opacity: 1,
    };
}

function createFadingDrop(x) {
    return {
        x: x,
        y: height - 5, // lekko nad samym dołem
        radius: 2 + Math.random() * 2,
        fadeOpacity: 1
    };
}

for (let i = 0; i < 300; i++) {
    fallingDrops.push(createFallingDrop());
}

function drawRain() {
    ctx.clearRect(0, 0, width, height);
    ctx.lineWidth = 1;

    fallingDrops.forEach(drop => {
        ctx.strokeStyle = `rgba(163,0,0,${drop.opacity})`;
        ctx.beginPath();
        ctx.moveTo(drop.x, drop.y);
        ctx.lineTo(drop.x, drop.y + drop.length);
        ctx.stroke();
    });

    fadingDrops.forEach(fDrop => {
        ctx.fillStyle = `rgba(163,0,0,${fDrop.fadeOpacity})`;
        ctx.beginPath();
        ctx.arc(fDrop.x, fDrop.y, fDrop.radius, 0, Math.PI * 2);
        ctx.fill();
    });

    updateRain();
}

function updateRain() {
    for (let drop of fallingDrops) {
        drop.y += drop.speed;
        if (drop.y > height) {
            fadingDrops.push(createFadingDrop(drop.x));
            drop.y = -drop.length;
            drop.x = Math.random() * width;
            drop.speed = Math.random() * 2 + 1;
            drop.length = Math.random() * 20 + 10;
            drop.opacity = 1;
        }
    }

    for (let i = fadingDrops.length - 1; i >= 0; i--) {
        fadingDrops[i].fadeOpacity -= 0.01;
        if (fadingDrops[i].fadeOpacity <= 0) {
            fadingDrops.splice(i, 1);
        }
    }
}

function animateRain() {
    drawRain();
    requestAnimationFrame(animateRain);
}

animateRain();

