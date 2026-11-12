'use strict';

const state = {
    clips: [],
    isPlaying: false,
    isLooping: false,
    isExporting: false,
    isImporting: false,
    currentTime: 0,
    totalDuration: 0,
    animationFrameId: null,
    playbackSession: 0,
    previewSession: 0,
    exportSession: 0,
    activeClip: null,
    advancing: false
};

const elements = {
    fileInput: document.getElementById('file-input'),
    importBtn: document.getElementById('import-btn'),
    clipsList: document.getElementById('clips-list'),
    emptyState: document.getElementById('empty-state'),
    clipCount: document.getElementById('clip-count'),
    canvas: document.getElementById('preview-canvas'),
    ctx: document.getElementById('preview-canvas').getContext('2d'),
    videoContainer: document.getElementById('video-source-container'),
    playPauseBtn: document.getElementById('play-pause-btn'),
    loopBtn: document.getElementById('loop-btn'),
    exportBtn: document.getElementById('export-btn'),
    cancelExportBtn: document.getElementById('cancel-export-btn'),
    clearAllBtn: document.getElementById('clear-all-btn'),
    currentTimeDisplay: document.getElementById('current-time'),
    totalTimeDisplay: document.getElementById('total-time'),
    progress: document.getElementById('timeline-seek'),
    progressBar: document.getElementById('progress-bar'),
    status: document.getElementById('editor-status'),
    loadingOverlay: document.getElementById('loading-overlay')
};

let audioCtx;
let audioDest;
let mediaRecorder;
let recordingStream;
let recordedChunks = [];
let exportSucceeded = false;
let toastTimer;
let mediaStallTimer;

const formatTime = (seconds) => {
    if (!Number.isFinite(seconds) || seconds < 0) return '00:00.0';
    const tenths = Math.floor(seconds * 10 + 0.00001);
    return `${String(Math.floor(tenths / 600)).padStart(2, '0')}:${String(Math.floor(tenths / 10) % 60).padStart(2, '0')}.${tenths % 10}`;
};

function editorBusy() {
    return state.isExporting || state.isImporting;
}

function updateControls() {
    const empty = state.clips.length === 0;
    const busy = editorBusy();
    elements.importBtn.disabled = busy;
    elements.fileInput.disabled = busy;
    elements.exportBtn.disabled = empty || busy;
    elements.clearAllBtn.disabled = empty || busy;
    elements.playPauseBtn.disabled = empty || busy;
    elements.loopBtn.disabled = empty || busy;
    elements.progress.disabled = empty || busy;
    elements.cancelExportBtn.hidden = !state.isExporting;
    elements.clipsList.querySelectorAll('input, select, button').forEach(control => {
        control.disabled = busy || control.dataset.boundary === 'true';
    });
}

function updateTotalDuration() {
    state.totalDuration = state.clips.reduce((sum, clip) => sum + clip.end - clip.start, 0);
    state.currentTime = Math.max(0, Math.min(state.currentTime, state.totalDuration));
    elements.totalTimeDisplay.textContent = formatTime(state.totalDuration);
    elements.clipCount.textContent = state.clips.length;
    elements.emptyState.style.display = state.clips.length ? 'none' : 'block';
    elements.progress.max = String(state.totalDuration);
    updateControls();
}

function updateTimeline() {
    elements.currentTimeDisplay.textContent = formatTime(state.currentTime);
    elements.progress.value = String(state.currentTime);
    elements.progress.setAttribute('aria-valuetext', `${formatTime(state.currentTime)} / ${formatTime(state.totalDuration)}`);
    const percent = state.totalDuration ? state.currentTime / state.totalDuration * 100 : 0;
    elements.progressBar.style.width = `${percent}%`;
    if (state.isExporting) elements.status.textContent = `正在匯出 ${Math.floor(percent)}% · 請保持此分頁在前景`;
}

function trimValue(value) {
    if (typeof value !== 'string' || value.trim() === '') return NaN;
    return Number(value);
}

