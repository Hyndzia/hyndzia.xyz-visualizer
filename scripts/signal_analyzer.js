window.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
window.analyser = window.audioCtx.createAnalyser();
window.analyser.fftSize = 4096;
window.analyser.smoothingTimeConstant = 0.8;
window.source = null;


const ua = navigator.userAgent.toLowerCase();
const isIntelMac = ua.includes("intel mac os x");


if (isIntelMac) {
    window.analyser.fftSize = 1024; 
    var FPS = 30; 
} else {
    window.analyser.fftSize = 8192; 
    var FPS = 120; 
}

const canvas = document.getElementById('vis');
const ctx = canvas.getContext('2d');
const barsCheckbox = document.getElementById('bars');
const waveCheckbox = document.getElementById('wave');
const circularWaveCheckbox = document.getElementById('circularWave');
const waveColors = ["#A30000", "#ED6807", "#F8FF2E", "#23C91A", "#07EDB3", "#07A8ED", "#A807ED", "#ED0789", "#FFFFFF", "#7D6F7C", "#2B568A", "#005C00"];
const circularColors = ["#A30000", "#ED6807", "#F8FF2E", "#23C91A", "#07EDB3", "#07A8ED", "#A807ED", "#ED0789", "#FFFFFF", "#7D6F7C", "#2B568A", "#005C00"];
const intelMacLatency = 30;
const desktopLatency = 1;


let waveIndex = 0;
let circularIndex = 0;
let waveColor = waveColors[waveIndex];
let circularColor = circularColors[circularIndex];

function updateColorDisplays() {
    document.getElementById("waveColorDisplay").textContent = waveColor;
    document.getElementById("circularColorDisplay").textContent = circularColor;
}

// Change wave color button
document.getElementById("changeWaveColorBtn").addEventListener("click", () => {
    waveIndex = (waveIndex + 1) % waveColors.length;
    waveColor = waveColors[waveIndex];
    updateColorDisplays();
});

// Change circular color button
document.getElementById("changeCircularColorBtn").addEventListener("click", () => {
    circularIndex = (circularIndex + 1) % circularColors.length;
    circularColor = circularColors[circularIndex];
    updateColorDisplays();
});


updateColorDisplays();



function resize(){
canvas.width = Math.min(window.innerWidth * 0.95, 1100);
canvas.height = 420;
}
window.addEventListener('resize', resize);
resize();

function connectAudio() {
if (!window.source) {
	try {
		window.source = window.audioCtx.createMediaElementSource(window.audio);
		window.source.connect(window.analyser);
		window.analyser.connect(window.audioCtx.destination);
	} catch (e) {
		console.error("Error creating MediaElementSource:", e);
	}
}
}
function getBarColorBrightness(value, hue) {
	const brightness = 40 + value * 60;
	return `hsl(${hue} 80% ${brightness}%)`;
}
function getBarColorSaturation(value, hue) {
	const saturation = 40 + value * 60;
	return `hsl(${hue} ${saturation}% 60%)`;
}
function getBarColorGradient(ctx, x, h, barHeight) {
	const grad = ctx.createLinearGradient(x, h, x, h - barHeight);
	grad.addColorStop(0, 'red');
	grad.addColorStop(1, 'yellow');
	return grad;
}
function getBarColorPulse(value, hue) {
	const hueOffset = (Date.now() / 20) % 360;
	return `hsl(${(hue + hueOffset) % 360} 80% 60%)`;
}
function getBarColorByValue(value) {
	if (value < 0.3) return '#00f';
	else if (value < 0.6) return '#0f0';
	else return '#f00';
}

const bufferLength = analyser.frequencyBinCount;
const freqData = new Uint8Array(bufferLength);
const timeData = new Uint8Array(bufferLength);
const previousHeights = new Array(128).fill(0);

const barEffects = ['brightness', 'saturation', 'gradient', 'pulse', 'value'];
window.barColorMode = barEffects[Math.floor(Math.random() * barEffects.length)];
//const barColorMode = barEffects[Math.floor(Math.random() * barEffects.length)];
//console.log('Bars effect: ', barColorMode);

