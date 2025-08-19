window.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
window.analyser = window.audioCtx.createAnalyser();
window.analyser.smoothingTimeConstant = 0.8;
window.source = null;

const returnBtn = document.querySelector('.back-link');
const canvas = document.getElementById('vis');
const ctx = canvas.getContext('2d');
const barsCheckbox = document.getElementById('bars');
const waveCheckbox = document.getElementById('wave');
const spectrumLineCheckbox = document.getElementById('spectrumline');
const circularWaveCheckbox = document.getElementById('circularWave');

let waveColors = [];
let circularColors = [];
let spectrumLineColors = [];
let spectrumGradients = [];
let barEffects = [];

const intelMacLatency = 30;
const desktopLatency = 20;

let waveIndex = 0;
let circularIndex = 0;
let spectrumLineIndex = 0;
let spectrumIndex = 0;
let waveColor = waveColors[waveIndex];
let circularColor = circularColors[circularIndex];
let spectrumLineColor = spectrumLineColors[spectrumLineIndex];
let spectrumGradient = spectrumGradients[spectrumIndex];
waveColor = (waveColors[0] || "#ff0000");
circularColor = (circularColors[0] || "#00ff00");
spectrumLineColor = (spectrumLineColors[0] || "#0000ff");
spectrumGradient = (spectrumGradients[0] || ["#ff0", "#0ff", "#f0f"]);
window.barColorMode= (barEffects[0] || "brightness");

const ua = navigator.userAgent.toLowerCase();
const isIntelMac = ua.includes("intel mac os x");

if (isIntelMac) {
    window.analyser.fftSize = 2048; 
    var FPS = 30; 
} else {
    window.analyser.fftSize = 4096; 
    var FPS = 60; 
}

function updateColorDisplays() {
    document.getElementById("waveColorDisplay").textContent = waveColor;
    document.getElementById("circularColorDisplay").textContent = circularColor;
	//document.getElementById("spectrumLineColorDisplay").textContent = spectrumLineColor;
	document.getElementById('currentEffect').textContent = window.barColorMode;
}
 
// function updateEffectDisplay() {
    // const display = document.getElementById('currentEffect');
    // if (display) display.textContent = window.barColorMode;
// }

// updateEffectDisplay();


function loadColorsConfig(){
	fetch("https://hyndzia.xyz/scripts/signalColors-config.json")
	.then(res => res.json())
	.then(config => {
    waveColors = config.waveColors;
    circularColors = config.circularColors;
    spectrumLineColors = config.spectrumLineColors;
    spectrumGradients = config.spectrumGradients;
	barEffects = config.barEffects;

    waveColor = waveColors[0];
    circularColor = circularColors[0];
    spectrumLineColor = spectrumLineColors[0];
    spectrumGradient = spectrumGradients[0];
	// updateEffectDisplay();
    updateColorDisplays();
  })
  .catch(err => console.error("Error loading config:", err));
}
loadColorsConfig();

// Change wave color button
document.getElementById("changeWaveColorBtn").addEventListener("click", () => {
    waveIndex = (waveIndex + 1) % waveColors.length;
    waveColor = waveColors[waveIndex];
    updateColorDisplays();
});


document.getElementById("changeCircularColorBtn").addEventListener("click", () => {
    circularIndex = (circularIndex + 1) % circularColors.length;
    circularColor = circularColors[circularIndex];
    updateColorDisplays();
});


document.getElementById("changeSpectrumLineColorBtn").addEventListener("click", () => {
    spectrumIndex = (spectrumIndex + 1) % spectrumGradients.length;
    spectrumGradient = spectrumGradients[spectrumIndex];
});

const btn = document.getElementById('changeEffectBtn');
let effectIndex = 0;
if (btn) {
    btn.addEventListener('click', () => {
        effectIndex = (effectIndex + 1) % barEffects.length;
        window.barColorMode = barEffects[effectIndex];
        updateColorDisplays();
        console.log('New bars effect:', window.barColorMode);
    });
}

updateColorDisplays();

function resize(){
canvas.width = Math.min(window.innerWidth * 0.95, 1100);
canvas.height = 620;
}

window.addEventListener('resize', resize);
resize();

