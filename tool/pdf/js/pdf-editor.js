pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const { PDFDocument } = PDFLib;

let allPages = [];
let currentEditId = null;
let isDrawing = false;
let currentTool = 'draw';
let baseImage = null;
let textPos = { x: 0, y: 0 };

const pagesGrid = document.getElementById('pages-grid');
const editCanvas = document.getElementById('pdf-edit-canvas');
const ctx = editCanvas.getContext('2d');
const editModal = document.getElementById('edit-modal');
const canvasTextInput = document.getElementById('canvas-text-input');
const editColorInput = document.getElementById('edit-color');
const editSizeInput = document.getElementById('edit-size');
const sizeLabel = document.getElementById('size-label');

// Sortable
new Sortable(pagesGrid, {
    animation: 150,
    filter: '.empty-state',
    onEnd: () => {
        const newOrder = Array.from(pagesGrid.children)
            .filter(c => c.className.includes('page-card'))
            .map(c => c.dataset.id);
        allPages = newOrder.map(id => allPages.find(p => p.id === id));
        updateLabels();
    }
});

// File input
document.getElementById('file-input').onchange = (e) => handleFiles(e.target.files);

// Tool functions
function setTool(tool) {
    currentTool = tool;
    document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
    if (tool === 'text') {
        document.getElementById('tool-text').classList.add('active');
        sizeLabel.textContent = `字體: ${editSizeInput.value}`;
        if (editSizeInput.value < 12) {
            editSizeInput.value = 24;
            sizeLabel.textContent = `字體: 24`;
        }
    } else {
        document.getElementById('tool-draw').classList.add('active');
        sizeLabel.textContent = `粗細: ${editSizeInput.value}`;
    }
    canvasTextInput.style.display = 'none';
}

editSizeInput.oninput = (e) => {
    sizeLabel.textContent = (currentTool === 'text' ? '字體: ' : '粗細: ') + e.target.value;
};

async function handleFiles(files) {
    const pdfFiles = Array.from(files).filter(f => f.type === 'application/pdf');
    if (!pdfFiles.length) return;

    showLoading('解析檔案中...');
    for (const file of pdfFiles) {
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;

        for (let i = 1; i <= pdfDoc.numPages; i++) {
            const page = await pdfDoc.getPage(i);
            const thumb = await generateThumbnail(page, 0.3);
            allPages.push({
                id: crypto.randomUUID(),
                fileData: arrayBuffer,
                pageIndex: i - 1,
                fileName: file.name,
                thumbnail: thumb,
                edits: { drawing: null }
            });
        }
    }
    hideLoading();
    renderGrid();
}

async function generateThumbnail(pdfPage, scale) {
    const vp = pdfPage.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.height = vp.height;
    canvas.width = vp.width;
    await pdfPage.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
    return canvas.toDataURL();
}

function renderGrid() {
    const empty = pagesGrid.querySelector('.empty-state');
    const cards = pagesGrid.querySelectorAll('.page-card');
    cards.forEach(c => c.remove());

    if (!allPages.length) {
        if (empty) empty.style.display = 'block';
        document.getElementById('download-btn').disabled = true;
        return;
    }

    if (empty) empty.style.display = 'none';
    document.getElementById('download-btn').disabled = false;

    allPages.forEach((p, i) => {
        const card = document.createElement('div');
        card.className = 'page-card';
        card.dataset.id = p.id;
        card.innerHTML = `
            <div class="page-thumbnail">
                <img src="${p.thumbnail}">
            </div>
            <div class="page-info">
                <span class="page-number">${i + 1}</span>
            </div>
            <div class="page-actions">
                <button class="page-action-btn edit" onclick="openEditor('${p.id}')">
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="page-action-btn delete" onclick="removePage('${p.id}')">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        `;
        pagesGrid.appendChild(card);
    });
    updateLabels();
}

function updateLabels() {
    document.querySelectorAll('.page-number').forEach((n, i) => n.textContent = i + 1);
    document.getElementById('page-count-display').textContent = `${allPages.length} 頁`;
}

window.removePage = (id) => {
    allPages = allPages.filter(p => p.id !== id);
    renderGrid();
};