function normalizeTrimRange(clip, startValue, endValue) {
    const minimum = Math.min(0.1, clip.duration);
    const proposedStart = trimValue(startValue);
    const proposedEnd = trimValue(endValue);
    clip.start = Math.max(0, Math.min(Number.isFinite(proposedStart) ? proposedStart : clip.start, clip.duration - minimum));
    clip.end = Math.min(clip.duration, Math.max(clip.start + minimum, Number.isFinite(proposedEnd) ? proposedEnd : clip.end));
}

function commitTrimInputs() {
    // A browser/autofill may update a visible input without a change event.
    // Commit both fields together so the export always matches visible values.
    elements.clipsList.querySelectorAll('.clip-card').forEach((card, index) => {
        const clip = state.clips[index];
        if (!clip) return;
        const start = card.querySelector('.start-input');
        const end = card.querySelector('.end-input');
        normalizeTrimRange(clip, start.value, end.value);
        start.value = String(clip.start);
        end.value = String(clip.end);
    });
    updateTotalDuration();
}

function renderClipsList() {
    elements.clipsList.querySelectorAll('.clip-card').forEach(card => card.remove());
    state.clips.forEach((clip, index) => {
        const card = document.createElement('div');
        card.className = 'clip-card';
        // Only numeric/generated values enter this template; names are assigned as text below.
        card.innerHTML = `
            <div class="clip-header">
                <span class="clip-index">${String(index + 1).padStart(2, '0')}</span>
                <span class="clip-name"></span>
                <div class="clip-actions">
                    <button type="button" class="clip-action-btn move-up" title="上移" aria-label="上移片段 ${index + 1}">↑</button>
                    <button type="button" class="clip-action-btn move-down" title="下移" aria-label="下移片段 ${index + 1}">↓</button>
                    <button type="button" class="clip-action-btn delete" title="刪除" aria-label="刪除片段 ${index + 1}">×</button>
                </div>
            </div>
            <div class="clip-inputs-row">
                <label class="clip-input-group">開始（秒）<input type="number" class="clip-input start-input" value="${clip.start}" min="0" max="${clip.duration}" step="any"></label>
                <label class="clip-input-group">結束（秒）<input type="number" class="clip-input end-input" value="${clip.end}" min="0" max="${clip.duration}" step="any"></label>
            </div>
            <label class="clip-input-group">畫面與聲音淡化
                <select class="transition-select">
                    <option value="none" ${clip.transition === 'none' ? 'selected' : ''}>無（直切）</option>
                    <option value="fade_in" ${clip.transition === 'fade_in' ? 'selected' : ''}>淡入</option>
                    <option value="fade_out" ${clip.transition === 'fade_out' ? 'selected' : ''}>淡出</option>
                    <option value="both" ${clip.transition === 'both' ? 'selected' : ''}>淡入 + 淡出</option>
                </select>
            </label>`;
        const nameLabel = card.querySelector('.clip-name');
        nameLabel.textContent = clip.name;
        nameLabel.title = clip.name;
        card.querySelector('.move-up').dataset.boundary = String(index === 0);
        card.querySelector('.move-down').dataset.boundary = String(index === state.clips.length - 1);
        const startInput = card.querySelector('.start-input');
        const endInput = card.querySelector('.end-input');
        startInput.value = String(clip.start);
        endInput.value = String(clip.end);
        startInput.addEventListener('input', event => {
            if (editorBusy()) return;
            const value = trimValue(event.target.value);
            const minimum = Math.min(0.1, clip.duration);
            if (!Number.isFinite(value) || value < 0 || value > clip.end - minimum) return;
            clip.start = value;
            timelineChanged();
        });
        endInput.addEventListener('input', event => {
            if (editorBusy()) return;
            const value = trimValue(event.target.value);
            const minimum = Math.min(0.1, clip.duration);
            if (!Number.isFinite(value) || value > clip.duration || value < clip.start + minimum) return;
            clip.end = value;
            timelineChanged();
        });
        startInput.addEventListener('change', event => {
            if (editorBusy()) return;
            const value = trimValue(event.target.value);
            const minimum = Math.min(.1, clip.duration);
            clip.start = Math.max(0, Math.min(Number.isFinite(value) ? value : clip.start, clip.end - minimum));
            event.target.value = String(clip.start);
            timelineChanged();
        });
        endInput.addEventListener('change', event => {
            if (editorBusy()) return;
            const value = trimValue(event.target.value);
            const minimum = Math.min(.1, clip.duration);
            clip.end = Math.min(clip.duration, Math.max(Number.isFinite(value) ? value : clip.end, clip.start + minimum));
            event.target.value = String(clip.end);
            timelineChanged();
        });
        card.querySelector('.transition-select').addEventListener('change', event => {
            if (editorBusy()) return;
            clip.transition = ['none', 'fade_in', 'fade_out', 'both'].includes(event.target.value) ? event.target.value : 'none';
            timelineChanged();
        });
        card.querySelector('.move-up').addEventListener('click', () => moveClip(index, -1));
        card.querySelector('.move-down').addEventListener('click', () => moveClip(index, 1));
        card.querySelector('.delete').addEventListener('click', () => deleteClip(index));
        elements.clipsList.appendChild(card);
    });
    updateTotalDuration();
}