function resizeCanvas() {
	canvas.width = Math.min(window.innerWidth * 0.95, 1100);
	canvas.height = 420;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

if (isIntelMac){
	setInterval(() => {
			analyser.getByteFrequencyData(freqData);
			analyser.getByteTimeDomainData(timeData);
		}, intelMacLatency);
}
if (!isIntelMac){
	setInterval(() => {
			analyser.getByteFrequencyData(freqData);
			analyser.getByteTimeDomainData(timeData);
		}, desktopLatency);
}

function draw() {
	requestAnimationFrame(draw);

	ctx.fillStyle = '#000';
	ctx.fillRect(0, 0, canvas.width, canvas.height);
	
	// if (!isIntelMac){
			// analyser.getByteFrequencyData(freqData);
			// analyser.getByteTimeDomainData(timeData);
		// }
	
	const w = canvas.width;
	const h = canvas.height;


	if (barsCheckbox.checked) {
		const barCount = Math.min(128, bufferLength);
		const barWidth = w / barCount;

		for (let i = 0; i < barCount; i++) {
			const value = freqData[i] / 255;
			const targetHeight = value * h * 0.5;

			// płynna interpolacja
			if (targetHeight > previousHeights[i]) {
				previousHeights[i] += (targetHeight - previousHeights[i]) * 0.2;
			} else {
				previousHeights[i] *= 0.9;
			}

			const x = i * barWidth;
			const y = h - previousHeights[i];
			const hue = i / barCount * 360;
			let color;
			// switch(barColorMode) {
				// case 'brightness': color = getBarColorBrightness(value, hue); break;
				// case 'saturation': color = getBarColorSaturation(value, hue); break;
				// case 'gradient': color = getBarColorGradient(ctx, x, h, previousHeights[i]); break;
				// case 'pulse': color = getBarColorPulse(value, hue); break;
				// case 'value': color = getBarColorByValue(value); break;
				// default: color = `hsl(${hue} 80% 60%)`;
			// }
			switch(window.barColorMode) {
				case 'brightness': color = getBarColorBrightness(value, hue); break;
				case 'saturation': color = getBarColorSaturation(value, hue); break;
				case 'gradient': color = getBarColorGradient(ctx, x, h, previousHeights[i]); break;
				case 'pulse': color = getBarColorPulse(value, hue); break;
				case 'value': color = getBarColorByValue(value); break;
				default: color = `hsl(${hue} 80% 60%)`;
			}

			ctx.fillStyle = color;
			ctx.fillRect(x, y, barWidth - 1, previousHeights[i]);
		}
	}

	if (waveCheckbox.checked) {
	  // waveform
	  ctx.lineWidth = 2; //zwykle
	   
	  ctx.strokeStyle = waveColor;
	  ctx.beginPath();
	  const step = Math.max(1, Math.floor(bufferLength / w));
	  for(let i = 0; i < w; i++) {
		const idx = Math.floor(i * bufferLength / w);
		const v = (timeData[idx] - 128) / 128; // -1..1
		//ctx.lineWidth = 1 + Math.abs(v) * 4; //pulsowanie przez amplitude
		const y = h/2 + v * (h/3);
		if(i === 0) ctx.moveTo(i, y);
		else ctx.lineTo(i, y);
	  }
	  ctx.stroke();
	}

	if (circularWaveCheckbox.checked) {
		const centerX = w / 2;
		const centerY = h / 2;
		const baseRadius = 50;
		
		//const pulse = Math.sin(Date.now()/500);
		let sum = 0;
		for (let i = 0; i < bufferLength; i++) {
			sum += freqData[i];
		}
		const avg = sum / bufferLength;
		//const scale = 1 + pulse * 0.2; scale for pulsing (breathing)
		const scale = 1 + (avg*(2)/255)*1.3;
		ctx.beginPath();
		for (let i = 0; i < w; i++) {
			const idx = Math.floor(i * bufferLength / w);
			const v = (timeData[idx] - 128) / 128;
			const angle = (i / w) * Math.PI * 2;
			//const r = 100 + v * 50;
			const r = (baseRadius + v * 50) * scale;
			const x = centerX + Math.cos(angle) * r;
			const y = centerY + Math.sin(angle) * r;
			if (i === 0) ctx.moveTo(x, y);
			else ctx.lineTo(x, y);
		}
		ctx.strokeStyle = circularColor;
		ctx.stroke();
	}
}

draw();

//export
window.audioAnalyzer = {
    connectAudio,
    resizeCanvas
};