// Editor
async function openEditor(id) {
    currentEditId = id;
    setTool('draw');
    const page = allPages.find(p => p.id === id);
    showLoading('載入頁面...');

    const pdfDoc = await pdfjsLib.getDocument({ data: page.fileData.slice(0) }).promise;
    const pdfPage = await pdfDoc.getPage(page.pageIndex + 1);
    const vp = pdfPage.getViewport({ scale: 1.5 });

    editCanvas.width = vp.width;
    editCanvas.height = vp.height;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = vp.width;
    tempCanvas.height = vp.height;
    await pdfPage.render({ canvasContext: tempCanvas.getContext('2d'), viewport: vp }).promise;

    baseImage = new Image();
    baseImage.src = tempCanvas.toDataURL();
    baseImage.onload = () => {
        ctx.drawImage(baseImage, 0, 0);
        if (page.edits.drawing) {
            const savedImg = new Image();
            savedImg.src = page.edits.drawing;
            savedImg.onload = () => ctx.drawImage(savedImg, 0, 0);
        }
        hideLoading();
        editModal.classList.add('active');
    };
}

function closeEditModal() {
    editModal.classList.remove('active');
    currentEditId = null;
    canvasTextInput.style.display = 'none';
}

function clearCanvas() {
    ctx.clearRect(0, 0, editCanvas.width, editCanvas.height);
    if (baseImage) ctx.drawImage(baseImage, 0, 0);
}

// Canvas drawing
editCanvas.onmousedown = (e) => {
    const rect = editCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const color = editColorInput.value;
    const size = editSizeInput.value;

    if (currentTool === 'draw') {
        isDrawing = true;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.strokeStyle = color;
        ctx.lineWidth = size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
    } else if (currentTool === 'text') {
        if (canvasTextInput.style.display === 'block') placeText();

        textPos = { x, y };
        canvasTextInput.style.left = x + 'px';
        canvasTextInput.style.top = (y - (size / 1.5)) + 'px';
        canvasTextInput.style.color = color;
        canvasTextInput.style.fontSize = size + 'px';
        canvasTextInput.style.display = 'block';
        canvasTextInput.value = '';
        setTimeout(() => canvasTextInput.focus(), 10);
    }
};

editCanvas.onmousemove = (e) => {
    if (!isDrawing) return;
    const rect = editCanvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
};

editCanvas.onmouseup = () => isDrawing = false;

canvasTextInput.onkeydown = (e) => {
    if (e.key === 'Enter') placeText();
    else if (e.key === 'Escape') canvasTextInput.style.display = 'none';
};

function placeText() {
    const val = canvasTextInput.value.trim();
    if (val) {
        const size = editSizeInput.value;
        ctx.font = `${size}px Arial`;
        ctx.fillStyle = editColorInput.value;
        ctx.fillText(val, textPos.x, textPos.y);
    }
    canvasTextInput.style.display = 'none';
}

function saveEdit() {
    if (canvasTextInput.style.display === 'block') placeText();
    const page = allPages.find(p => p.id === currentEditId);
    page.edits.drawing = editCanvas.toDataURL();
    page.thumbnail = editCanvas.toDataURL('image/jpeg', 0.5);
    renderGrid();
    closeEditModal();
}

// Export
async function exportPDF() {
    if (!allPages.length) return;
    showLoading('處理中...');
    try {
        const mergedPdf = await PDFDocument.create();
        const pdfSourceMap = new Map();

        for (const item of allPages) {
            let sourceDoc;
            if (pdfSourceMap.has(item.fileData)) {
                sourceDoc = pdfSourceMap.get(item.fileData);
            } else {
                sourceDoc = await PDFDocument.load(item.fileData);
                pdfSourceMap.set(item.fileData, sourceDoc);
            }

            const [copiedPage] = await mergedPdf.copyPages(sourceDoc, [item.pageIndex]);
            if (item.edits.drawing) {
                const overlayImg = await mergedPdf.embedPng(item.edits.drawing);
                const { width, height } = copiedPage.getSize();
                copiedPage.drawImage(overlayImg, { x: 0, y: 0, width, height });
            }
            mergedPdf.addPage(copiedPage);
        }

        const pdfBytes = await mergedPdf.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `merged_${Date.now()}.pdf`;
        a.click();
        showToast('匯出完成！');
    } catch (err) {
        console.error(err);
        showToast('錯誤：' + err.message);
    } finally {
        hideLoading();
    }
}

function showLoading(text) {
    document.getElementById('loading-text').textContent = text;
    document.getElementById('loading-overlay').classList.add('active');
}

function hideLoading() {
    document.getElementById('loading-overlay').classList.remove('active');
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}
