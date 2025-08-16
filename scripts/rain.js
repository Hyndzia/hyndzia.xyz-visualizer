

(() => {
	const canvas = document.getElementById('rain-canvas');
	const ctx = canvas.getContext('2d');
	const dropOffset = 8; // how far from the bottom to disappear (px)
	const dropSpawnOffset = 800; //(px)
	const fadeLatency = 0.01
	const opacityValue = 0.75;

	let width, height;
	let fallingDrops = [];
	let fadingDrops = [];

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

	function createFadingDrop(x, y) {
		return {
			x: x,
			y: y,
			radiusX: 4 + Math.random() * 5,
			radiusY: 0.8 + Math.random() * 1,
			fadeOpacity: opacityValue
		};
	}

	// Initialize drops
	for (let i = 0; i < 350; i++) {
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
			const fadingX = Math.min(Math.max(drop.x, 0), width); 
			const fadingY = height - dropOffset; 
			fadingDrops.push(createFadingDrop(fadingX, fadingY));
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
			fadingDrops[i].fadeOpacity -= fadeLatency; //
			fadingDrops[i].radiusX *= 0.989;
			fadingDrops[i].radiusY *= 0.989;
			if (fadingDrops[i].fadeOpacity <= 0) {
				fadingDrops.splice(i, 1);
			}
		}
		if (fadingDrops.length > 100) fadingDrops.splice(0, fadingDrops.length - 100);
	}

	function animateRain() {
		drawRain();
		requestAnimationFrame(animateRain);
	}

	animateRain();
})();
