window.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
window.analyser = window.audioCtx.createAnalyser();
window.analyser.smoothingTimeConstant = 0.8;
window.source = null;

// ===================================================================
//  EFFECTS ENGINE
//  Signal path:
//  source -> [bassBoost -> bitcrusher -> ringMod -> phaser -> delay -> phaseVocoder]
//         -> limiter -> analyser -> gain -> destination
// ===================================================================
(function buildEffectsEngine(ctx) {
    const FADE = 0.015; // time constant (s) of the on/off crossfade

 
    function phaseVocoderWorkletBody() {
   
        const FRAME = 2048;                 // FFT size
        const OVERSAMPLE = 4;               // overlap factor
        const STEP = FRAME / OVERSAMPLE;    // hop size
        const LATENCY = FRAME - STEP;
        const HALF = FRAME / 2;
        const TWO_PI = 2 * Math.PI;
        const GAIN_COMP = 1.5;              // sum of squared Hann windows at 4x overlap

        const levels = Math.round(Math.log2(FRAME));
        const cosT = new Float64Array(HALF);
        const sinT = new Float64Array(HALF);
        for (let i = 0; i < HALF; i++) {
            cosT[i] = Math.cos(TWO_PI * i / FRAME);
            sinT[i] = Math.sin(TWO_PI * i / FRAME);
        }
        const rev = new Uint32Array(FRAME);
        for (let i = 0; i < FRAME; i++) rev[i] = (rev[i >> 1] >> 1) | ((i & 1) << (levels - 1));

        function fft(re, im, inverse) {
            for (let i = 0; i < FRAME; i++) {
                const j = rev[i];
                if (j > i) {
                    let t = re[i]; re[i] = re[j]; re[j] = t;
                    t = im[i]; im[i] = im[j]; im[j] = t;
                }
            }
            for (let size = 2; size <= FRAME; size <<= 1) {
                const half = size >> 1;
                const stride = FRAME / size;
                for (let i = 0; i < FRAME; i += size) {
                    for (let j = i, k = 0; j < i + half; j++, k += stride) {
                        const wr = cosT[k];
                        const wi = inverse ? sinT[k] : -sinT[k];
                        const l = j + half;
                        const tr = re[l] * wr - im[l] * wi;
                        const ti = re[l] * wi + im[l] * wr;
                        re[l] = re[j] - tr; im[l] = im[j] - ti;
                        re[j] += tr;        im[j] += ti;
                    }
                }
            }
        }

        const win = new Float64Array(FRAME); // Hann window
        for (let k = 0; k < FRAME; k++) win[k] = -0.5 * Math.cos(TWO_PI * k / FRAME) + 0.5;

        // One independent shifter per audio channel
        class Shifter {
            constructor() {
                this.inFIFO = new Float64Array(FRAME);
                this.outFIFO = new Float64Array(FRAME);
                this.outAccum = new Float64Array(2 * FRAME);
                this.re = new Float64Array(FRAME);
                this.im = new Float64Array(FRAME);
                this.lastPhase = new Float64Array(HALF + 1);
                this.sumPhase = new Float64Array(HALF + 1);
                this.anaMagn = new Float64Array(HALF + 1);
                this.anaFreq = new Float64Array(HALF + 1);
                this.synMagn = new Float64Array(HALF + 1);
                this.synFreq = new Float64Array(HALF + 1);
                this.pos = LATENCY;
            }

            process(x, pitch) {
                this.inFIFO[this.pos] = x;
                const y = this.outFIFO[this.pos - LATENCY];
                this.pos++;
                if (this.pos >= FRAME) {
                    this.pos = LATENCY;
                    this.frame(pitch);
                }
                return y;
            }

            frame(pitch) {
                const re = this.re, im = this.im;
                const freqPerBin = sampleRate / FRAME;
                const expct = TWO_PI * STEP / FRAME;

                for (let k = 0; k < FRAME; k++) { re[k] = this.inFIFO[k] * win[k]; im[k] = 0; }
                fft(re, im, false);

                // analysis: magnitude + true frequency of every bin
                for (let k = 0; k <= HALF; k++) {
                    const real = re[k], imag = im[k];
                    const magn = 2 * Math.sqrt(real * real + imag * imag);
                    const phase = Math.atan2(imag, real);
                    let tmp = phase - this.lastPhase[k];
                    this.lastPhase[k] = phase;
                    tmp -= k * expct;
                    let qpd = Math.trunc(tmp / Math.PI);
                    if (qpd >= 0) qpd += qpd & 1; else qpd -= qpd & 1;
                    tmp -= Math.PI * qpd;
                    tmp = OVERSAMPLE * tmp / TWO_PI;
                    this.anaMagn[k] = magn;
                    this.anaFreq[k] = k * freqPerBin + tmp * freqPerBin;
                }

                // pitch shifting: move every bin to k * pitch
                this.synMagn.fill(0);
                this.synFreq.fill(0);
                for (let k = 0; k <= HALF; k++) {
                    const index = Math.floor(k * pitch);
                    if (index <= HALF) {
                        this.synMagn[index] += this.anaMagn[k];
                        this.synFreq[index] = this.anaFreq[k] * pitch;
                    }
                }

                // synthesis: accumulate phase from the shifted frequencies
                for (let k = 0; k <= HALF; k++) {
                    let tmp = this.synFreq[k];
                    tmp -= k * freqPerBin;
                    tmp /= freqPerBin;
                    tmp = TWO_PI * tmp / OVERSAMPLE;
                    tmp += k * expct;
                    this.sumPhase[k] += tmp;
                    const phase = this.sumPhase[k];
                    re[k] = this.synMagn[k] * Math.cos(phase);
                    im[k] = this.synMagn[k] * Math.sin(phase);
                }
                for (let k = HALF + 1; k < FRAME; k++) { re[k] = 0; im[k] = 0; }
                fft(re, im, true);

                // windowed overlap-add
                for (let k = 0; k < FRAME; k++) this.outAccum[k] += 2 * win[k] * re[k] / (HALF * OVERSAMPLE * GAIN_COMP);
                for (let k = 0; k < STEP; k++) this.outFIFO[k] = this.outAccum[k];
                this.outAccum.copyWithin(0, STEP, STEP + FRAME);
                this.inFIFO.copyWithin(0, STEP, STEP + LATENCY);
            }
        }

        class PhaseVocoderProcessor extends AudioWorkletProcessor {
            static get parameterDescriptors() {
                return [{ name: 'pitch', defaultValue: 1, minValue: 0.25, maxValue: 4, automationRate: 'k-rate' }];
            }

            constructor() {
                super();
                this.shifters = [new Shifter(), new Shifter()];
            }

            process(inputs, outputs, parameters) {
                const input = inputs[0];
                const output = outputs[0];
                const pitch = parameters.pitch[0];
                for (let c = 0; c < output.length; c++) {
                    const out = output[c];
                    const inp = input.length ? (input[c] || input[0]) : null; // keep running on silence
                    const shifter = this.shifters[c] || (this.shifters[c] = new Shifter());
                    for (let i = 0; i < out.length; i++) out[i] = shifter.process(inp ? inp[i] : 0, pitch);
                }
                return true;
            }
        }

        registerProcessor('phase-vocoder', PhaseVocoderProcessor);
    }

    const SPECS = [
        {
            id: 'bassBoost', label: 'Bass boost', dry: 0, wet: 1,
            build(ctx) {
                const shelf = ctx.createBiquadFilter();
                shelf.type = 'lowshelf';
                shelf.frequency.value = 200;
                shelf.gain.value = 9;

                const punch = ctx.createBiquadFilter();
                punch.type = 'peaking';
                punch.frequency.value = 70;
                punch.Q.value = 1;
                punch.gain.value = 4;

                const level = ctx.createGain();
                level.gain.value = 1.3;

                shelf.connect(punch);
                punch.connect(level);
                return { input: shelf, output: level };
            }
        },
        {
            id: 'bitcrusher', label: 'Bitcrusher', dry: 0, wet: 1,
            build(ctx) {
                const BITS = 16;        // amplitude resolution
                const NORM_FREQ = 0.17; // sample-rate reduction (fraction of the sample rate)
                const step = Math.pow(0.5, BITS);

                const node = ctx.createScriptProcessor(4096, 2, 2);
                const out = ctx.createGain();
                let phase = 0;
                const held = [0, 0];

                node.onaudioprocess = (e) => {
                    const inBuf = e.inputBuffer;
                    const outBuf = e.outputBuffer;
                    const chans = Math.min(inBuf.numberOfChannels, outBuf.numberOfChannels);
                    const len = inBuf.length;
                    const ins = [];
                    const outs = [];
                    for (let c = 0; c < chans; c++) {
                        ins.push(inBuf.getChannelData(c));
                        outs.push(outBuf.getChannelData(c));
                    }
                    for (let i = 0; i < len; i++) {
                        phase += NORM_FREQ;
                        const grab = phase >= 1.0;
                        if (grab) phase -= 1.0;
                        for (let c = 0; c < chans; c++) {
                            if (grab) held[c] = step * Math.floor(ins[c][i] / step + 0.5);
                            outs[c][i] = held[c];
                        }
                    }
                };

                let connected = false;
                return {
                    input: node,
                    output: out,
                    setActive(on) {
                        if (on && !connected) { node.connect(out); connected = true; }
                        else if (!on && connected) { node.disconnect(out); connected = false; }
                    }
                };
            }
        },
        {
            // NEW: ring modulator - metallic / robotic timbre, carrier wobbles slowly
            id: 'ringMod', label: 'Ring', dry: 0.35, wet: 0.9,
            build(ctx) {
                const ring = ctx.createGain();
                ring.gain.value = 0; // output = input * carrier

                const carrier = ctx.createOscillator();
                carrier.type = 'sine';
                carrier.frequency.value = 180;

                const lfo = ctx.createOscillator();
                lfo.type = 'sine';
                lfo.frequency.value = 0.25;
                const lfoDepth = ctx.createGain();
                lfoDepth.gain.value = 60; // carrier drifts 180 Hz +/- 60 Hz

                lfo.connect(lfoDepth);
                lfoDepth.connect(carrier.frequency);
                carrier.connect(ring.gain);

                carrier.start();
                lfo.start();
                return { input: ring, output: ring };
            }
        },
        {
            // Phaser: 4 all-pass stages swept by an LFO, mixed with the dry signal (creates moving notches)
            id: 'phaser', label: 'Phaser', dry: 0.7, wet: 0.7,
            build(ctx) {
                const input = ctx.createGain();
                const out = ctx.createGain();

                const lfo = ctx.createOscillator();
                lfo.type = 'sine';
                lfo.frequency.value = 0.4;
                const depth = ctx.createGain();
                depth.gain.value = 1200; // cents -> sweeps +/- 1 octave
                lfo.connect(depth);

                let prev = input;
                [350, 700, 1400, 2800].forEach((freq) => {
                    const ap = ctx.createBiquadFilter();
                    ap.type = 'allpass';
                    ap.frequency.value = freq;
                    ap.Q.value = 0.8;
                    depth.connect(ap.detune);
                    prev.connect(ap);
                    prev = ap;
                });
                prev.connect(out);

                lfo.start();
                return { input: input, output: out };
            }
        },
        {
            // Delay with a darkening low-pass in the feedback loop (tape-like echoes)
            id: 'delay', label: 'Delay', dry: 1, wet: 0.7,
            build(ctx) {
                const delay = ctx.createDelay(2.0);
                delay.delayTime.value = 0.55;

                const tone = ctx.createBiquadFilter();
                tone.type = 'lowpass';
                tone.frequency.value = 3200;

                const feedback = ctx.createGain();
                feedback.gain.value = 0.38;

                delay.connect(tone);
                tone.connect(feedback);
                feedback.connect(delay);
                return { input: delay, output: tone };
            }
        },
        {
            // NEW: phase vocoder - real-time pitch shifter running in an AudioWorklet.
            // The pitch shift (in semitones) is changed with fx.adjust('phaseVocoder', +1 / -1).
            id: 'phaseVocoder', label: 'Pitch', dry: 0, wet: 1,
            supported(ctx) { return typeof AudioWorkletNode === 'function' && !!ctx.audioWorklet; },
            stepper: { min: -12, max: 12, value: 7, unit: 'st' },
            build(ctx) {
                const input = ctx.createGain();
                const output = ctx.createGain(); // also used as make-up gain
                let node = null;
                let active = false;
                let pitch = 1;

                function rewire() {
                    input.disconnect();
                    if (node) node.disconnect();
                    if (!active) return; // idle: the worklet is not in the graph, no CPU used
                    if (node) { input.connect(node); node.connect(output); }
                    else input.connect(output); // passthrough until the worklet has loaded
                }

                const url = URL.createObjectURL(new Blob(
                    ['(' + phaseVocoderWorkletBody.toString() + ')();'],
                    { type: 'application/javascript' }
                ));
                ctx.audioWorklet.addModule(url).then(() => {
                    node = new AudioWorkletNode(ctx, 'phase-vocoder', {
                        numberOfInputs: 1,
                        numberOfOutputs: 1,
                        outputChannelCount: [2],
                        channelCount: 2,
                        channelCountMode: 'explicit',
                        channelInterpretation: 'speakers'
                    });
                    node.parameters.get('pitch').value = pitch;
                    rewire();
                }).catch((err) => {
                    console.error('Phase vocoder worklet failed to load:', err);
                }).then(() => URL.revokeObjectURL(url));

                return {
                    input: input,
                    output: output,
                    setActive(on) { active = !!on; rewire(); },
                    setValue(semitones) {
                        pitch = Math.pow(2, semitones / 12);
                        output.gain.value = pitch > 1 ? 1.5 : 1; // shifting up comes out quieter
                        if (node) node.parameters.get('pitch').setTargetAtTime(pitch, ctx.currentTime, 0.03);
                    }
                };
            }
        }
    ];

    function createSlot(spec) {
        const input = ctx.createGain();
        const output = ctx.createGain();
        const dry = ctx.createGain();
        const wet = ctx.createGain();
        const core = spec.build(ctx);

        const stepper = (spec.stepper && core.setValue) ? spec.stepper : null;
        let value = stepper ? stepper.value : 0;
        if (stepper) core.setValue(value);
        const formatValue = () => (value > 0 ? '+' : '') + value + ' ' + stepper.unit;

        wet.gain.value = 0;
        input.connect(dry);
        dry.connect(output);
        input.connect(core.input);
        core.output.connect(wet);
        wet.connect(output);

        let on = false;
        let offTimer = null;

        function set(next) {
            next = !!next;
            if (next === on) return on;
            on = next;
            clearTimeout(offTimer);
            const t = ctx.currentTime;
            if (on) {
                if (core.setActive) core.setActive(true);
                dry.gain.setTargetAtTime(spec.dry, t, FADE);
                wet.gain.setTargetAtTime(spec.wet, t, FADE);
            } else {
                dry.gain.setTargetAtTime(1, t, FADE);
                wet.gain.setTargetAtTime(0, t, FADE);
                if (core.setActive) {
                    offTimer = setTimeout(() => { if (!on) core.setActive(false); }, 250);
                }
            }
            return on;
        }

        return {
            id: spec.id,
            label: spec.label,
            input: input,
            output: output,
            set: set,
            get on() { return on; },
            hasStepper: !!stepper,
            get valueLabel() { return stepper ? formatValue() : null; },
            adjust(delta) {
                value = Math.max(stepper.min, Math.min(stepper.max, value + delta));
                core.setValue(value);
                return formatValue();
            }
        };
    }

    const head = ctx.createGain();

    // Safety limiter at the end of the chain - stacked effects can get loud
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -1;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.1;

    const slots = {};
    const order = [];
    const listeners = [];

    let prev = head;
    SPECS.forEach((spec) => {
        if (spec.supported && !spec.supported(ctx)) return;
        const slot = createSlot(spec);
        slots[spec.id] = slot;
        order.push(spec.id);
        prev.connect(slot.input);
        prev = slot.output;
    });
    prev.connect(limiter);

    const api = {
        input: head,
        output: limiter,
        order: order,
        has(id) { return !!slots[id]; },
        isOn(id) { return !!(slots[id] && slots[id].on); },
        list() { return order.map((id) => ({ id: id, label: slots[id].label, on: slots[id].on })); },
        set(id, on) {
            const slot = slots[id];
            if (!slot) return false;
            const before = slot.on;
            slot.set(on);
            if (slot.on !== before) listeners.forEach((fn) => fn(id, slot.on));
            return slot.on;
        },
        toggle(id) { return api.set(id, !api.isOn(id)); },
        hasStepper(id) { return !!(slots[id] && slots[id].hasStepper); },
        valueLabel(id) { return slots[id] ? slots[id].valueLabel : null; },
        adjust(id, delta) { return api.hasStepper(id) ? slots[id].adjust(delta) : null; },
        setAll(on) { order.forEach((id) => api.set(id, on)); },
        onChange(fn) { listeners.push(fn); }
    };

    window.fx = api;
    window.dispatchEvent(new Event('fx-ready'));
})(window.audioCtx);
// ===================== END OF EFFECTS ENGINE =====================

