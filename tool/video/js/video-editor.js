// --- State Management ---
const state = {
    clips: [],
    isPlaying: false,
    isLooping: false,
    currentTime: 0,
    totalDuration: 0,
    isExporting: false,
    animationFrameId: null,
    lastFrameTime: 0
};

// --- DOM Elements ---
const elements = {
    fileInput: document.getElementById('file-input'),
    clipsList: document.getElementById('clips-list'),
    emptyState: document.getElementById('empty-state'),
    clipCount: document.getElementById('clip-count'),
    canvas: document.getElementById('preview-canvas'),
    ctx: document.getElementById('preview-canvas').getContext('2d'),
    videoContainer: document.getElementById('video-source-container'),
    playPauseBtn: document.getElementById('play-pause-btn'),
    loopBtn: document.getElementById('loop-btn'),
    exportBtn: document.getElementById('export-btn'),
    clearAllBtn: document.getElementById('clear-all-btn'),
    currentTimeDisplay: document.getElementById('current-time'),
    totalTimeDisplay: document.getElementById('total-time'),
    progressBar: document.getElementById('progress-bar'),
    loadingOverlay: document.getElementById('loading-overlay')
};

// --- Audio Context ---
let audioCtx, audioDest;

function initAudio() {
    if (!audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContext();
        audioDest = audioCtx.createMediaStreamDestination();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

const formatTime = (seconds) => {
    if (isNaN(seconds)) return "00:00.0";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms}`;
};

function updateTotalDuration() {
    state.totalDuration = state.clips.reduce((acc, clip) => acc + (clip.end - clip.start), 0);
    elements.totalTimeDisplay.textContent = formatTime(state.totalDuration);
    elements.exportBtn.disabled = state.clips.length === 0;
    elements.clipCount.textContent = state.clips.length;
    elements.emptyState.style.display = state.clips.length === 0 ? 'block' : 'none';
}

function renderClipsList() {
    const cards = elements.clipsList.querySelectorAll('.clip-card');
    cards.forEach(c => c.remove());

    state.clips.forEach((clip, index) => {
        const card = document.createElement('div');
        card.className = 'clip-card';
        card.innerHTML = `
            <div class="clip-header">
                <span class="clip-index">#${index + 1}</span>
                <span class="clip-name" title="${clip.name}">${clip.name}</span>
                <div class="clip-actions">
                    <button class="clip-action-btn move-up" title="上移">
                        <i class="bi bi-arrow-up"></i>
                    </button>
                    <button class="clip-action-btn move-down" title="下移">
                        <i class="bi bi-arrow-down"></i>
                    </button>
                    <button class="clip-action-btn delete" title="刪除" style="color: #ff5f56;">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </div>
            <div class="clip-input-group">
                <label class="clip-input-label">剪取範圍 (秒)</label>
                <div class="clip-inputs-row">
                    <input type="number" class="clip-input start-input" value="${clip.start.toFixed(1)}" min="0" max="${clip.duration}" step="0.1" placeholder="開始">
                    <input type="number" class="clip-input end-input" value="${clip.end.toFixed(1)}" min="0" max="${clip.duration}" step="0.1" placeholder="結束">
                </div>
            </div>
            <div class="clip-input-group">
                <label class="clip-input-label">換場特效</label>
                <select class="transition-select">
                    <option value="none" ${clip.transition === 'none' ? 'selected' : ''}>無 (直切)</option>
                    <option value="fade_in" ${clip.transition === 'fade_in' ? 'selected' : ''}>淡入</option>
                    <option value="fade_out" ${clip.transition === 'fade_out' ? 'selected' : ''}>淡出</option>
                    <option value="both" ${clip.transition === 'both' ? 'selected' : ''}>淡入 + 淡出</option>
                </select>
            </div>
        `;

        card.querySelector('.start-input').addEventListener('change', (e) => {
            let val = parseFloat(e.target.value);
            if (val < 0) val = 0;
            if (val >= clip.end) val = clip.end - 0.1;
            clip.start = val;
            e.target.value = val.toFixed(1);
            updateTotalDuration();
        });

        card.querySelector('.end-input').addEventListener('change', (e) => {
            let val = parseFloat(e.target.value);
            if (val > clip.duration) val = clip.duration;
            if (val <= clip.start) val = clip.start + 0.1;
            clip.end = val;
            e.target.value = val.toFixed(1);
            updateTotalDuration();
        });

        card.querySelector('.transition-select').addEventListener('change', (e) => {
            clip.transition = e.target.value;
        });

        card.querySelector('.move-up').addEventListener('click', () => moveClip(index, -1));
        card.querySelector('.move-down').addEventListener('click', () => moveClip(index, 1));
        card.querySelector('.delete').addEventListener('click', () => deleteClip(index));

        elements.clipsList.appendChild(card);
    });

    updateTotalDuration();
}

function moveClip(index, direction) {
    if (index + direction < 0 || index + direction >= state.clips.length) return;
    const temp = state.clips[index];
    state.clips[index] = state.clips[index + direction];
    state.clips[index + direction] = temp;
    renderClipsList();
}

function deleteClip(index) {
    const clip = state.clips[index];
    if (clip.videoElement) {
        clip.videoElement.pause();
        clip.videoElement.removeAttribute('src');
        clip.videoElement.load();
        clip.videoElement.remove();
    }
    state.clips.splice(index, 1);
    renderClipsList();
}

elements.clearAllBtn.addEventListener('click', () => {
    if (state.clips.length === 0) return;
    if (!confirm('確定要清空所有片段嗎？')) return;

    state.clips.forEach(c => {
        if (c.videoElement) {
            c.videoElement.pause();
            c.videoElement.removeAttribute('src');
            c.videoElement.load();
            c.videoElement.remove();
        }
    });
    state.clips = [];
    stopPlayback();
    state.currentTime = 0;
    state.totalDuration = 0;
    elements.currentTimeDisplay.textContent = "00:00.0";
    elements.totalTimeDisplay.textContent = "00:00.0";
    elements.progressBar.style.width = "0%";
    elements.ctx.clearRect(0, 0, elements.canvas.width, elements.canvas.height);
    renderClipsList();
});

elements.fileInput.addEventListener('change', (e) => {
    initAudio();
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    showLoading('載入影片...');

    let loadedCount = 0;
    files.forEach(file => {
        const url = URL.createObjectURL(file);
        const video = document.createElement('video');
        video.src = url;
        video.crossOrigin = "anonymous";
        video.preload = "auto";
        video.muted = false;
        elements.videoContainer.appendChild(video);

        video.onloadedmetadata = () => {
            const clip = {
                id: crypto.randomUUID(),
                url: url,
                name: file.name,
                duration: video.duration,
                start: 0,
                end: video.duration,
                transition: 'none',
                videoElement: video,
                audioSource: null
            };

            try {
                const source = audioCtx.createMediaElementSource(video);
                source.connect(audioDest);
                source.connect(audioCtx.destination);
                clip.audioSource = source;
            } catch (err) {
                // Ignore
            }

            state.clips.push(clip);

            loadedCount++;
            if (loadedCount === files.length) {
                hideLoading();
                renderClipsList();
            }
        };

        video.onerror = () => {
            console.error("Video load error", file.name);
            loadedCount++;
            if (loadedCount === files.length) hideLoading();
        };
    });
    elements.fileInput.value = '';
});

function drawFrame() {
    const { ctx, canvas } = elements;

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let timeCursor = 0;
    let activeClipDrawn = false;

    for (let clip of state.clips) {
        const clipDuration = clip.end - clip.start;
        const videoEl = clip.videoElement;

        if (state.currentTime >= timeCursor && state.currentTime < timeCursor + clipDuration) {
            activeClipDrawn = true;

            if (videoEl.readyState >= 2) {
                const relativeTime = state.currentTime - timeCursor + clip.start;
                const diff = Math.abs(videoEl.currentTime - relativeTime);

                if (diff > 0.3) {
                    videoEl.currentTime = relativeTime;
                }

                if (state.isPlaying && videoEl.paused) {
                    const playPromise = videoEl.play();
                    if (playPromise) playPromise.catch(() => { });
                } else if (!state.isPlaying && !videoEl.paused) {
                    videoEl.pause();
                }

                const scale = Math.min(canvas.width / videoEl.videoWidth, canvas.height / videoEl.videoHeight);
                const w = videoEl.videoWidth * scale;
                const h = videoEl.videoHeight * scale;
                const x = (canvas.width - w) / 2;
                const y = (canvas.height - h) / 2;

                ctx.save();

                let alpha = 1.0;
                const fadeDuration = 1.0;
                const timeInClip = state.currentTime - timeCursor;
                const timeUntilEnd = (timeCursor + clipDuration) - state.currentTime;

                if ((clip.transition === 'fade_in' || clip.transition === 'both') && timeInClip < fadeDuration) {
                    alpha = timeInClip / fadeDuration;
                }
                if ((clip.transition === 'fade_out' || clip.transition === 'both') && timeUntilEnd < fadeDuration) {
                    alpha = timeUntilEnd / fadeDuration;
                }

                ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
                ctx.drawImage(videoEl, x, y, w, h);
                ctx.restore();
            }
        } else {
            if (!videoEl.paused) videoEl.pause();
        }

        timeCursor += clipDuration;
    }

    if (!activeClipDrawn && state.clips.length > 0) {
        state.clips.forEach(c => !c.videoElement.paused && c.videoElement.pause());
    }

    elements.currentTimeDisplay.textContent = formatTime(state.currentTime);
    const progressPercent = state.totalDuration > 0 ? (state.currentTime / state.totalDuration) * 100 : 0;
    elements.progressBar.style.width = `${progressPercent}%`;

    if (state.isPlaying) {
        if (state.currentTime >= state.totalDuration) {
            if (state.isExporting) {
                setTimeout(stopExport, 100);
            } else if (state.isLooping) {
                state.currentTime = 0;
                state.animationFrameId = requestAnimationFrame(drawFrame);
            } else {
                stopPlayback();
            }
        } else {
            const now = performance.now();
            const dt = (now - state.lastFrameTime) / 1000;
            state.lastFrameTime = now;
            state.currentTime += Math.min(dt, 0.1);
            state.animationFrameId = requestAnimationFrame(drawFrame);
        }
    }
}

function startPlayback() {
    if (state.clips.length === 0) return;
    initAudio();
    state.isPlaying = true;
    state.lastFrameTime = performance.now();

    elements.playPauseBtn.innerHTML = `<i class="bi bi-pause-fill"></i>`;

    if (state.currentTime >= state.totalDuration) {
        state.currentTime = 0;
    }

    drawFrame();
}

function stopPlayback() {
    state.isPlaying = false;
    cancelAnimationFrame(state.animationFrameId);
    state.clips.forEach(c => c.videoElement.pause());
    elements.playPauseBtn.innerHTML = `<i class="bi bi-play-fill"></i>`;
}

elements.playPauseBtn.addEventListener('click', () => {
    if (state.isPlaying) stopPlayback();
    else startPlayback();
});

elements.loopBtn.addEventListener('click', () => {
    state.isLooping = !state.isLooping;
    elements.loopBtn.classList.toggle('active', state.isLooping);
});

let mediaRecorder, recordedChunks = [];

function startExport() {
    if (state.isExporting || state.clips.length === 0) return;

    initAudio();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    state.isExporting = true;
    state.currentTime = 0;

    elements.exportBtn.innerHTML = `<span>處理中...</span>`;
    elements.exportBtn.classList.add('btn-danger');
    elements.exportBtn.classList.remove('btn-success');

    const stream = elements.canvas.captureStream(30);

    if (audioDest) {
        const audioTracks = audioDest.stream.getAudioTracks();
        if (audioTracks.length > 0) stream.addTrack(audioTracks[0]);
    }

    recordedChunks = [];
    let options = { mimeType: 'video/webm; codecs=vp9' };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: 'video/webm; codecs=vp8' };
    }

    try {
        mediaRecorder = new MediaRecorder(stream, options);
    } catch (e) {
        showToast("瀏覽器不支援此錄製格式");
        stopExport();
        return;
    }

    mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunks.push(e.data);
    };

    mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        if (blob.size === 0) {
            showToast("匯出失敗");
        } else {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `video_${Date.now()}.webm`;
            a.click();
            showToast("匯出完成！");
        }

        state.isExporting = false;
        elements.exportBtn.innerHTML = `<i class="bi bi-download"></i><span>匯出</span>`;
        elements.exportBtn.classList.remove('btn-danger');
        elements.exportBtn.classList.add('btn-success');
    };

    mediaRecorder.start();
    startPlayback();
}

function stopExport() {
    stopPlayback();
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
    } else {
        state.isExporting = false;
        elements.exportBtn.innerHTML = `<i class="bi bi-download"></i><span>匯出</span>`;
        elements.exportBtn.classList.remove('btn-danger');
        elements.exportBtn.classList.add('btn-success');
    }
    state.currentTime = 0;
    setTimeout(() => drawFrame(), 200);
}

document.getElementById('progress-bar-container').addEventListener('click', (e) => {
    if (state.totalDuration === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = Math.max(0, Math.min(1, x / rect.width));
    state.currentTime = percent * state.totalDuration;
    if (!state.isPlaying) requestAnimationFrame(drawFrame);
});

function showLoading(text) {
    document.getElementById('loading-text').textContent = text;
    elements.loadingOverlay.classList.add('active');
}

function hideLoading() {
    elements.loadingOverlay.classList.remove('active');
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}
