'use strict';

const PDFJS_VERSION = '4.10.38';
const PDFJS_BASE = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/`;
let pdfJsPromise;
let allPages = [];
let currentEditId = null;
let currentTool = 'draw';
let isDrawing = false;
let activePointer = null;
let isBusy = false;
let hasAnnotations = false;
let editGeometry = null;
let editorOpener = null;
let textPos = { x: 0, y: 0 };
let textStyle = { size: 24, color: '#000000' };
let toastTimer;

const pagesGrid = document.getElementById('pages-grid');
const editCanvas = document.getElementById('pdf-edit-canvas');
const baseCanvas = document.getElementById('pdf-base-canvas');
const ctx = editCanvas.getContext('2d');
const baseCtx = baseCanvas.getContext('2d');
const editModal = document.getElementById('edit-modal');
const canvasTextInput = document.getElementById('canvas-text-input');
const editColorInput = document.getElementById('edit-color');
const editSizeInput = document.getElementById('edit-size');
const sizeLabel = document.getElementById('size-label');
const fileInput = document.getElementById('file-input');

async function getPdfJS() {
    // Allow an already-loaded PDF.js API; otherwise load the pinned module on demand.
    if (typeof pdfjsLib !== 'undefined') return pdfjsLib;
    if (!pdfJsPromise) {
        pdfJsPromise = import(`${PDFJS_BASE}build/pdf.min.mjs`).then(api => {
            api.GlobalWorkerOptions.workerSrc = `${PDFJS_BASE}build/pdf.worker.min.mjs`;
            return api;
        }).catch(error => { pdfJsPromise = null; throw error; });
    }
    return pdfJsPromise;
}

function pdfOptions(data) {
    return { data: data.slice(0), isEvalSupported: false, cMapUrl: `${PDFJS_BASE}cmaps/`, cMapPacked: true, standardFontDataUrl: `${PDFJS_BASE}standard_fonts/` };
}

async function releaseDocument(task, doc) {
    try {
        if (doc) await doc.destroy();
        else if (task?.destroy) await task.destroy();
    } catch (_) { /* Cleanup must not hide the original import/render error. */ }
}

function describeError(error) {
    if (error?.name === 'PasswordException' || /encrypt|password/i.test(error?.message || '')) return '不支援加密或需密碼的 PDF，請先以原始軟體匯出未加密版本';
    if (/fetch|network|module|PDFLib|defined/i.test(error?.message || '')) return '無法載入 PDF 程式庫，請檢查網路連線後重試';
    return '檔案可能損毀或格式不受支援';
}

function applyPageOrder(ids) {
    if (isBusy || ids.length !== allPages.length || new Set(ids).size !== allPages.length) return false;
    const lookup = new Map(allPages.map(page => [page.id, page]));
    if (ids.some(id => !lookup.has(id))) return false;
    allPages = ids.map(id => lookup.get(id));
    renderGrid();
    return true;
}

if (typeof Sortable !== 'undefined') {
    new Sortable(pagesGrid, {
        animation: 150, draggable: '.page-card', handle: '.drag-handle',
        onEnd: () => applyPageOrder(Array.from(pagesGrid.children).filter(card => card.classList.contains('page-card')).map(card => card.dataset.id))
    });
}

fileInput.onchange = event => handleFiles(event.target.files);
document.getElementById('upload-btn').addEventListener('click', () => fileInput.click());
document.getElementById('download-btn').addEventListener('click', exportPDF);
document.getElementById('tool-draw').addEventListener('click', () => setTool('draw'));
document.getElementById('tool-text').addEventListener('click', () => { setTool('text'); editCanvas.focus(); });
document.getElementById('clear-edits-btn').addEventListener('click', clearCanvas);
document.getElementById('cancel-edit-btn').addEventListener('click', closeEditModal);
document.getElementById('save-edit-btn').addEventListener('click', saveEdit);
editModal.addEventListener('cancel', event => { event.preventDefault(); closeEditModal(); });

function setTool(tool) {
    if (canvasTextInput.style.display === 'block') placeText();
    endDrawing();
    currentTool = tool === 'text' ? 'text' : 'draw';
    ['draw', 'text'].forEach(name => {
        const button = document.getElementById(`tool-${name}`);
        button.classList.toggle('active', name === currentTool);
        button.setAttribute('aria-pressed', String(name === currentTool));
    });
    if (currentTool === 'text' && Number(editSizeInput.value) < 12) editSizeInput.value = '24';
    updateSizeLabel();
}

function updateSizeLabel() {
    sizeLabel.textContent = `${currentTool === 'text' ? '字體' : '粗細'}：${editSizeInput.value}`;
}
editSizeInput.oninput = updateSizeLabel;

async function handleFiles(files) {
    if (isBusy) return;
    const pdfFiles = Array.from(files).filter(file => file.type === 'application/pdf' || /\.pdf$/i.test(file.name));
    if (!pdfFiles.length) { fileInput.value = ''; showToast('請選擇 PDF 檔案。'); return; }
    showLoading('解析 PDF…');
    const failures = [];
    let importedCount = 0;
    try {
        const api = await getPdfJS();
        for (const file of pdfFiles) {
            let task, doc;
            try {
                const fileData = await file.arrayBuffer();
                task = api.getDocument(pdfOptions(fileData));
                doc = await task.promise;
                // Reject encrypted files that PDF.js can preview but pdf-lib cannot copy.
                if (typeof PDFLib === 'undefined') throw new Error('PDFLib is not defined');
                await PDFLib.PDFDocument.load(fileData);
                const importedPages = [];
                for (let i = 1; i <= doc.numPages; i++) {
                    document.getElementById('loading-text').textContent = `${file.name} · ${i} / ${doc.numPages} 頁`;
                    const pdfPage = await doc.getPage(i);
                    const thumbnail = await generateThumbnail(pdfPage);
                    importedPages.push({ id: crypto.randomUUID(), fileData, pageIndex: i - 1, fileName: file.name, thumbnail, edits: { drawing: null, geometry: null } });
                    pdfPage.cleanup?.();
                }
                allPages.push(...importedPages);
                importedCount += importedPages.length;
            } catch (error) {
                failures.push(`${file.name}：${describeError(error)}`);
            } finally {
                await releaseDocument(task, doc);
            }
        }
    } catch (error) {
        failures.push(describeError(error));
    } finally {
        hideLoading();
        renderGrid();
        fileInput.value = '';
    }
    showToast(failures.length ? failures.join('；') : `已加入 ${importedCount} 頁。可拖曳或使用前移／後移調整順序。`);
}

async function generateThumbnail(pdfPage) {
    const natural = pdfPage.getViewport({ scale: 1 });
    const scale = Math.min(0.4, 280 / Math.max(natural.width, natural.height));
    const viewport = pdfPage.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.ceil(viewport.width));
    canvas.height = Math.max(1, Math.ceil(viewport.height));
    try {
        await pdfPage.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        return canvas.toDataURL('image/jpeg', 0.75);
    } finally { canvas.width = canvas.height = 0; }
}

function makeButton(label, className, callback, disabled = false) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = `page-action-btn ${className}`;
    button.textContent = label; button.disabled = disabled;
    button.addEventListener('click', callback);
    return button;
}

function renderGrid() {
    const empty = pagesGrid.querySelector('.empty-state');
    pagesGrid.querySelectorAll('.page-card').forEach(card => card.remove());
    if (empty) empty.style.display = allPages.length ? 'none' : 'block';
    allPages.forEach((page, index) => {
        const card = document.createElement('article');
        card.className = 'page-card'; card.dataset.id = page.id;
        const preview = document.createElement('div'); preview.className = 'page-thumbnail';
        const image = document.createElement('img'); image.src = page.thumbnail;
        image.alt = `${page.fileName}，原始第 ${page.pageIndex + 1} 頁`; image.loading = 'lazy';
        preview.appendChild(image);
        const info = document.createElement('div'); info.className = 'page-info';
        const number = document.createElement('span'); number.className = 'page-number'; number.textContent = String(index + 1);
        const name = document.createElement('span'); name.className = 'page-name'; name.textContent = page.fileName; name.title = page.fileName;
        const handle = document.createElement('span'); handle.className = 'drag-handle'; handle.textContent = '⠿'; handle.title = '拖曳排序'; handle.setAttribute('aria-hidden', 'true');
        info.append(number, name, handle);
        const actions = document.createElement('div'); actions.className = 'page-actions';
        actions.append(
            makeButton('前移', 'move-up', () => movePage(page.id, -1), index === 0),
            makeButton('後移', 'move-down', () => movePage(page.id, 1), index === allPages.length - 1),
            makeButton('編輯', 'edit', () => openEditor(page.id)),
            makeButton('刪除', 'delete', () => removePage(page.id))
        );
        card.append(preview, info, actions); pagesGrid.appendChild(card);
    });
    updateLabels();
}

function updateLabels() {
    document.getElementById('page-count-display').textContent = `${allPages.length} 頁`;
    document.getElementById('download-btn').disabled = isBusy || !allPages.length;
}

function focusCard(id, action = 'edit') {
    const card = Array.from(pagesGrid.children).find(item => item.dataset.id === id);
    (card?.querySelector(`.${action}:not(:disabled)`) || card?.querySelector('.edit') || document.getElementById('upload-btn')).focus();
}

function movePage(id, direction) {
    if (isBusy) return;
    const index = allPages.findIndex(page => page.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= allPages.length) return;
    [allPages[index], allPages[target]] = [allPages[target], allPages[index]];
    renderGrid();
    focusCard(id, direction < 0 ? 'move-up' : 'move-down');
    showToast(`已移至第 ${target + 1} 頁。`);
}

function removePage(id) {
    if (isBusy) return;
    const index = allPages.findIndex(page => page.id === id);
    if (index < 0) return;
    allPages.splice(index, 1);
    renderGrid();
    focusCard(allPages[Math.min(index, allPages.length - 1)]?.id);
    showToast(`已刪除頁面，剩餘 ${allPages.length} 頁。`);
}
window.removePage = removePage;

function loadCanvasImage(source) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('無法載入註記影像'));
        image.src = source;
    });
}

function geometryFromViewport(viewport, width, height) {
    const origin = viewport.convertToPdfPoint(0, height);
    const right = viewport.convertToPdfPoint(width, height);
    const top = viewport.convertToPdfPoint(0, 0);
    return { x: origin[0], y: origin[1], width: Math.hypot(right[0] - origin[0], right[1] - origin[1]), height: Math.hypot(top[0] - origin[0], top[1] - origin[1]), rotation: Math.atan2(right[1] - origin[1], right[0] - origin[0]) * 180 / Math.PI };
}

async function openEditor(id) {
    if (isBusy) return;
    const page = allPages.find(item => item.id === id);
    if (!page) return;
    editorOpener = document.activeElement;
    showLoading('載入頁面…');
    let task, doc;
    try {
        const api = await getPdfJS();
        task = api.getDocument(pdfOptions(page.fileData)); doc = await task.promise;
        const pdfPage = await doc.getPage(page.pageIndex + 1);
        const natural = pdfPage.getViewport({ scale: 1 });
        const scale = Math.min(1.5, 4096 / Math.max(natural.width, natural.height), Math.sqrt(4000000 / (natural.width * natural.height)));
        const viewport = pdfPage.getViewport({ scale });
        editCanvas.width = baseCanvas.width = Math.ceil(viewport.width);
        editCanvas.height = baseCanvas.height = Math.ceil(viewport.height);
        await pdfPage.render({ canvasContext: baseCtx, viewport }).promise;
        editGeometry = geometryFromViewport(viewport, editCanvas.width, editCanvas.height);
        ctx.clearRect(0, 0, editCanvas.width, editCanvas.height);
        if (page.edits.drawing) ctx.drawImage(await loadCanvasImage(page.edits.drawing), 0, 0, editCanvas.width, editCanvas.height);
        currentEditId = id;
        hasAnnotations = Boolean(page.edits.drawing);
        canvasTextInput.style.display = 'none';
        setTool('draw');
        document.getElementById('editor-title').textContent = `編輯第 ${allPages.indexOf(page) + 1} 頁`;
        editModal.showModal();
        document.getElementById('tool-draw').focus();
    } catch (error) {
        currentEditId = null;
        baseCanvas.width = baseCanvas.height = editCanvas.width = editCanvas.height = 0;
        showToast(`無法開啟頁面：${describeError(error)}`);
    } finally {
        hideLoading();
        await releaseDocument(task, doc);
    }
}

function closeEditModal() {
    if (isBusy) return;
    endDrawing();
    const pageId = currentEditId;
    editModal.close();
    currentEditId = null; editGeometry = null;
    canvasTextInput.style.display = 'none'; canvasTextInput.value = '';
    baseCanvas.width = baseCanvas.height = editCanvas.width = editCanvas.height = 0;
    if (editorOpener?.isConnected) editorOpener.focus();
    else focusCard(pageId);
}

function clearCanvas() {
    endDrawing();
    canvasTextInput.style.display = 'none'; canvasTextInput.value = '';
    ctx.clearRect(0, 0, editCanvas.width, editCanvas.height);
    hasAnnotations = false;
}

function canvasPoint(event) {
    const rect = editCanvas.getBoundingClientRect();
    return { x: Math.max(0, Math.min(editCanvas.width, (event.clientX - rect.left) * editCanvas.width / rect.width)), y: Math.max(0, Math.min(editCanvas.height, (event.clientY - rect.top) * editCanvas.height / rect.height)) };
}

function beginText(point) {
    if (canvasTextInput.style.display === 'block') placeText();
    textPos = point;
    textStyle = { size: Number(editSizeInput.value), color: editColorInput.value };
    const rect = editCanvas.getBoundingClientRect();
    canvasTextInput.style.left = `${point.x / editCanvas.width * 100}%`;
    canvasTextInput.style.top = `${point.y / editCanvas.height * 100}%`;
    canvasTextInput.style.color = textStyle.color;
    canvasTextInput.style.fontSize = `${textStyle.size * rect.width / editCanvas.width}px`;
    canvasTextInput.style.display = 'block'; canvasTextInput.value = '';
    canvasTextInput.focus();
}

editCanvas.addEventListener('pointerdown', event => {
    if (event.button !== 0 || currentEditId === null || activePointer !== null) return;
    event.preventDefault();
    const point = canvasPoint(event);
    if (currentTool === 'text') { beginText(point); return; }
    isDrawing = true; activePointer = event.pointerId;
    editCanvas.setPointerCapture?.(event.pointerId);
    ctx.strokeStyle = editColorInput.value; ctx.fillStyle = editColorInput.value;
    ctx.lineWidth = Number(editSizeInput.value); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.arc(point.x, point.y, ctx.lineWidth / 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(point.x, point.y);
    hasAnnotations = true;
});
editCanvas.addEventListener('pointermove', event => {
    if (!isDrawing || event.pointerId !== activePointer) return;
    const point = canvasPoint(event);
    ctx.lineTo(point.x, point.y); ctx.stroke();
});
function endDrawing(event) {
    if (event && event.pointerId !== activePointer) return;
    if (activePointer !== null && editCanvas.hasPointerCapture?.(activePointer)) editCanvas.releasePointerCapture(activePointer);
    activePointer = null; isDrawing = false;
}
['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => editCanvas.addEventListener(type, endDrawing));
editCanvas.addEventListener('keydown', event => {
    if (currentTool === 'text' && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault(); beginText({ x: editCanvas.width / 4, y: editCanvas.height / 3 });
    }
});
canvasTextInput.onkeydown = event => {
    if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); placeText(); editCanvas.focus(); }
    else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); canvasTextInput.style.display = 'none'; editCanvas.focus(); }
};
function placeText() {
    const text = canvasTextInput.value.trim();
    if (text) {
        ctx.font = `${textStyle.size}px Arial, sans-serif`; ctx.textBaseline = 'top'; ctx.fillStyle = textStyle.color;
        ctx.fillText(text, textPos.x, textPos.y); hasAnnotations = true;
    }
    canvasTextInput.style.display = 'none'; canvasTextInput.value = '';
}

function saveEdit() {
    if (isBusy) return;
    const page = allPages.find(item => item.id === currentEditId);
    if (!page) return;
    try {
        endDrawing();
        if (canvasTextInput.style.display === 'block') placeText();
        page.edits = { drawing: hasAnnotations ? editCanvas.toDataURL('image/png') : null, geometry: hasAnnotations ? editGeometry : null };
        const thumbnail = document.createElement('canvas');
        const thumbScale = Math.min(1, 280 / Math.max(baseCanvas.width, baseCanvas.height));
        thumbnail.width = Math.max(1, Math.round(baseCanvas.width * thumbScale));
        thumbnail.height = Math.max(1, Math.round(baseCanvas.height * thumbScale));
        const thumbCtx = thumbnail.getContext('2d');
        thumbCtx.drawImage(baseCanvas, 0, 0, thumbnail.width, thumbnail.height);
        thumbCtx.drawImage(editCanvas, 0, 0, thumbnail.width, thumbnail.height);
        page.thumbnail = thumbnail.toDataURL('image/jpeg', 0.75);
        thumbnail.width = thumbnail.height = 0;
        renderGrid(); closeEditModal(); showToast('註記已套用，請匯出保存 PDF。');
    } catch (error) { showToast('無法儲存註記，請減少內容後再試。'); }
}

async function exportPDF() {
    if (isBusy || !allPages.length) return;
    showLoading('合併並匯出 PDF…');
    let downloadUrl;
    try {
        if (typeof PDFLib === 'undefined') throw new Error('PDFLib is not defined');
        const mergedPdf = await PDFLib.PDFDocument.create();
        const sources = new Map();
        for (const item of allPages) {
            if (!sources.has(item.fileData)) sources.set(item.fileData, await PDFLib.PDFDocument.load(item.fileData));
            const [copiedPage] = await mergedPdf.copyPages(sources.get(item.fileData), [item.pageIndex]);
            if (item.edits.drawing) {
                const image = await mergedPdf.embedPng(item.edits.drawing);
                const geometry = item.edits.geometry;
                copiedPage.drawImage(image, { x: geometry.x, y: geometry.y, width: geometry.width, height: geometry.height, rotate: PDFLib.degrees(geometry.rotation) });
            }
            mergedPdf.addPage(copiedPage);
        }
        const bytes = await mergedPdf.save();
        downloadUrl = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
        const link = document.createElement('a'); link.href = downloadUrl; link.download = `merged_${Date.now()}.pdf`;
        document.body.appendChild(link); link.click(); link.remove();
        showToast('PDF 已準備完成，瀏覽器將開始下載。');
    } catch (error) {
        showToast(`匯出失敗：${describeError(error)}。原頁面仍保留，可重試。`);
    } finally {
        // Keep the URL alive long enough for the browser to start reading the download.
        if (downloadUrl) setTimeout(() => URL.revokeObjectURL(downloadUrl), 30000);
        hideLoading();
    }
}

function showLoading(text) {
    isBusy = true;
    document.getElementById('loading-text').textContent = text;
    document.getElementById('loading-overlay').classList.add('active');
    document.getElementById('upload-btn').disabled = true;
    document.getElementById('download-btn').disabled = true;
    pagesGrid.inert = true;
}
function hideLoading() {
    isBusy = false;
    document.getElementById('loading-overlay').classList.remove('active');
    document.getElementById('upload-btn').disabled = false;
    pagesGrid.inert = false;
    updateLabels();
}
function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message; toast.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 8000);
}