function timelineChanged() {
    stopPlayback();
    updateTotalDuration();
    if (state.clips.some(clip => clip.videoElement)) void seekPreview(state.currentTime);
}

function moveClip(index, direction) {
    if (editorBusy() || index + direction < 0 || index + direction >= state.clips.length) return;
    stopPlayback();
    [state.clips[index], state.clips[index + direction]] = [state.clips[index + direction], state.clips[index]];
    renderClipsList();
    void seekPreview(0);
}

function releaseClip(clip) {
    clip.audioSource?.disconnect();
    clip.audioGain?.disconnect();
    if (clip.videoElement) {
        clip.videoElement.pause();
        clip.videoElement.removeAttribute('src');
        clip.videoElement.load();
        clip.videoElement.remove();
    }
    URL.revokeObjectURL(clip.url);
}

function deleteClip(index) {
    if (editorBusy() || !state.clips[index]) return;
    stopPlayback();
    releaseClip(state.clips[index]);
    state.clips.splice(index, 1);
    renderClipsList();
    void seekPreview(Math.min(state.currentTime, state.totalDuration));
}

elements.clearAllBtn.addEventListener('click', () => {
    if (editorBusy() || !state.clips.length || !confirm('確定要清空所有片段嗎？')) return;
    stopPlayback();
    state.previewSession++;
    state.clips.forEach(releaseClip);
    state.clips = [];
    state.currentTime = 0;
    renderClipsList();
    drawCanvas(null);
    updateTimeline();
    elements.status.textContent = '尚未匯入影片';
});

