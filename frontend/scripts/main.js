// ============================================================
//  MÓDULO PRINCIPAL: Extracción automática (con todas las funcionalidades)
// ============================================================

(function() {
    'use strict';

    // ============================================================
    //  NOTIFICACIONES GLOBALES
    // ============================================================
    window.showNotification = function(msg, isError = false) {
        const el = document.getElementById('notification');
        if (!el) return;
        el.textContent = msg;
        el.className = 'notification' + (isError ? ' error' : '');
        el.classList.add('show');
        clearTimeout(el._timeout);
        el._timeout = setTimeout(() => el.classList.remove('show'), 4000);
    };

    // ============================================================
    //  PESTAÑAS
    // ============================================================
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            this.classList.add('active');
            document.getElementById(this.dataset.tab).classList.add('active');
            if (this.dataset.tab === 'tab-pdf' && window.updatePdfPreview) {
                window.updatePdfPreview();
            }
        });
    });

    // ============================================================
    //  ELEMENTOS DOM
    // ============================================================
    const autoFileInput = document.getElementById('autoFileInput');
    const autoPages = document.getElementById('autoPages');
    const autoProcessBtn = document.getElementById('autoProcessBtn');
    const autoExportPgnBtn = document.getElementById('autoExportPgnBtn');
    const autoStatus = document.getElementById('autoStatus');
    const autoResults = document.getElementById('autoResults');
    const processGalleryBtn = document.getElementById('processGalleryBtn');
    const clearAutoResultsBtn = document.getElementById('clearAutoResultsBtn');
    const configPdfCropBtn = document.getElementById('configPdfCropBtn');
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');

    // ============================================================
    //  ESTADO
    // ============================================================
    let autoData = [];
    let autoFens = new Set();
    let undoStack = [];
    let redoStack = [];

    // ============================================================
    //  FUNCIONES DE UTILIDAD
    // ============================================================
    function toggleTurn(fen) {
        const parts = fen.split(' ');
        if (parts.length >= 3) {
            parts[1] = parts[1] === 'w' ? 'b' : 'w';
            return parts.join(' ');
        }
        return fen;
    }

    function setTurnInFen(fen, turnoChar) {
        const parts = fen.split(' ');
        if (parts.length >= 3) {
            parts[1] = turnoChar;
            return parts.join(' ');
        }
        return fen;
    }

    function updateUndoRedoButtons() {
        if (undoBtn) undoBtn.disabled = undoStack.length === 0;
        if (redoBtn) redoBtn.disabled = redoStack.length === 0;
    }

    // ============================================================
    //  AÑADIR RESULTADOS A LA TABLA
    // ============================================================
    function addResultsToAutoData(newResults) {
        if (!newResults || !newResults.length) return 0;
        let addedCount = 0;
        for (const item of newResults) {
            const fen = item.fen || null;
            if (fen && !autoFens.has(fen)) {
                autoFens.add(fen);
                autoData.push(item);
                addedCount++;
            } else if (!fen) {
                autoData.push(item);
                addedCount++;
            }
        }
        renderAutoResults();
        return addedCount;
    }

    // ============================================================
    //  RENDERIZAR TABLA DE RESULTADOS (CON MINIATURA MEJORADA)
    // ============================================================
    function renderAutoResults() {
        const container = document.getElementById('resultContainer');
        if (!container) return;
        
        if (!autoData || autoData.length === 0) {
            autoResults.innerHTML = '<p>No hay resultados. Sube imágenes o procesa recortes desde la galería.</p>';
            container.classList.add('hidden');
            updateUndoRedoButtons();
            return;
        }
        container.classList.remove('hidden');

        let html = `<table>
            <thead><tr>
                <th>Archivo</th>
                <th>Página</th>
                <th>FEN</th>
                <th>Vista previa</th>
                <th style="width:40px;">Turno</th>
                <th style="width:40px;">Acciones</th>
            </tr></thead><tbody>`;

        for (let i = 0; i < autoData.length; i++) {
            const item = autoData[i];
            const fen = item.fen || 'Error';
            const isError = !item.fen;
            
            let thumbHtml = '-';
            if (item.thumbnail) {
                thumbHtml = `<img src="data:image/jpeg;base64,${item.thumbnail}" class="thumbnail-img">`;
            } else if (item.cropDataURL) {
                thumbHtml = `<img src="${item.cropDataURL}" class="thumbnail-img">`;
            }
            
            html += `<tr id="auto-row-${i}" data-index="${i}">
                <td>${item.original_filename || item.file || 'Recorte'}</td>
                <td>${item.page || '-'}</td>
                <td class="${isError ? 'error' : 'success'} fen-cell" id="fen-cell-${i}">${fen}</td>
                <td>${thumbHtml}</td>
                <td style="text-align:center;">
                    ${!isError ? `<button class="btn-toggle-turn" data-index="${i}" data-fen="${fen}" title="Alternar turno" style="background:transparent; border:none; cursor:pointer; font-size:1.1rem;">🔄</button>` : '-'}
                </td>
                <td style="text-align:center; white-space:nowrap;">
                    ${!isError ? `
                        <button class="btn-copy-fen" data-fen="${fen}" data-index="${i}" title="Copiar FEN" style="background:transparent; border:none; cursor:pointer; font-size:1rem;">📋</button>
                        <button class="btn-cut-fen" data-index="${i}" title="Cortar (eliminar con deshacer)" style="background:transparent; border:none; cursor:pointer; font-size:1rem;">✂️</button>
                        <button class="btn-view-crop" data-index="${i}" title="Ver recorte enviado" style="background:transparent; border:none; cursor:pointer; font-size:1rem;">🔍</button>
                        <button class="btn-edit-crop" data-index="${i}" title="Editar en recorte manual" style="background:transparent; border:none; cursor:pointer; font-size:1rem;">✏️</button>
                        <button class="btn-retry" data-index="${i}" title="Reintentar (reprocesar esta imagen)" style="background:transparent; border:none; cursor:pointer; font-size:1rem;">↻</button>
                    ` : `
                        <button class="btn-retry" data-index="${i}" title="Reintentar (reprocesar esta imagen)" style="background:transparent; border:none; cursor:pointer; font-size:1rem;">↻</button>
                    `}
                </td>
            </tr>`;
        }

        html += '</tbody></table>';
        autoResults.innerHTML = html;

        // --- DELEGACIÓN DE EVENTOS para los botones dinámicos ---
        autoResults.addEventListener('click', async function(e) {
            // Botón: Reintentar
            const retryBtn = e.target.closest('.btn-retry');
            if (retryBtn) {
                const index = parseInt(retryBtn.getAttribute('data-index'));
                if (isNaN(index)) return;
                const item = autoData[index];
                if (!item || !item.cropDataURL) {
                    window.showNotification('No hay imagen para reintentar.', true);
                    return;
                }
                retryBtn.disabled = true;
                retryBtn.textContent = '⏳';
                try {
                    const resp = await fetch('/retry', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ cropDataURL: item.cropDataURL })
                    });
                    const data = await resp.json();
                    if (data.success && data.fen) {
                        // Actualizar el FEN y la miniatura en la fila
                        const fenCell = document.getElementById(`fen-cell-${index}`);
                        if (fenCell) {
                            fenCell.textContent = data.fen;
                            fenCell.className = 'success fen-cell';
                        }
                        // Actualizar el objeto en autoData
                        autoData[index].fen = data.fen;
                        if (data.thumbnail) {
                            autoData[index].thumbnail = data.thumbnail;
                            // Opcional: refrescar la miniatura, pero no es necesario si se recarga la tabla
                        }
                        window.showNotification('FEN actualizado correctamente.');
                    } else {
                        window.showNotification('Error: ' + (data.error || 'Falló el reintento'), true);
                    }
                } catch (err) {
                    window.showNotification('Error de red al reintentar.', true);
                } finally {
                    retryBtn.disabled = false;
                    retryBtn.textContent = '↻';
                }
                return;
            }

            // Botón: alternar turno
            const turnBtn = e.target.closest('.btn-toggle-turn');
            if (turnBtn) {
                const index = parseInt(turnBtn.getAttribute('data-index'));
                const currentFen = turnBtn.getAttribute('data-fen');
                if (isNaN(index) || !currentFen) return;
                const newFen = toggleTurn(currentFen);
                autoData[index].fen = newFen;
                document.getElementById(`fen-cell-${index}`).textContent = newFen;
                turnBtn.setAttribute('data-fen', newFen);
                if (currentFen) autoFens.delete(currentFen);
                autoFens.add(newFen);
                window.showNotification('Turno: ' + (newFen.includes(' w ') ? 'Blancas' : 'Negras'));
                return;
            }

            // Botón: copiar FEN
            const copyBtn = e.target.closest('.btn-copy-fen');
            if (copyBtn) {
                const fen = copyBtn.getAttribute('data-fen');
                if (fen) {
                    navigator.clipboard.writeText(fen).then(() => {
                        window.showNotification('FEN copiado al portapapeles');
                    }).catch(() => {
                        // Fallback
                        const ta = document.createElement('textarea');
                        ta.value = fen;
                        document.body.appendChild(ta);
                        ta.select();
                        document.execCommand('copy');
                        ta.remove();
                        window.showNotification('FEN copiado');
                    });
                }
                return;
            }

            // Botón: cortar (eliminar con deshacer)
            const cutBtn = e.target.closest('.btn-cut-fen');
            if (cutBtn) {
                const index = parseInt(cutBtn.getAttribute('data-index'));
                if (isNaN(index)) return;
                deleteResult(index);
                return;
            }

            // Botón: ver recorte (modal)
            const viewBtn = e.target.closest('.btn-view-crop');
            if (viewBtn) {
                const index = parseInt(viewBtn.getAttribute('data-index'));
                if (isNaN(index)) return;
                const item = autoData[index];
                if (!item || !item.cropDataURL) {
                    window.showNotification('No hay imagen de recorte disponible.', true);
                    return;
                }
                const modal = document.getElementById('cropModal');
                const modalImage = document.getElementById('modalImage');
                const modalPage = document.getElementById('modalPage');
                const modalBoard = document.getElementById('modalBoard');
                const modalError = document.getElementById('modalError');
                if (modal) {
                    modalImage.src = item.cropDataURL;
                    modalPage.textContent = item.page || '-';
                    modalBoard.textContent = (item.board || '1');
                    modalError.textContent = item.error ? '❌ ' + item.error : '✅ FEN obtenido';
                    modalError.style.color = item.error ? '#e74c3c' : '#27ae60';
                    modal.classList.add('active');
                }
                return;
            }

            // Botón: editar en recorte manual
            const editBtn = e.target.closest('.btn-edit-crop');
            if (editBtn) {
                const index = parseInt(editBtn.getAttribute('data-index'));
                if (isNaN(index)) return;
                const item = autoData[index];
                if (!item || !item.cropDataURL) {
                    window.showNotification('No hay imagen de recorte para editar.', true);
                    return;
                }
                document.querySelector('.tab-btn[data-tab="tab-crop"]').click();
                if (typeof window._loadCropImage === 'function') {
                    window._loadCropImage(item.cropDataURL, item.original_filename || 'Recorte');
                } else {
                    window.showNotification('Editor de recorte no disponible.', true);
                }
                return;
            }
        });

        // Actualizar contador y botones
        updateUndoRedoButtons();
        updateExportButtonState();
        const countSpan = document.getElementById('resultCount');
        if (countSpan) countSpan.textContent = autoData.length;
    }

    // ============================================================
    //  ELIMINAR FILA CON HISTORIAL (DESHACER/REHACER)
    // ============================================================
    function deleteResult(index) {
        if (index < 0 || index >= autoData.length) return;
        const deleted = autoData[index];
        undoStack.push({ type: 'delete', data: deleted, index: index });
        redoStack = [];
        autoData.splice(index, 1);
        renderAutoResults();
        updateUndoRedoButtons();
        window.showNotification('Fila eliminada');
    }

    // ============================================================
    //  DESHACER
    // ============================================================
    if (undoBtn) {
        undoBtn.addEventListener('click', function() {
            if (undoStack.length === 0) return;
            const action = undoStack.pop();
            autoData.splice(action.index, 0, action.data);
            redoStack.push(action);
            renderAutoResults();
            updateUndoRedoButtons();
            window.showNotification('Deshecho');
        });
    }

    // ============================================================
    //  REHACER
    // ============================================================
    if (redoBtn) {
        redoBtn.addEventListener('click', function() {
            if (redoStack.length === 0) return;
            const action = redoStack.pop();
            const idx = autoData.indexOf(action.data);
            if (idx !== -1) {
                autoData.splice(idx, 1);
                undoStack.push(action);
                renderAutoResults();
                updateUndoRedoButtons();
                window.showNotification('Rehecho');
            } else {
                redoStack = [];
                updateUndoRedoButtons();
            }
        });
    }

    // ============================================================
    //  EXPORTAR PGN
    // ============================================================
    function updateExportButtonState() {
        const hasFens = autoData.some(item => item.fen);
        if (autoExportPgnBtn) autoExportPgnBtn.disabled = !hasFens;
    }

    function getFensForExport() {
        return autoData.filter(item => item.fen).map(item => item.fen);
    }

    // ============================================================
    //  BOTÓN: PROCESAR ARCHIVOS (con patrones del editor auto)
    // ============================================================
    const oldAutoProcessBtn = autoProcessBtn;
    const newAutoProcessBtn = oldAutoProcessBtn.cloneNode(true);
    oldAutoProcessBtn.parentNode.replaceChild(newAutoProcessBtn, oldAutoProcessBtn);
    const autoProcessBtnRef = newAutoProcessBtn;

    autoProcessBtnRef.addEventListener('click', async function() {
        const files = autoFileInput.files;
        if (!files.length) {
            window.showNotification('Selecciona al menos un archivo.', true);
            return;
        }
        const patterns = window.autoPagePatterns || {};
        const hasPatterns = Object.values(patterns).some(arr => arr && arr.length > 0);

        const formData = new FormData();
        for (const f of files) formData.append('files', f);
        formData.append('pages', autoPages.value);

        if (hasPatterns) {
            const patternsToSend = {};
            for (const key in patterns) {
                patternsToSend[key] = patterns[key];
            }
            formData.append('page_patterns', JSON.stringify(patternsToSend));
        }

        autoStatus.textContent = 'Procesando archivos...';
        autoProcessBtnRef.disabled = true;

        try {
            const resp = await fetch('/upload', { method: 'POST', body: formData });
            const data = await resp.json();
            if (!data.success) throw new Error(data.error || 'Error en el servidor');
            const newResults = data.results || [];
            newResults.forEach(item => {
                if (!item.cropDataURL) {
                    item.cropDataURL = item.thumbnail ? `data:image/jpeg;base64,${item.thumbnail}` : null;
                }
            });
            const added = addResultsToAutoData(newResults);
            autoStatus.textContent = `Se añadieron ${added} nuevos elementos. Total: ${autoData.length} elementos.`;
        } catch (e) {
            window.showNotification('Error: ' + e.message, true);
            autoStatus.textContent = 'Error';
        } finally {
            autoProcessBtnRef.disabled = false;
        }
    });

    // ============================================================
    //  BOTÓN: PROCESAR RECORTES DESDE GALERÍA
    // ============================================================
    processGalleryBtn.addEventListener('click', async function() {
        const boards = window.cropBoards || [];
        if (!boards.length) {
            window.showNotification('No hay recortes en la galería.', true);
            return;
        }
        autoStatus.textContent = `Procesando ${boards.length} recortes...`;
        processGalleryBtn.disabled = true;

        const newResults = [];
        for (let i = 0; i < boards.length; i++) {
            const board = boards[i];
            try {
                let imageData = board.dataUrl;
                if (imageData.startsWith('data:image')) imageData = imageData.split(',')[1];
                const resp = await fetch('/upload-crop', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ image: imageData })
                });
                const data = await resp.json();
                if (data.success) {
                    let fen = data.fen;
                    if (fen && board.turno) {
                        const turnoChar = board.turno === 'white' ? 'w' : 'b';
                        fen = setTurnInFen(fen, turnoChar);
                    }
                    newResults.push({
                        original_filename: board.turno ? `Recorte ${i+1} (${board.turno})` : `Recorte ${i+1}`,
                        file: `recorte_${i+1}`,
                        fen: fen,
                        thumbnail: data.thumbnail,
                        cropDataURL: board.dataUrl,
                        error: null,
                        page: '-'
                    });
                } else {
                    newResults.push({
                        original_filename: `Recorte ${i+1}`,
                        file: `recorte_${i+1}`,
                        fen: null,
                        thumbnail: null,
                        cropDataURL: board.dataUrl,
                        error: data.error || 'Error',
                        page: '-'
                    });
                }
            } catch (e) {
                newResults.push({
                    original_filename: `Recorte ${i+1}`,
                    file: `recorte_${i+1}`,
                    fen: null,
                    thumbnail: null,
                    cropDataURL: board.dataUrl,
                    error: 'Error de red',
                    page: '-'
                });
            }
        }
        const added = addResultsToAutoData(newResults);
        autoStatus.textContent = `Procesados ${boards.length} recortes. Añadidos ${added} nuevos FEN. Total: ${autoData.length} elementos.`;
        processGalleryBtn.disabled = false;
    });

    // ============================================================
    //  BOTÓN: CONFIGURAR RECORTES PARA PDF (usando editor auto)
    // ============================================================
    configPdfCropBtn.addEventListener('click', async function() {
        const files = autoFileInput.files;
        if (!files.length) { window.showNotification('Selecciona un PDF primero.', true); return; }
        const pdfFile = files[0];
        if (!pdfFile.name.toLowerCase().endsWith('.pdf')) { window.showNotification('El archivo no es un PDF.', true); return; }

        const formData = new FormData();
        formData.append('file', pdfFile);
        formData.append('pages', autoPages.value || '1');

        try {
            const resp = await fetch('/extract-pdf-pages', { method: 'POST', body: formData });
            const data = await resp.json();
            if (!data.success) throw new Error(data.error || 'Error al extraer páginas');
            if (typeof window.loadAutoPdfForCrop === 'function') {
                window.loadAutoPdfForCrop(data.pages);
                window.showNotification(`PDF cargado en el editor. Páginas: ${data.pages.length}.`);
            } else {
                window.showNotification('Editor de recorte no disponible.', true);
            }
        } catch (e) {
            window.showNotification('Error: ' + e.message, true);
        }
    });

    // ============================================================
    //  BOTÓN: LIMPIAR RESULTADOS
    // ============================================================
    if (clearAutoResultsBtn) {
        clearAutoResultsBtn.addEventListener('click', function() {
            if (confirm('¿Eliminar todos los resultados?')) {
                window.clearAutoData();
                window.showNotification('Resultados eliminados');
            }
        });
    }

    // ============================================================
    //  BOTÓN: EXPORTAR PGN
    // ============================================================
    if (autoExportPgnBtn) {
        autoExportPgnBtn.addEventListener('click', async function() {
            const fens = getFensForExport();
            if (!fens.length) { window.showNotification('No hay FEN para exportar.', true); return; }
            const studyName = prompt('Nombre del estudio:', 'Mi Estudio') || 'Mi Estudio';
            const user = prompt('Usuario de Lichess:', 'Anónimo') || 'Anónimo';
            try {
                const resp = await fetch('/export-pgn', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fens, study_name: studyName, user })
                });
                if (!resp.ok) throw new Error('Error al exportar');
                const blob = await resp.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = 'fen_study.pgn'; a.click();
                URL.revokeObjectURL(url);
                window.showNotification('PGN descargado');
            } catch (e) { window.showNotification('Error: ' + e.message, true); }
        });
    }

    // ============================================================
    //  EXPORTAR FUNCIONES GLOBALES
    // ============================================================
    window.getAutoFens = getFensForExport;
    window.getAutoData = () => autoData;
    window.clearAutoData = () => {
        autoData = [];
        autoFens = new Set();
        undoStack = [];
        redoStack = [];
        renderAutoResults();
        updateUndoRedoButtons();
        updateExportButtonState();
    };

    // ============================================================
    //  MODAL (para ver recorte)
    // ============================================================
    const modal = document.getElementById('cropModal');
    const modalClose = document.getElementById('modalClose');
    if (modalClose) {
        modalClose.addEventListener('click', () => modal.classList.remove('active'));
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('active');
        });
    }

    // ============================================================
    //  INICIALIZAR
    // ============================================================
    renderAutoResults();
    updateUndoRedoButtons();

})();