function connectAudio() {
	if (!window.source) {
		try {
			window.source = window.audioCtx.createMediaElementSource(window.audio);
			window.gainNode = window.audioCtx.createGain();
			window.gainNode.gain.value = 0.195;
			window.source.connect(window.analyser);
			window.analyser.connect(window.gainNode);
			window.gainNode.connect(window.audioCtx.destination);
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
	grad.addColorStop(0, '#1D940A');
	grad.addColorStop(1, '#05E8E4');
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
function getBarColorNeon(ctx, x, h, barHeight) {
    const grad = ctx.createLinearGradient(x, h, x, h - barHeight);
    grad.addColorStop(0, 'rgba(0,255,255,0.9)');
    grad.addColorStop(1, 'rgba(0,255,255,0.3)');
    ctx.shadowColor = 'rgba(0,255,255,0.5)';
    ctx.shadowBlur = 15;
    return grad;
}
function getBarColorWave(value, hue) {
    const lightness = 50 + 10 * Math.sin(Date.now() / 100 + value * 5);
    return `hsl(${hue} 80% ${lightness}%)`;
}
function getBarColorVerticalWave(ctx, x, h, barHeight, value) {
    const grad = ctx.createLinearGradient(x, h, x, h - barHeight);
    const wave = Math.sin(Date.now()/100 + value*5);
    grad.addColorStop(0, `hsl(${wave*360} 90% 50%)`);
    grad.addColorStop(1, `hsl(${(wave*360+60)%360} 90% 50%)`);
    return grad;
}

const bufferLength = analyser.frequencyBinCount;
const freqData = new Uint8Array(bufferLength);
const timeData = new Uint8Array(bufferLength);
const previousHeights = new Array(128).fill(0);

// const barEffects = ['brightness', 'saturation', 'gradient', 'pulse', 'value', 'neon', 'color wave', 'vertical wave'];
// window.barColorMode = barEffects[Math.floor(Math.random() * barEffects.length)];
//const barColorMode = barEffects[Math.floor(Math.random() * barEffects.length)];
//console.log('Bars effect: ', barColorMode);

function resizeCanvas() {
	canvas.width = Math.min(window.innerWidth * 0.95, 1100);
	canvas.height = 400;
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
		const spacing = 2; //spacing between bars
		const barWidth = (w - spacing * (barCount - 1)) / barCount;

		for (let i = 0; i < barCount; i++) {
			const value = freqData[i] / 255;
			const targetHeight = value * h * 0.5;
			// interpolation
			if (targetHeight > previousHeights[i]) {
				previousHeights[i] += (targetHeight - previousHeights[i]) * 0.2;
			} else {
				previousHeights[i] *= 0.9;
			}

			//const x = i * (barWidth);
			const x = i * (barWidth + spacing);
			const y = h - previousHeights[i];
			const hue = i / barCount * 360;

			let color;
			switch(window.barColorMode) {
				case 'brightness': color = getBarColorBrightness(value, hue); break;
				case 'saturation': color = getBarColorSaturation(value, hue); break;
				case 'gradient': color = getBarColorGradient(ctx, x, h, previousHeights[i]); break;
				case 'pulse': color = getBarColorPulse(value, hue); break;
				case 'value': color = getBarColorByValue(value); break;
				case 'neon' : color = getBarColorNeon(ctx, x, h, previousHeights[i]); break;
				case 'color wave': color = getBarColorWave(value, hue); break;
				case 'vertical wave': color = getBarColorVerticalWave(ctx, x, h, previousHeights[i], value); break;
				default: color = `hsl(${hue} 80% 60%)`;
			}

			ctx.fillStyle = color;
			ctx.fillRect(x, y, barWidth, previousHeights[i]); // bez -1
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
		const scaleWaveFactor = 0.75;
		const v = (timeData[idx] - 128) / 128 * scaleWaveFactor; // -1..1
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
		const scaleCycleFactor = 0.4;
		
		//const pulse = Math.sin(Date.now()/500);
		let sum = 0;
		for (let i = 0; i < bufferLength; i++) {
			sum += freqData[i];
		}
		const avg = sum / bufferLength;
		//const scale = 3 + pulse * 0.8;// scale for pulsing (breathing)
		const scale = (0.1 + (avg*(2)/255)*5);
		ctx.beginPath();
		for (let i = 0; i < w; i++) {
			const idx = Math.floor(i * bufferLength / w);
			
			const v = (timeData[idx] - 128) / 128 * scaleCycleFactor;
			const angle = (i / w) * Math.PI * 2;
			//const r = 100 + v * 50;
			const dynamicScale = (0.1 + (avg * 2 / 255) * 3);
			const r = (baseRadius + v * 50) * dynamicScale;
			//const r = (baseRadius + v * 50) * scale;
			const x = centerX + Math.cos(angle) * r;
			const y = centerY + Math.sin(angle) * r;
			if (i === 0) ctx.moveTo(x, y);
			else ctx.lineTo(x, y);
		}
		ctx.strokeStyle = circularColor;
		ctx.stroke();
	}
		if (spectrumLineCheckbox.checked) {
		const barCount = Math.min(256, bufferLength);
		const step = Math.floor(bufferLength / barCount);
		ctx.beginPath();
for (let i = 0; i < canvas.width; i++) {
    const idx = Math.floor(i * bufferLength / canvas.width);
    const v = (freqData[idx] / 255) * canvas.height * 0.5;
    const y = canvas.height - v;
    if (i === 0) ctx.moveTo(i, y);
    else ctx.lineTo(i, y);
}
	//linear gradient
	const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
	gradient.addColorStop(0, spectrumGradient[0]);
	gradient.addColorStop(0.5, spectrumGradient[1]);
	gradient.addColorStop(1, spectrumGradient[2]);

	ctx.strokeStyle = gradient;
	ctx.lineWidth = 2;
	ctx.stroke();
	
	//fill under the line
	ctx.lineTo(canvas.width, canvas.height);
	ctx.lineTo(0, canvas.height);
	ctx.closePath();
	ctx.fillStyle = gradient;
	ctx.fill();
	 }
}
draw();

//export
window.audioAnalyzer = {
    connectAudio,
    resizeCanvas
};