function importFiles(files) {
    if (editorBusy() || !files.length) return;
    stopPlayback();
    state.isImporting = true;
    updateControls();
    showLoading('載入影片…');
    const imported = new Array(files.length);
    const failed = new Array(files.length);
    let remaining = files.length;
    const finish = () => {
        if (--remaining) return;
        // Metadata events can complete out of order. Keep the user's file order.
        state.clips.push(...imported.filter(Boolean));
        state.isImporting = false;
        hideLoading();
        elements.fileInput.value = '';
        renderClipsList();
        if (state.clips.length) void seekPreview(state.currentTime);
        const errors = failed.filter(Boolean);
        elements.status.textContent = errors.length ? `未載入：${errors.join('、')}` : `已載入 ${state.clips.length} 個片段`;
        if (errors.length) showToast(`無法載入：${errors.join('、')}。請確認影片格式與長度資訊。`);
    };
    files.forEach((file, index) => {
        const url = URL.createObjectURL(file);
        const video = document.createElement('video');
        video.preload = 'auto';
        video.playsInline = true;
        let settled = false;
        let timeout;
        const settle = success => {
            if (settled) return;
            settled = true;
            if (typeof clearTimeout === 'function') clearTimeout(timeout);
            video.onloadedmetadata = null;
            video.onerror = null;
            if (success) {
                imported[index] = {
                    id: crypto.randomUUID(), url, name: file.name,
                    duration: video.duration, start: 0, end: video.duration,
                    transition: 'none', videoElement: video, audioSource: null, audioGain: null
                };
                video.addEventListener('error', () => {
                    if (state.activeClip?.videoElement === video) playbackFailed(new Error('影片解碼失敗'));
                });
                video.addEventListener('waiting', () => {
                    if (!state.isPlaying || state.activeClip?.videoElement !== video) return;
                    clearTimeout(mediaStallTimer);
                    mediaStallTimer = setTimeout(() => {
                        if (state.activeClip?.videoElement === video) playbackFailed(new Error('影片解碼等待逾時，請重新匯入或轉換格式'));
                    }, 12000);
                    if (state.isExporting && mediaRecorder?.state === 'recording') mediaRecorder.pause();
                });
                video.addEventListener('playing', () => {
                    if (state.activeClip?.videoElement !== video) return;
                    clearTimeout(mediaStallTimer);
                    if (state.isExporting && mediaRecorder?.state === 'paused') mediaRecorder.resume();
                });
            } else {
                failed[index] = file.name;
                video.removeAttribute('src');
                video.load();
                video.remove();
                URL.revokeObjectURL(url);
            }
            finish();
        };
        video.onloadedmetadata = () => settle(Number.isFinite(video.duration) && video.duration > 0);
        video.onerror = () => settle(false);
        timeout = setTimeout(() => settle(false), 20000);
        elements.videoContainer.appendChild(video);
        video.src = url;
    });
}

elements.fileInput.addEventListener('change', event => importFiles(Array.from(event.target.files || [])));
elements.importBtn.addEventListener('click', () => elements.fileInput.click());

async function initAudio() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) throw new Error('此瀏覽器不支援 Web Audio，無法保證匯出音訊');
    if (!audioCtx) {
        audioCtx = new AudioContext();
        audioDest = audioCtx.createMediaStreamDestination();
    }
    if (audioCtx.state === 'suspended') await audioCtx.resume();
    if (audioCtx.state !== 'running') throw new Error('音訊尚未啟用，請再次按播放或匯出');
    for (const clip of state.clips) {
        if (clip.audioError) throw new Error(`${clip.name} 的音訊無法連接，請刪除並重新匯入`);
        if (!clip.audioSource) {
            try {
                clip.audioGain = audioCtx.createGain();
                clip.audioSource = audioCtx.createMediaElementSource(clip.videoElement);
                clip.audioSource.connect(clip.audioGain);
                clip.audioGain.connect(audioDest);
                clip.audioGain.connect(audioCtx.destination);
            } catch (error) {
                clip.audioError = true;
                clip.audioSource?.disconnect();
                clip.audioGain?.disconnect();
                throw new Error(`${clip.name} 的音訊無法連接：${error.message}`);
            }
        }
    }
}

function clipAt(time) {
    let offset = 0;
    for (let index = 0; index < state.clips.length; index++) {
        const clip = state.clips[index];
        const length = clip.end - clip.start;
        if (time < offset + length || index === state.clips.length - 1) {
            return { clip, index, offset, localTime: Math.min(clip.end, clip.start + Math.max(0, time - offset)) };
        }
        offset += length;
    }
    return null;
}

function fadeAlpha(clip, localTime) {
    const duration = clip.end - clip.start;
    const fadeDuration = Math.min(1, duration / 2);
    if (fadeDuration <= 0) return 1;
    let alpha = 1;
    if (clip.transition === 'fade_in' || clip.transition === 'both') alpha = Math.min(alpha, (localTime - clip.start) / fadeDuration);
    if (clip.transition === 'fade_out' || clip.transition === 'both') alpha = Math.min(alpha, (clip.end - localTime) / fadeDuration);
    return Math.max(0, Math.min(1, alpha));
}