const returnBtn = document.querySelector('.back-link');
const canvas = document.getElementById('vis');
const ctx = canvas.getContext('2d');
const barsCheckbox = document.getElementById('bars');
const waveCheckbox = document.getElementById('wave');
const spectrumLineCheckbox = document.getElementById('spectrumline');
const circularWaveCheckbox = document.getElementById('circularWave');

// Waveform / circular waveform line thickness: 2.5 normally, 5 in fullscreen.
const NORMAL_LINE_WIDTH = 2.5;
const FULLSCREEN_LINE_WIDTH = 5.0;

let waveColors = [];
let circularColors = [];
let spectrumLineColors = [];
let spectrumGradients = [];
let barEffects = [];
let barGradients = [];

const intelMacLatency = 30;
const desktopLatency = 20;

let waveIndex = 0;
let circularIndex = 0;
let spectrumLineIndex = 0;
let spectrumIndex = 0;
let gradsIndex = 0;
 
let waveColor = waveColors[waveIndex];
let circularColor = circularColors[circularIndex];
let spectrumLineColor = spectrumLineColors[spectrumLineIndex];
let spectrumGradient = spectrumGradients[spectrumIndex];
let barGradient = barGradients[gradsIndex];

let globalGradient = null;
let recolorFlag = false;

waveColor = (waveColors[0] || "#ff0000");
circularColor = (circularColors[0] || "#00ff00");
spectrumLineColor = (spectrumLineColors[0] || "#0000ff");
spectrumGradient = (spectrumGradients[0] || ["#ff0", "#0ff", "#f0f"]);
barGradient = (barGradients[0] || ["#ff0", "#0ff"]);
window.barColorMode= (barEffects[0] || "brightness");

