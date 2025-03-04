// Elementi DOM
const videoInput = document.getElementById('videoInput');
const videoPlayer = document.getElementById('videoPlayer');
const timeline = document.getElementById('timeline');
const startTriangle = document.getElementById('startTriangle');
const endTriangle = document.getElementById('endTriangle');
const startTimeDisplay = document.getElementById('startTime');
const endTimeDisplay = document.getElementById('endTime');
const saveButton = document.getElementById('saveButton');
const saveOptions = document.getElementById('saveOptions');

// Variabili di stato
let startTime = 0;
let endTime = 0;
let ffmpeg = null;

// Inizializza FFmpeg
async function initFFmpeg() {
    const { createFFmpeg, fetchFile } = FFmpeg;
    ffmpeg = createFFmpeg({ log: true });
    await ffmpeg.load();
    console.log('FFmpeg initialized');
}
initFFmpeg();

// Carica il video
videoInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    videoPlayer.src = URL.createObjectURL(file);
    videoPlayer.onloadedmetadata = function() {
        endTime = videoPlayer.duration;
        updateTimeDisplay();
        positionTriangles();
    };
});

// Formatta il tempo
function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Genera codice random alfanumerico
function generateRandomCode(length = 5) {
    const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

// Posiziona i triangoli
function positionTriangles() {
    const width = timeline.offsetWidth;
    startTriangle.style.left = (startTime / videoPlayer.duration * 100) + '%';
    endTriangle.style.right = ((videoPlayer.duration - endTime) / videoPlayer.duration * 100) + '%';
}

// Aggiorna il display del tempo
function updateTimeDisplay() {
    startTimeDisplay.textContent = formatTime(startTime);
    endTimeDisplay.textContent = formatTime(endTime);
}

// Drag per startTriangle
let isDraggingStart = false;
startTriangle.addEventListener('mousedown', () => isDraggingStart = true);
document.addEventListener('mousemove', (e) => {
    if (isDraggingStart) {
        const rect = timeline.getBoundingClientRect();
        const pos = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        startTime = (pos / rect.width) * videoPlayer.duration;
        if (startTime > endTime) startTime = endTime;
        positionTriangles();
        updateTimeDisplay();
    }
});
document.addEventListener('mouseup', () => isDraggingStart = false);

// Drag per endTriangle
let isDraggingEnd = false;
endTriangle.addEventListener('mousedown', () => isDraggingEnd = true);
document.addEventListener('mousemove', (e) => {
    if (isDraggingEnd) {
        const rect = timeline.getBoundingClientRect();
        const pos = Math.max(0, Math.min(rect.right - e.clientX, rect.width));
        endTime = videoPlayer.duration - (pos / rect.width) * videoPlayer.duration;
        if (endTime < startTime) endTime = startTime;
        positionTriangles();
        updateTimeDisplay();
    }
});
document.addEventListener('mouseup', () => isDraggingEnd = false);

// Mostra opzioni di salvataggio
saveButton.addEventListener('click', () => {
    saveOptions.style.display = 'block';
});

// Salva il video con FFmpeg
saveOptions.querySelectorAll('.option').forEach(option => {
    option.addEventListener('click', async () => {
        const quality = option.getAttribute('data-quality');
        await saveVideo(quality);
    });
});

async function saveVideo(quality) {
    if (!ffmpeg) {
        alert('FFmpeg non è ancora inizializzato. Riprova.');
        return;
    }

    const file = videoInput.files[0];
    const randomCode = generateRandomCode();
    const fileName = file.name.split('.').slice(0, -1).join('.') + '_' + randomCode + '.mp4';
    const start = Math.floor(startTime);
    const duration = Math.floor(endTime - startTime);

    // Scrivi il file di input nel filesystem di FFmpeg
    ffmpeg.FS('writeFile', 'input.mp4', await fetchFile(file));

    // Comandi FFmpeg per il ritaglio e l'ottimizzazione
    let crf = 23; // Controllo qualità (valore più basso = meglio, ma più pesante)
    let resolution = '';
    if (quality === '1080p') resolution = '-vf scale=1920:1080';
    else if (quality === '720p') resolution = '-vf scale=1280:720';
    else resolution = ''; // Originale

    await ffmpeg.run(
        '-i', 'input.mp4',
        '-ss', start.toString(),
        '-t', duration.toString(),
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', crf.toString(),
        resolution,
        'output.mp4'
    );

    // Leggi il file output
    const data = ffmpeg.FS('readFile', 'output.mp4');
    const blob = new Blob([data.buffer], { type: 'video/mp4' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);

    // Pulizia
    ffmpeg.FS('unlink', 'input.mp4');
    ffmpeg.FS('unlink', 'output.mp4');
    saveOptions.style.display = 'none';
}