function drawCanvas(location) {
    const { ctx, canvas } = elements;
    ctx.fillStyle = '#08090b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!location) return;
    const { clip, localTime } = location;
    const video = clip.videoElement;
    if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return;
    const scale = Math.min(canvas.width / video.videoWidth, canvas.height / video.videoHeight);
    const width = video.videoWidth * scale;
    const height = video.videoHeight * scale;
    const alpha = fadeAlpha(clip, localTime);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(video, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
    ctx.restore();
    if (clip.audioGain) clip.audioGain.gain.value = alpha;
}

function seekMedia(video, target) {
    // Seeking to exactly duration is an end-of-stream position, not a drawable frame.
    const time = Math.max(0, Math.min(target, Math.max(0, video.duration - 0.001)));
    if (Math.abs(video.currentTime - time) < 0.001 && !video.seeking && video.readyState >= 2) return Promise.resolve();
    return new Promise((resolve, reject) => {
        let timeout;
        const cleanup = () => {
            clearTimeout(timeout);
            video.removeEventListener('seeked', ready);
            video.removeEventListener('loadeddata', ready);
            video.removeEventListener('canplay', ready);
            video.removeEventListener('error', failed);
        };
        const ready = () => {
            if (video.seeking || video.readyState < 2) return;
            cleanup();
            resolve();
        };
        const failed = () => { cleanup(); reject(new Error('無法讀取指定的影片時間點')); };
        video.addEventListener('seeked', ready);
        video.addEventListener('loadeddata', ready);
        video.addEventListener('canplay', ready);
        video.addEventListener('error', failed);
        timeout = setTimeout(failed, 12000);
        try { video.currentTime = time; } catch (error) { cleanup(); reject(error); }
    });
}

async function seekPreview(time) {
    const session = ++state.previewSession;
    stopPlayback();
    state.currentTime = Math.max(0, Math.min(Number.isFinite(time) ? time : 0, state.totalDuration));
    updateTimeline();
    const location = clipAt(state.currentTime);
    if (!location) { drawCanvas(null); return; }
    try {
        await seekMedia(location.clip.videoElement, location.localTime);
        if (session === state.previewSession && !state.isPlaying) drawCanvas(location);
    } catch (error) {
        if (session === state.previewSession) showToast(error.message);
    }
}

function setPlaybackButton() {
    elements.playPauseBtn.textContent = state.isPlaying ? 'Ⅱ' : '▶';
    elements.playPauseBtn.setAttribute('aria-label', state.isPlaying ? '暫停播放' : '播放');
    elements.playPauseBtn.title = state.isPlaying ? '暫停播放' : '播放';
}

function stopPlayback() {
    clearTimeout(mediaStallTimer);
    state.isPlaying = false;
    state.playbackSession++;
    state.advancing = false;
    if (state.animationFrameId !== null) cancelAnimationFrame(state.animationFrameId);
    state.animationFrameId = null;
    state.clips.forEach(clip => clip.videoElement?.pause());
    state.activeClip = null;
    setPlaybackButton();
}

async function playLocation(session) {
    const location = clipAt(state.currentTime);
    if (!location || session !== state.playbackSession || !state.isPlaying) return;
    const video = location.clip.videoElement;
    clearTimeout(mediaStallTimer);
    state.activeClip = location.clip;
    state.advancing = true;
    if (state.isExporting && mediaRecorder?.state === 'recording') mediaRecorder.pause();
    try {
        await seekMedia(video, location.localTime);
        if (session !== state.playbackSession || !state.isPlaying) return;
        drawCanvas(location);
        await video.play();
        if (session !== state.playbackSession || !state.isPlaying) { video.pause(); return; }
        if (state.isExporting && mediaRecorder?.state === 'paused') mediaRecorder.resume();
        state.advancing = false;
        drawFrame();
    } catch (error) {
        if (session === state.playbackSession) playbackFailed(error);
    }
}

function drawFrame() {
    state.animationFrameId = null;
    if (!state.isPlaying || state.advancing) return;
    const location = clipAt(state.currentTime);
    if (!location || location.clip !== state.activeClip) return;
    const video = location.clip.videoElement;
    // The media clock is authoritative. A throttled animation callback must not
    // make the timeline drift away from video/audio or skip a trimmed boundary.
    state.currentTime = location.offset + Math.max(0, Math.min(video.currentTime, location.clip.end) - location.clip.start);
    location.localTime = Math.min(video.currentTime, location.clip.end);
    drawCanvas(location);
    updateTimeline();
    if (video.currentTime >= location.clip.end || video.ended) {
        video.pause();
        const nextTime = location.offset + location.clip.end - location.clip.start;
        if (location.index + 1 < state.clips.length) {
            state.currentTime = nextTime;
            void playLocation(state.playbackSession);
        } else if (state.isExporting) {
            state.currentTime = state.totalDuration;
            updateTimeline();
            stopExport(true);
        } else if (state.isLooping) {
            state.currentTime = 0;
            void playLocation(state.playbackSession);
        } else {
            state.currentTime = state.totalDuration;
            stopPlayback();
            updateTimeline();
        }
        return;
    }
    state.animationFrameId = requestAnimationFrame(drawFrame);
}

async function startPlayback() {
    if (editorBusy() || !state.clips.length || state.isPlaying) return;
    stopPlayback();
    state.previewSession++;
    const session = state.playbackSession;
    try { await initAudio(); } catch (error) { showToast(`音訊：${error.message}`); }
    if (session !== state.playbackSession || editorBusy()) return;
    if (state.currentTime >= state.totalDuration) state.currentTime = 0;
    state.isPlaying = true;
    setPlaybackButton();
    await playLocation(session);
}

function playbackFailed(error) {
    if (state.isExporting) stopExport(false, `匯出中止：${error.message || '影片無法播放'}`);
    else { stopPlayback(); showToast(`無法播放：${error.message || '請換用其他格式'}`); }
}

elements.playPauseBtn.addEventListener('click', () => {
    if (editorBusy()) return;
    if (state.isPlaying) stopPlayback();
    else void startPlayback();
});

elements.loopBtn.addEventListener('click', () => {
    if (editorBusy()) return;
    state.isLooping = !state.isLooping;
    elements.loopBtn.classList.toggle('active', state.isLooping);
    elements.loopBtn.setAttribute('aria-pressed', String(state.isLooping));
});

elements.progress.addEventListener('input', event => {
    if (!editorBusy()) void seekPreview(Number(event.target.value));
});

const exportTypes = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4'
];