const ua = navigator.userAgent.toLowerCase();
const isIntelMac = ua.includes("intel mac os x");

if (isIntelMac) {
    window.analyser.fftSize = 2048; 
    var FPS = 30; 
} else {
    window.analyser.fftSize = 4096; 
    var FPS = 120; 
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
	fetch(window.SIGNAL_COLORS_URL || window.appUrl('/static/scripts/signalColors-config.json'))
	.then(res => res.json())
	.then(config => {
    waveColors = config.waveColors;
    circularColors = config.circularColors;
    spectrumLineColors = config.spectrumLineColors;
    spectrumGradients = config.spectrumGradients;
	barEffects = config.barEffects;
	barGradients = config.barGradients;

    waveColor = waveColors[0];
    circularColor = circularColors[0];
    spectrumLineColor = spectrumLineColors[0];
    spectrumGradient = spectrumGradients[0];
	barGradient = barGradients[0];
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
		recolorFlag = true;
        effectIndex = (effectIndex + 1) % barEffects.length;
        window.barColorMode = barEffects[effectIndex];
        updateColorDisplays();
        console.log('New bars effect:', window.barColorMode);
    });
}

updateColorDisplays();

// ===================== CANVAS SIZE + FULLSCREEN =====================
const BASE_CANVAS_HEIGHT = 400;
let pseudoFullscreen = false; // CSS fallback used when the native Fullscreen API is unavailable

