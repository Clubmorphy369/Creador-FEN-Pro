// ============================================================
//  EDITOR DE RECORTE PARA LA PESTAÑA AUTO (CUADRÍCULA MEJORADA)
// ============================================================
(function() {
    'use strict';

    // ============ ELEMENTOS DOM (con prefijo auto) ============
    const container = document.getElementById('autoCropContainer');
    const imageToCrop = document.getElementById('autoImageToCrop');
    const boxesContainer = document.getElementById('autoCropBoxesContainer');
    const gridOverlay = document.getElementById('autoGridOverlay');
    const gridToggle = document.getElementById('autoGridToggle');
    const gridDivisionsSelect = document.getElementById('autoGridDivisions');

    const addBoxBtn = document.getElementById('autoAddCropBox');
    const snapBtn = document.getElementById('autoSnapCropBoxes');
    const savePatternBtn = document.getElementById('autoSavePattern');
    const closeEditorBtn = document.getElementById('autoCloseCropEditor');
    const processBtn = document.getElementById('autoCropProcessBtn');
    const clearBoxesBtn = document.getElementById('autoClearCropBoxes');
    const prevPageBtn = document.getElementById('autoCropPrevPage');
    const nextPageBtn = document.getElementById('autoCropNextPage');
    const pageCounter = document.getElementById('autoCropPageCounter');

    // ============ ESTADO ============
    let currentImageData = null;
    let originalImage = null;
    let originalWidth = 0, originalHeight = 0;
    let cropBoxes = [];
    let activeCropIndex = -1;
    let pagePatterns = {};
    let currentPageIndex = 0;
    let totalPages = 0;
    let allPagesData = [];

    let isDragging = false, isResizing = false, resizeDir = '';
    let startX = 0, startY = 0;
    let startBoxX = 0, startBoxY = 0, startBoxW = 0, startBoxH = 0;
    let imageOffsetX = 0, imageOffsetY = 0;
    let gridDivisions = 10;
    let dragData = null;

    // ============ FUNCIONES DE ESCALA Y OFFSET ============
    function getScale() {
        if (!originalWidth || !originalHeight) return 1;
        const rect = imageToCrop.getBoundingClientRect();
        const displayWidth = rect.width;
        return displayWidth === 0 ? 1 : displayWidth / originalWidth;
    }

    function calculateImageOffset() {
        const imgRect = imageToCrop.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        imageOffsetX = imgRect.left - containerRect.left;
        imageOffsetY = imgRect.top - containerRect.top;
    }

    function getPointerInImage(clientX, clientY) {
        const imgRect = imageToCrop.getBoundingClientRect();
        const scaleX = imgRect.width / originalWidth;
        const scaleY = imgRect.height / originalHeight;
        const x = (clientX - imageOffsetX) / scaleX;
        const y = (clientY - imageOffsetY) / scaleY;
        return { origX: x, origY: y };
    }

    function getDisplayedImageSize() {
        const rect = imageToCrop.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
    }

    // ============ CUADRÍCULA (MEJORADA, VERDE BRILLANTE) ============
    function updateGrid() {
        if (!gridOverlay || !gridToggle) return;

        // Si el toggle está desactivado, ocultar
        if (!gridToggle.checked) {
            gridOverlay.style.display = 'none';
            return;
        }

        // Mostrar la cuadrícula
        gridOverlay.style.display = 'block';

        // Posicionar exactamente sobre la imagen
        const offset = { left: imageOffsetX, top: imageOffsetY };
        const size = getDisplayedImageSize();

        gridOverlay.style.left = offset.left + 'px';
        gridOverlay.style.top = offset.top + 'px';
        gridOverlay.style.width = size.width + 'px';
        gridOverlay.style.height = size.height + 'px';

        // Construir la cuadrícula con líneas verdes brillantes y gruesas
        const divisions = gridDivisions;
        let bgImage = '';

        for (let i = 1; i < divisions; i++) {
            const posX = (i / divisions) * 100;
            const posY = (i / divisions) * 100;

            // Línea vertical (verde brillante, 2px)
            bgImage += `linear-gradient(to right, rgba(0, 255, 0, 0.8) 0%, rgba(0, 255, 0, 0.8) 2px, transparent 2px, transparent 100%) ${posX}% 0% / 100% 100%, `;

            // Línea horizontal (verde brillante, 2px)
            bgImage += `linear-gradient(to bottom, rgba(0, 255, 0, 0.8) 0%, rgba(0, 255, 0, 0.8) 2px, transparent 2px, transparent 100%) 0% ${posY}% / 100% 100%`;

            if (i < divisions - 1) {
                bgImage += ', ';
            }
        }

        // Si no hay divisiones, limpiar
        if (divisions <= 1) {
            bgImage = 'none';
        }

        gridOverlay.style.backgroundImage = bgImage;
        gridOverlay.style.backgroundSize = '100% 100%';
        gridOverlay.style.backgroundRepeat = 'no-repeat';
        gridOverlay.style.backgroundPosition = '0 0';
        gridOverlay.style.border = 'none';
        gridOverlay.style.backgroundColor = 'transparent';
        gridOverlay.style.boxShadow = 'none';
        gridOverlay.style.pointerEvents = 'none';
    }

    function snapToGrid(value, gridSize) {
        return Math.round(value / gridSize) * gridSize;
    }

    function getGridSize() {
        return Math.round(Math.min(originalWidth, originalHeight) * 0.005);
    }

    function applySnapToBox(box) {
        if (!originalWidth || !originalHeight) return;
        const grid = getGridSize();
        if (grid <= 0) return;
        box.x = snapToGrid(box.x, grid);
        box.y = snapToGrid(box.y, grid);
        box.w = snapToGrid(box.w, grid);
        box.h = snapToGrid(box.h, grid);
    }

    // ============ RECUADROS ============
    function createBoxElement(x, y, w, h, label) {
        const box = document.createElement('div');
        box.className = 'crop-box';
        box.dataset.index = cropBoxes.length;

        const lbl = document.createElement('span');
        lbl.className = 'crop-label';
        lbl.textContent = label || `#${cropBoxes.length+1}`;
        box.appendChild(lbl);

        const sizeLabel = document.createElement('div');
        sizeLabel.className = 'crop-size';
        sizeLabel.textContent = `${Math.round(w)}×${Math.round(h)}`;
        box.appendChild(sizeLabel);

        const close = document.createElement('span');
        close.className = 'crop-close';
        close.textContent = '✕';
        close.addEventListener('mousedown', (e) => e.stopPropagation());
        close.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(box.dataset.index);
            removeBox(idx);
        });
        box.appendChild(close);

        const dirs = ['nw', 'ne', 'sw', 'se'];
        dirs.forEach(d => {
            const handle = document.createElement('div');
            handle.className = `resize-handle resize-${d}`;
            box.appendChild(handle);
        });

        box.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('resize-handle') || e.target === close) return;
            e.stopPropagation(); e.preventDefault();
            const idx = cropBoxes.findIndex(b => b.element === box);
            if (idx < 0) return;
            activeCropIndex = idx;
            const obj = cropBoxes[idx];
            isDragging = true;
            startX = e.clientX; startY = e.clientY;
            startBoxX = obj.x; startBoxY = obj.y;
            box.style.borderColor = '#2ecc71';
            box.style.borderWidth = '3px';
        });

        box.addEventListener('touchstart', (e) => {
            if (e.target.classList.contains('resize-handle') || e.target === close) return;
            e.stopPropagation(); e.preventDefault();
            const touch = e.touches[0];
            const idx = cropBoxes.findIndex(b => b.element === box);
            if (idx < 0) return;
            activeCropIndex = idx;
            const obj = cropBoxes[idx];
            isDragging = true;
            startX = touch.clientX; startY = touch.clientY;
            startBoxX = obj.x; startBoxY = obj.y;
            box.style.borderColor = '#2ecc71';
            box.style.borderWidth = '3px';
        }, { passive: false });

        box.querySelectorAll('.resize-handle').forEach(handle => {
            handle.addEventListener('mousedown', (e) => {
                e.stopPropagation(); e.preventDefault();
                const idx = cropBoxes.findIndex(b => b.element === box);
                if (idx < 0) return;
                activeCropIndex = idx;
                const obj = cropBoxes[idx];
                isResizing = true;
                resizeDir = handle.className.split(' ')[1].replace('resize-', '');
                startX = e.clientX; startY = e.clientY;
                startBoxX = obj.x; startBoxY = obj.y;
                startBoxW = obj.w; startBoxH = obj.h;
                box.style.borderColor = '#2ecc71';
                box.style.borderWidth = '3px';
            });
            handle.addEventListener('touchstart', (e) => {
                e.stopPropagation(); e.preventDefault();
                const touch = e.touches[0];
                const idx = cropBoxes.findIndex(b => b.element === box);
                if (idx < 0) return;
                activeCropIndex = idx;
                const obj = cropBoxes[idx];
                isResizing = true;
                resizeDir = handle.className.split(' ')[1].replace('resize-', '');
                startX = touch.clientX; startY = touch.clientY;
                startBoxX = obj.x; startBoxY = obj.y;
                startBoxW = obj.w; startBoxH = obj.h;
                box.style.borderColor = '#2ecc71';
                box.style.borderWidth = '3px';
            }, { passive: false });
        });

        boxesContainer.appendChild(box);
        return box;
    }

    function addCropBox(x, y, w, h, label) {
        if (!originalWidth || !originalHeight) return;
        if (cropBoxes.length > 0) {
            const last = cropBoxes[cropBoxes.length - 1];
            w = last.w; h = last.h;
        } else {
            const cols = 2, rows = 3;
            const cellW = Math.floor(originalWidth / cols);
            const cellH = Math.floor(originalHeight / rows);
            const margin = Math.min(15, Math.floor(Math.min(cellW, cellH) * 0.1));
            w = cellW - 2 * margin; h = cellH - 2 * margin;
        }
        if (x === undefined) {
            x = Math.floor((originalWidth - w) / 2);
            y = Math.floor((originalHeight - h) / 2);
        }
        x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
        const temp = { x, y, w, h };
        applySnapToBox(temp);
        x = temp.x; y = temp.y; w = temp.w; h = temp.h;
        if (x + w > originalWidth) w = originalWidth - x;
        if (y + h > originalHeight) h = originalHeight - y;
        if (w < 10) w = 10; if (h < 10) h = 10;
        if (x < 0) x = 0; if (y < 0) y = 0;

        const box = createBoxElement(x, y, w, h, label || `#${cropBoxes.length+1}`);
        const data = { x, y, w, h, element: box };
        cropBoxes.push(data);
        activeCropIndex = cropBoxes.length - 1;
        updateCropBoxesVisual();
        return data;
    }

    function removeBox(index) {
        if (index < 0 || index >= cropBoxes.length) return;
        const data = cropBoxes[index];
        data.element.remove();
        cropBoxes.splice(index, 1);
        cropBoxes.forEach((b, i) => {
            b.element.dataset.index = i;
        });
        if (activeCropIndex >= cropBoxes.length) activeCropIndex = cropBoxes.length - 1;
        if (activeCropIndex >= 0) {
            const el = cropBoxes[activeCropIndex].element;
            el.style.borderColor = '#2ecc71';
            el.style.borderWidth = '3px';
        } else {
            activeCropIndex = -1;
        }
        updateCropBoxesVisual();
    }

    function clearBoxes() {
        cropBoxes.forEach(b => b.element.remove());
        cropBoxes = [];
        activeCropIndex = -1;
        updateCropBoxesVisual();
    }

    function getPattern() {
        return cropBoxes.map(b => ({
            x: Math.round(b.x),
            y: Math.round(b.y),
            w: Math.round(b.w),
            h: Math.round(b.h)
        }));
    }

    function updateCropBoxesVisual() {
        const scale = getScale();
        cropBoxes.forEach((boxObj, idx) => {
            const el = boxObj.element;
            const left = imageOffsetX + boxObj.x * scale;
            const top = imageOffsetY + boxObj.y * scale;
            const w = boxObj.w * scale;
            const h = boxObj.h * scale;
            el.style.left = left + 'px';
            el.style.top = top + 'px';
            el.style.width = w + 'px';
            el.style.height = h + 'px';
            el.style.borderColor = (idx === activeCropIndex) ? '#2ecc71' : '#f1c40f';
            el.style.borderWidth = (idx === activeCropIndex) ? '3px' : '2px';
            const sizeSpan = el.querySelector('.crop-size');
            if (sizeSpan) sizeSpan.textContent = `${Math.round(boxObj.w)}×${Math.round(boxObj.h)}`;
        });
        updateGrid();
    }

    // ============ EVENTOS GLOBALES DE MOVIMIENTO ============
    document.addEventListener('mousemove', function(e) {
        if (!isDragging && !isResizing) return;
        if (activeCropIndex < 0 || activeCropIndex >= cropBoxes.length) return;
        const obj = cropBoxes[activeCropIndex];
        const imgRect = imageToCrop.getBoundingClientRect();
        const scaleX = imgRect.width / originalWidth;
        const scaleY = imgRect.height / originalHeight;
        const dx = (e.clientX - startX) / scaleX;
        const dy = (e.clientY - startY) / scaleY;

        if (isDragging) {
            let newX = startBoxX + dx;
            let newY = startBoxY + dy;
            newX = Math.max(0, Math.min(originalWidth - obj.w, newX));
            newY = Math.max(0, Math.min(originalHeight - obj.h, newY));
            obj.x = Math.round(newX);
            obj.y = Math.round(newY);
            if (!e.altKey) {
                const grid = getGridSize();
                obj.x = snapToGrid(obj.x, grid);
                obj.y = snapToGrid(obj.y, grid);
            }
        } else if (isResizing) {
            let newW = startBoxW, newH = startBoxH, newX = startBoxX, newY = startBoxY;
            if (resizeDir.includes('e')) newW = Math.max(10, startBoxW + dx);
            if (resizeDir.includes('w')) { newX = Math.max(0, startBoxX + dx); newW = Math.max(10, startBoxW - dx); }
            if (resizeDir.includes('s')) newH = Math.max(10, startBoxH + dy);
            if (resizeDir.includes('n')) { newY = Math.max(0, startBoxY + dy); newH = Math.max(10, startBoxH - dy); }
            if (newX + newW > originalWidth) newW = originalWidth - newX;
            if (newY + newH > originalHeight) newH = originalHeight - newY;
            obj.x = Math.round(newX);
            obj.y = Math.round(newY);
            obj.w = Math.round(newW);
            obj.h = Math.round(newH);
            if (!e.altKey) {
                const grid = getGridSize();
                obj.x = snapToGrid(obj.x, grid);
                obj.y = snapToGrid(obj.y, grid);
                obj.w = snapToGrid(obj.w, grid);
                obj.h = snapToGrid(obj.h, grid);
            }
        }
        updateCropBoxesVisual();
    });

    document.addEventListener('mouseup', function() {
        isDragging = false; isResizing = false;
    });

    document.addEventListener('touchmove', function(e) {
        if (!isDragging && !isResizing) return;
        e.preventDefault();
        const touch = e.touches[0];
        if (activeCropIndex < 0 || activeCropIndex >= cropBoxes.length) return;
        const obj = cropBoxes[activeCropIndex];
        const imgRect = imageToCrop.getBoundingClientRect();
        const scaleX = imgRect.width / originalWidth;
        const scaleY = imgRect.height / originalHeight;
        const dx = (touch.clientX - startX) / scaleX;
        const dy = (touch.clientY - startY) / scaleY;

        if (isDragging) {
            let newX = startBoxX + dx;
            let newY = startBoxY + dy;
            newX = Math.max(0, Math.min(originalWidth - obj.w, newX));
            newY = Math.max(0, Math.min(originalHeight - obj.h, newY));
            obj.x = Math.round(newX);
            obj.y = Math.round(newY);
        } else if (isResizing) {
            let newW = startBoxW, newH = startBoxH, newX = startBoxX, newY = startBoxY;
            if (resizeDir.includes('e')) newW = Math.max(10, startBoxW + dx);
            if (resizeDir.includes('w')) { newX = Math.max(0, startBoxX + dx); newW = Math.max(10, startBoxW - dx); }
            if (resizeDir.includes('s')) newH = Math.max(10, startBoxH + dy);
            if (resizeDir.includes('n')) { newY = Math.max(0, startBoxY + dy); newH = Math.max(10, startBoxH - dy); }
            if (newX + newW > originalWidth) newW = originalWidth - newX;
            if (newY + newH > originalHeight) newH = originalHeight - newY;
            obj.x = Math.round(newX);
            obj.y = Math.round(newY);
            obj.w = Math.round(newW);
            obj.h = Math.round(newH);
        }
        updateCropBoxesVisual();
    }, { passive: false });

    document.addEventListener('touchend', function() {
        isDragging = false; isResizing = false;
    });

    // ============ CARGAR PÁGINA ============
    function loadPage(index) {
        if (!allPagesData.length || index < 0 || index >= allPagesData.length) return;
        currentPageIndex = index;
        const dataUrl = allPagesData[index];
        const img = new Image();
        img.onload = function() {
            originalImage = img;
            originalWidth = img.width;
            originalHeight = img.height;
            imageToCrop.src = dataUrl;
            imageToCrop.onload = function() {
                calculateImageOffset();
                // Cargar patrones guardados
                const pattern = pagePatterns[index] || [];
                clearBoxes();
                if (pattern.length) {
                    pattern.forEach(box => addCropBox(box.x, box.y, box.w, box.h));
                } else if (index === 0 && Object.keys(pagePatterns).length === 0) {
                    // Crear cuadrícula por defecto si es la primera página y no hay patrones
                    const cols = 2, rows = 3;
                    const cellW = Math.floor(originalWidth / cols);
                    const cellH = Math.floor(originalHeight / rows);
                    const margin = Math.min(15, Math.floor(Math.min(cellW, cellH) * 0.1));
                    for (let r = 0; r < rows; r++) {
                        for (let c = 0; c < cols; c++) {
                            addCropBox(c * cellW + margin, r * cellH + margin, cellW - 2*margin, cellH - 2*margin);
                        }
                    }
                    // Guardar patrón en la primera página automáticamente
                    if (cropBoxes.length) {
                        pagePatterns[0] = getPattern();
                    }
                }
                if (pageCounter) {
                    pageCounter.textContent = `Página ${index+1} de ${allPagesData.length}`;
                }
                prevPageBtn.disabled = index === 0;
                nextPageBtn.disabled = index === allPagesData.length - 1;
                updateCropBoxesVisual();
            };
        };
        img.src = dataUrl;
    }

    // ============ GUARDAR PATRÓN ============
    function saveCurrentPattern() {
        if (cropBoxes.length === 0) {
            window.showNotification('No hay recuadros para guardar.', true);
            return;
        }
        pagePatterns[currentPageIndex] = getPattern();
        window.showNotification(`Patrón guardado para página ${currentPageIndex+1}`);
        savePatternBtn.style.background = '#2ecc71';
        setTimeout(() => { savePatternBtn.style.background = ''; }, 500);
    }

    // ============ PROCESAR CON PATRÓN ============
    function processWithPattern() {
        // Guardar patrón actual
        if (cropBoxes.length > 0) {
            pagePatterns[currentPageIndex] = getPattern();
        }
        // Verificar que haya patrones
        const hasPattern = Object.values(pagePatterns).some(arr => arr && arr.length > 0);
        if (!hasPattern) {
            window.showNotification('No hay patrones guardados. Ajusta recuadros y guarda al menos uno.', true);
            return;
        }
        // Guardar patrones en el estado global de la pestaña auto
        window.autoPagePatterns = pagePatterns;
        window.autoPagesData = allPagesData;
        window.showNotification(`Patrones listos (${Object.keys(pagePatterns).length} páginas). Ahora procesa con "Procesar".`);
        // Cerrar el editor automáticamente
        closeEditor();
    }

    // ============ CERRAR EDITOR ============
    function closeEditor() {
        const section = document.getElementById('autoCropSection');
        if (section) section.style.display = 'none';
        // Restaurar el contenido normal de la pestaña auto
        const cards = document.querySelectorAll('#tab-auto .card:not(#autoCropSection)');
        cards.forEach(c => c.style.display = '');
        document.getElementById('autoResults').style.display = '';
    }

    // ============ BOTONES ============
    if (addBoxBtn) {
        addBoxBtn.addEventListener('click', function() {
            if (!originalWidth || !originalHeight) {
                window.showNotification('Primero carga un PDF o imagen.', true);
                return;
            }
            let w, h;
            if (cropBoxes.length > 0) {
                const last = cropBoxes[cropBoxes.length - 1];
                w = last.w; h = last.h;
            } else {
                const cols = 2, rows = 3;
                const cellW = Math.floor(originalWidth / cols);
                const cellH = Math.floor(originalHeight / rows);
                const margin = Math.min(15, Math.floor(Math.min(cellW, cellH) * 0.1));
                w = cellW - 2 * margin; h = cellH - 2 * margin;
            }
            const x = Math.floor((originalWidth - w) / 2);
            const y = Math.floor((originalHeight - h) / 2);
            addCropBox(x, y, w, h);
            window.showNotification('Recuadro añadido.');
        });
    }

    if (snapBtn) {
        snapBtn.addEventListener('click', function() {
            cropBoxes.forEach(box => applySnapToBox(box));
            updateCropBoxesVisual();
            window.showNotification('Recuadros alineados a la cuadrícula.');
        });
    }

    if (savePatternBtn) {
        savePatternBtn.addEventListener('click', saveCurrentPattern);
    }

    if (processBtn) {
        processBtn.addEventListener('click', processWithPattern);
    }

    if (clearBoxesBtn) {
        clearBoxesBtn.addEventListener('click', function() {
            if (cropBoxes.length === 0) return;
            if (confirm('¿Eliminar todos los recuadros de esta página?')) {
                clearBoxes();
                window.showNotification('Recuadros eliminados.');
            }
        });
    }

    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', function() {
            if (currentPageIndex > 0) {
                if (cropBoxes.length > 0) {
                    pagePatterns[currentPageIndex] = getPattern();
                }
                loadPage(currentPageIndex - 1);
            }
        });
    }

    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', function() {
            if (currentPageIndex < allPagesData.length - 1) {
                if (cropBoxes.length > 0) {
                    pagePatterns[currentPageIndex] = getPattern();
                }
                loadPage(currentPageIndex + 1);
            }
        });
    }

    if (closeEditorBtn) {
        closeEditorBtn.addEventListener('click', closeEditor);
    }

    // ============ TOGGLE DE CUADRÍCULA ============
    if (gridToggle) {
        gridToggle.addEventListener('change', function() {
            updateGrid();
        });
        // Por defecto, activar la cuadrícula al abrir el editor
        gridToggle.checked = true;
    }

    if (gridDivisionsSelect) {
        gridDivisionsSelect.addEventListener('change', function() {
            gridDivisions = parseInt(this.value) || 10;
            updateGrid();
        });
    }

    // ============ FUNCIÓN PÚBLICA PARA CARGAR PDF ============
    window.loadAutoPdfForCrop = function(pagesData) {
        if (!pagesData || !pagesData.length) {
            window.showNotification('No se recibieron páginas.', true);
            return;
        }
        allPagesData = pagesData;
        pagePatterns = {};
        currentPageIndex = 0;
        // Mostrar el editor y ocultar el resto de la pestaña auto
        const section = document.getElementById('autoCropSection');
        if (section) {
            section.style.display = 'block';
            // Ocultar otros elementos de la pestaña auto (el card de subida y resultados)
            const cards = document.querySelectorAll('#tab-auto .card:not(#autoCropSection)');
            cards.forEach(c => c.style.display = 'none');
            // Mostrar el editor
            loadPage(0);
        }
        // Actualizar contador de páginas
        if (pageCounter) {
            pageCounter.textContent = `Página 1 de ${allPagesData.length}`;
        }
        prevPageBtn.disabled = true;
        nextPageBtn.disabled = allPagesData.length <= 1;

        // 🔥 ACTIVAR LA CUADRÍCULA POR DEFECTO
        if (gridToggle) gridToggle.checked = true;
        updateGrid();

        window.showNotification(`PDF cargado. ${allPagesData.length} páginas listas.`);
    };

    // ============ INICIALIZAR ============
    // Ocultar el editor al inicio
    const section = document.getElementById('autoCropSection');
    if (section) section.style.display = 'none';
    // Configurar cuadrícula por defecto
    gridDivisions = parseInt(gridDivisionsSelect ? gridDivisionsSelect.value : 10) || 10;

})();