function supportedExportTypes() {
    if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') return [];
    return exportTypes.filter(type => MediaRecorder.isTypeSupported(type));
}

function releaseRecordingStream() {
    recordingStream?.getTracks().forEach(track => track.stop());
    recordingStream = null;
}

function resetExport() {
    releaseRecordingStream();
    mediaRecorder = null;
    recordedChunks = [];
    state.isExporting = false;
    elements.exportBtn.textContent = '匯出';
    updateControls();
}

async function startExport() {
    if (editorBusy() || !state.clips.length) return;
    const types = supportedExportTypes();
    if (!types.length || typeof elements.canvas.captureStream !== 'function') {
        showToast('此瀏覽器不支援影片匯出。請使用支援 Canvas captureStream 與 MediaRecorder 的瀏覽器。');
        return;
    }
    stopPlayback();
    commitTrimInputs();
    state.previewSession++;
    const session = ++state.exportSession;
    state.isExporting = true;
    exportSucceeded = false;
    state.currentTime = 0;
    updateControls();
    elements.exportBtn.textContent = '準備中…';
    elements.status.textContent = '準備匯出 · 可按取消匯出';
    try {
        await initAudio();
        if (session !== state.exportSession || !state.isExporting) return;
        const first = clipAt(0);
        await seekMedia(first.clip.videoElement, first.localTime);
        if (session !== state.exportSession || !state.isExporting) return;
        drawCanvas(first);
        recordingStream = elements.canvas.captureStream(30);
        // Own a clone: stopping this export must not kill the shared audio bus
        // used by playback and the next export.
        const audioTracks = audioDest.stream.getAudioTracks();
        if (!audioTracks.length) throw new Error('無法建立匯出音訊軌');
        audioTracks.forEach(track => recordingStream.addTrack(track.clone()));
        let lastError;
        for (const mimeType of types) {
            try { mediaRecorder = new MediaRecorder(recordingStream, { mimeType }); break; }
            catch (error) { lastError = error; }
        }
        if (!mediaRecorder) throw lastError || new Error('沒有可用的錄製格式');
        const recorder = mediaRecorder;
        const mimeType = recorder.mimeType || types[0];
        recordedChunks = [];
        recorder.ondataavailable = event => {
            if (mediaRecorder !== recorder) return;
            if (event.data.size > 0) recordedChunks.push(event.data);
        };
        recorder.onerror = event => {
            if (mediaRecorder === recorder) stopExport(false, `匯出失敗：${event.error?.message || '錄製器發生錯誤'}`);
        };
        recorder.onstop = () => {
            if (mediaRecorder !== recorder) return;
            try {
                const blob = new Blob(recordedChunks, { type: mimeType });
                const success = exportSucceeded && blob.size > 0;
                if (success) {
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `video_${Date.now()}.${mimeType.includes('mp4') ? 'mp4' : 'webm'}`;
                    document.body.appendChild(link);
                    try { link.click(); }
                    finally {
                        link.remove();
                        setTimeout(() => URL.revokeObjectURL(url), 30000);
                    }
                    elements.status.textContent = `匯出完成 · ${mimeType.includes('mp4') ? 'MP4' : 'WebM'} · 1280 × 720`;
                    showToast('匯出完成，已交由瀏覽器下載。');
                } else if (exportSucceeded) {
                    elements.status.textContent = '匯出失敗：沒有產生影片資料';
                    showToast(elements.status.textContent);
                } else if (state.isPlaying) {
                    stopPlayback();
                    elements.status.textContent = '錄製非預期停止，未匯出檔案';
                    showToast(elements.status.textContent);
                }
            } catch (error) {
                elements.status.textContent = `無法建立下載檔案：${error.message}`;
                showToast(elements.status.textContent);
            } finally {
                resetExport();
            }
        };
        recorder.start(1000);
        elements.exportBtn.textContent = '匯出中…';
        state.isPlaying = true;
        setPlaybackButton();
        await playLocation(state.playbackSession);
    } catch (error) {
        if (session === state.exportSession) stopExport(false, `無法匯出：${error.message || '瀏覽器錄製功能不可用'}`);
    }
}