function nativeFullscreenElement() {
	return document.fullscreenElement || document.webkitFullscreenElement || null;
}

function isCanvasFullscreen() {
	return nativeFullscreenElement() === canvas || pseudoFullscreen;
}

function currentSignalLineWidth() {
	return isCanvasFullscreen() ? FULLSCREEN_LINE_WIDTH : NORMAL_LINE_WIDTH;
}

// One resize function for both modes: in fullscreen the canvas is rendered at the
// real screen resolution (crisp, no stretched bitmap), otherwise at the normal size.
function resizeCanvas() {
	if (isCanvasFullscreen()) {
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;
	} else {
		canvas.width = Math.min(window.innerWidth * 0.95, 1100);
		canvas.height = BASE_CANVAS_HEIGHT;
	}
}

// Styles for the CSS fallback (used e.g. in WebViews / iOS where requestFullscreen is not available)
(function injectFullscreenStyles() {
	const style = document.createElement('style');
	style.textContent =
		'canvas#vis.vis-fs{position:fixed !important;top:0 !important;left:0 !important;' +
		'width:100vw !important;height:100vh !important;height:100dvh !important;' +
		'max-width:none !important;max-height:none !important;margin:0 !important;' +
		'padding:0 !important;border:0 !important;border-radius:0 !important;' +
		'background:#000;z-index:999999 !important;}' +
		'body.vis-fs-lock{overflow:hidden !important;}';
	document.head.appendChild(style);
})();

