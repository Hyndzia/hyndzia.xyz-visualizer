 
function updateEffectDisplay() {
    const display = document.getElementById('currentEffect');
    if (display) display.textContent = window.barColorMode;
}

updateEffectDisplay();

const btn = document.getElementById('changeEffectBtn');
if (btn) {
    btn.addEventListener('click', () => {
        // Pick a random new effect
        window.barColorMode = barEffects[Math.floor(Math.random() * barEffects.length)];
        updateEffectDisplay();
        console.log('New bars effect:', window.barColorMode);
        // The next draw() cycle in signal_analyzer.js will use this new mode
    });
}