function stopExport(completed = false, message = '') {
    if (!state.isExporting) return;
    state.exportSession++;
    exportSucceeded = completed;
    stopPlayback();
    if (!completed) {
        elements.status.textContent = message || '已取消匯出，未產生檔案';
        showToast(elements.status.textContent);
    }
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        try { mediaRecorder.stop(); }
        catch (error) { exportSucceeded = false; resetExport(); showToast(`停止錄製失敗：${error.message}`); }
    } else {
        resetExport();
    }
}

elements.exportBtn.addEventListener('click', () => void startExport());
elements.cancelExportBtn.addEventListener('click', () => stopExport(false));

document.addEventListener('visibilitychange', () => {
    if (!document.hidden) return;
    if (state.isExporting) stopExport(false, '匯出已中止：分頁進入背景。請保持此分頁在前景並重新匯出。');
    else if (state.isPlaying) { stopPlayback(); elements.status.textContent = '已暫停：分頁進入背景'; }
});

function showLoading(text) {
    document.getElementById('loading-text').textContent = text;
    elements.loadingOverlay.classList.add('active');
}

function hideLoading() {
    elements.loadingOverlay.classList.remove('active');
}

function showToast(message) {
    const toast = document.getElementById('toast');
    if (typeof clearTimeout === 'function') clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add('show');
    toastTimer = setTimeout(() => toast.classList.remove('show'), 6000);
}

// A genuine page exit owns the final cleanup. A back/forward-cache page keeps
// its clips, because it can be resumed without running this script again.
window.addEventListener('pagehide', event => {
    if (state.isExporting) stopExport(false);
    else stopPlayback();
    if (event.persisted) return;
    state.clips.forEach(releaseClip);
    releaseRecordingStream();
    audioCtx?.close();
});