async function enterFullscreen() {
	const request = canvas.requestFullscreen || canvas.webkitRequestFullscreen;
	if (request) {
		try {
			const result = request.call(canvas);
			if (result && typeof result.then === 'function') await result;
			else await new Promise(r => setTimeout(r, 400)); // prefixed version returns no promise
			if (nativeFullscreenElement() === canvas) return; // success, fullscreenchange resizes the canvas
		} catch (e) {
			console.warn('Native fullscreen failed, using CSS fallback:', e);
		}
	}
	pseudoFullscreen = true;
	canvas.classList.add('vis-fs');
	document.body.classList.add('vis-fs-lock');
	resizeCanvas();
}

function exitFullscreen() {
	if (nativeFullscreenElement()) {
		const exit = document.exitFullscreen || document.webkitExitFullscreen;
		try {
			const result = exit.call(document);
			if (result && typeof result.catch === 'function') result.catch(() => {});
		} catch (e) {}
	}
	if (pseudoFullscreen) {
		pseudoFullscreen = false;
		canvas.classList.remove('vis-fs');
		document.body.classList.remove('vis-fs-lock');
		resizeCanvas();
	}
}

function toggleFullscreen() {
	if (isCanvasFullscreen()) exitFullscreen();
	else enterFullscreen();
}

canvas.style.cursor = 'pointer';
canvas.addEventListener('click', toggleFullscreen);
document.addEventListener('keydown', (e) => {
	if (e.key === 'Escape' && pseudoFullscreen) exitFullscreen();
});
document.addEventListener('fullscreenchange', resizeCanvas);
document.addEventListener('webkitfullscreenchange', resizeCanvas);
window.addEventListener('resize', resizeCanvas);
resizeCanvas();
// ===================== END OF CANVAS SIZE + FULLSCREEN =====================

function connectAudio() {
	if (!window.source) {
		try {
			window.source = window.audioCtx.createMediaElementSource(window.audio);
			window.gainNode = window.audioCtx.createGain();
			window.gainNode.gain.value = 0.195;
			// source -> effects chain -> analyser -> volume -> speakers
			window.source.connect(window.fx.input);
			window.fx.output.connect(window.analyser);
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

    if (globalGradient && !recolorFlag) {
        return globalGradient;
    }

    const grad = ctx.createLinearGradient(x, h, x, h - barHeight);
    grad.addColorStop(0, barGradient[0]);
    grad.addColorStop(1, barGradient[1]);

    globalGradient = grad;
	recolorFlag = false;
	gradsIndex = (gradsIndex + 1) % barGradients.length;
	barGradient = barGradients[gradsIndex];

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
	ctx.save();
    const grad = ctx.createLinearGradient(x, h, x, h - barHeight);
    grad.addColorStop(0, 'rgba(0,255,255,0.9)');
    grad.addColorStop(1, 'rgba(0,255,255,0.3)');
    ctx.shadowColor = 'rgba(0,255,255,0.5)';
    ctx.shadowBlur = 15;
	ctx.restore();
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
	const lineWidth = currentSignalLineWidth();
	
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
	  ctx.lineWidth = lineWidth;
	  ctx.lineJoin = 'round';
	  ctx.lineCap = 'round';
	   
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
		const sizeK = h / BASE_CANVAS_HEIGHT; // keeps the circle proportional in fullscreen
		
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
			const r = (baseRadius + v * 50) * dynamicScale * sizeK;
			//const r = (baseRadius + v * 50) * scale;
			const x = centerX + Math.cos(angle) * r;
			const y = centerY + Math.sin(angle) * r;
			if (i === 0) ctx.moveTo(x, y);
			else ctx.lineTo(x, y);
		}
		ctx.lineWidth = lineWidth;
		ctx.lineJoin = 'round';
		ctx.lineCap = 'round';
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