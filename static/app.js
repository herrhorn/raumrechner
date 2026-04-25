// app.js - handles PDF rendering, drawing overlay, calibration, and area calculation

// PDF.js: workerSrc must point to pdf.worker.js that we copied into static/vendor/pdfjs
if (window['pdfjsLib']) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdfjs/build/pdf.worker.js';
}

// Collapsible sidebar cards
document.querySelectorAll('.card-header').forEach(header => {
  header.addEventListener('click', () => {
    header.parentElement.classList.toggle('collapsed');
  });
});

const fileInput = document.getElementById('fileInput');
const canvas = document.getElementById('pdfCanvas');
const overlay = document.getElementById('overlay');
const ctx = canvas.getContext('2d');
const startCal = document.getElementById('startCal');
const calInfo = document.getElementById('calInfo');
const drawPolyBtn = document.getElementById('drawPoly');
const finishPolyBtn = document.getElementById('finishPoly');
const polygonList = document.getElementById('polygonList');
const currentPolyName = document.getElementById('currentPolyName');
const exportPdfBtn = document.getElementById('exportPdf');
const saveProjectBtn = document.getElementById('saveProject');
const loadProjectInput = document.getElementById('loadProject');
const zoomInBtn = document.getElementById('zoomIn');
const zoomOutBtn = document.getElementById('zoomOut');
const zoomResetBtn = document.getElementById('zoomReset');
const zoomLevelSpan = document.getElementById('zoomLevel');

let pdfDoc = null;
let scale = 1; // render scale for PDF.js
let fitScale = 1; // scale that fits the container width
const MIN_SCALE = 0.1;
const MAX_SCALE = 5.0;
const SCALE_STEP = 0.25;
let pageWidthPx = 0; // width of canvas in pixels
let pageHeightPx = 0;
let currentPdfFilename = null; // Track current PDF filename for project saving

// Calibration state
let calibrationMode = false;
let calPoints = []; // two pixel points
let pxPerMeter = null; // pixels per meter

// Multi-polygon state
let polygons = []; // Array of {id, name, points, area, color, visible}
let currentPolygonId = null;
let nextPolygonId = 1;

// Drawing state
let drawingMode = false;
let currentPolygon = [];
let draggedPointIndex = null; // Index of the point being dragged
let draggedPolygonId = null; // ID of polygon being dragged

function resetOverlaySize(){
  overlay.setAttribute('width', canvas.width);
  overlay.setAttribute('height', canvas.height);
  overlay.setAttribute('viewBox', `0 0 ${canvas.width} ${canvas.height}`);
  overlay.style.width = canvas.width + 'px';
  overlay.style.height = canvas.height + 'px';
}

function renderPage(pdf, pageNum=1){
  pdf.getPage(pageNum).then(function(page){
    const viewport = page.getViewport({scale});
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    pageWidthPx = viewport.width;
    pageHeightPx = viewport.height;
    const renderContext = {canvasContext: ctx, viewport};
    page.render(renderContext).promise.then(()=>{
      resetOverlaySize();
      renderAllPolygons();
      updatePolygonList();
      updateZoomDisplay();
    });
  });
}

function updateZoomDisplay() {
  zoomLevelSpan.textContent = Math.round(scale * 100) + '%';
}

function loadPdfFromUrl(url){
  pdfjsLib.getDocument({url}).promise.then(function(pdf){
    pdfDoc = pdf;
    pdf.getPage(1).then(function(page){
      const baseVp = page.getViewport({scale: 1});
      const containerWidth = (pdfContainer.clientWidth || 800) - 4;
      const containerHeight = (pdfContainer.clientHeight || 600) - 4;
      fitScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE,
        Math.min(containerWidth / baseVp.width, containerHeight / baseVp.height)
      ));
      scale = fitScale;
      renderPage(pdfDoc, 1);
    });
  });
}

fileInput.addEventListener('change', (e) => {
  const f = e.target.files[0];
  if (!f) return;
  currentPdfFilename = f.name;
  loadPdfFromUrl(URL.createObjectURL(f));
});

// Calibration: click two points on the overlay to define real-world distance
startCal.addEventListener('click', ()=>{
  calibrationMode = true;
  calPoints = [];
  calInfo.textContent = 'Kalibrierung: Bitte 2 Punkte auf dem Grundriss klicken';
});

overlay.addEventListener('click', (ev)=>{
  const rect = canvas.getBoundingClientRect();
  const x = (ev.clientX - rect.left) * (canvas.width / rect.width);
  const y = (ev.clientY - rect.top) * (canvas.height / rect.height);

  if(calibrationMode){
    calPoints.push({x,y});
    drawCalibrationPoint(x,y);
    if(calPoints.length === 2){
      const dx = calPoints[0].x - calPoints[1].x;
      const dy = calPoints[0].y - calPoints[1].y;
      const distPx = Math.sqrt(dx*dx + dy*dy);
      const meters = parseFloat(prompt('Gib reale Länge der Linie in Metern ein (z.B. 5)'));
      if(isNaN(meters) || meters <= 0){
        alert('Ungültige Eingabe. Restart Kalibrierung.');
        calibrationMode = false;
        calInfo.textContent = 'Keine Kalibrierung';
        return;
      }
      pxPerMeter = distPx / meters;
      calibrationMode = false;
      calInfo.textContent = `Kalibrierung: ${pxPerMeter.toFixed(2)} px/m`;
      removeCalibrationPoints();
      
      // Recalculate all polygon areas with new calibration
      recalculateAllAreas();
    }
    return;
  }

  if(drawingMode){
    // add point to polygon (in pixel coordinates relative to canvas)
    currentPolygon.push({x,y});
    renderAllPolygons();
  }
});

// Handle dragging of polygon points
overlay.addEventListener('mousemove', (ev)=>{
  if(draggedPointIndex === null || draggedPolygonId === null) return;
  
  const rect = canvas.getBoundingClientRect();
  const x = (ev.clientX - rect.left) * (canvas.width / rect.width);
  const y = (ev.clientY - rect.top) * (canvas.height / rect.height);
  
  // Update the point position in the polygon
  const poly = polygons.find(p => p.id === draggedPolygonId);
  if(poly && poly.points[draggedPointIndex]) {
    poly.points[draggedPointIndex] = {x, y};
    renderAllPolygons();
  }
});

overlay.addEventListener('mouseup', ()=>{
  if(draggedPointIndex !== null && draggedPolygonId !== null){
    // Recalculate area for the dragged polygon
    const poly = polygons.find(p => p.id === draggedPolygonId);
    if(poly) {
      poly.area = computeAreaForPoints(poly.points);
      updatePolygonList();
    }
    
    draggedPointIndex = null;
    draggedPolygonId = null;
    
    // Reset all point cursors
    overlay.querySelectorAll('.polypoint').forEach(pt => {
      pt.style.cursor = 'grab';
    });
  }
});

// Also handle mouse leaving the overlay
overlay.addEventListener('mouseleave', ()=>{
  if(draggedPointIndex !== null){
    draggedPointIndex = null;
    draggedPolygonId = null;
    // Reset all point cursors
    overlay.querySelectorAll('.polypoint').forEach(pt => {
      pt.style.cursor = 'grab';
    });
  }
});

function drawCalibrationPoint(x,y){
  const c = document.createElementNS('http://www.w3.org/2000/svg','circle');
  c.setAttribute('cx', x);
  c.setAttribute('cy', y);
  c.setAttribute('r', 6);
  c.setAttribute('fill', 'red');
  c.setAttribute('class', 'calpoint');
  overlay.appendChild(c);
}

function removeCalibrationPoints(){
  const pts = overlay.querySelectorAll('.calpoint');
  pts.forEach(p=>p.remove());
}

// Polygon color palette
const COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
  '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B88B', '#ABEBC6'
];

function getNextColor() {
  return COLORS[polygons.length % COLORS.length];
}

// Drawing controls
drawPolyBtn.addEventListener('click', ()=>{
  const name = prompt('Name für das neue Polygon:', `Polygon ${nextPolygonId}`);
  if(!name) return;
  
  drawingMode = true;
  currentPolygon = [];
  currentPolygonId = nextPolygonId++;
  currentPolyName.textContent = `Zeichne: ${name}`;
  
  // Create new polygon entry
  polygons.push({
    id: currentPolygonId,
    name: name,
    points: [],
    area: null,
    color: getNextColor(),
    visible: true,
    workplaces: 0
  });
  
  clearOverlayDrawings();
  renderAllPolygons();
});

finishPolyBtn.addEventListener('click', ()=>{
  if(!drawingMode || currentPolygon.length < 3) {
    alert('Polygon benötigt mindestens 3 Punkte');
    return;
  }
  
  drawingMode = false;
  
  // Save polygon
  const poly = polygons.find(p => p.id === currentPolygonId);
  if(poly) {
    poly.points = [...currentPolygon];
    poly.area = computeAreaForPoints(currentPolygon);
  }
  
  currentPolygon = [];
  currentPolygonId = null;
  currentPolyName.textContent = '';
  
  renderAllPolygons();
  updatePolygonList();
});



function computeAreaForPoints(pts){
  if(pts.length < 3) return null;
  
  // Shoelace formula for polygon area in pixel^2
  let areaPx = 0;
  for(let i=0;i<pts.length;i++){
    const j = (i+1)%pts.length;
    areaPx += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  areaPx = Math.abs(areaPx) / 2.0;

  if(!pxPerMeter) return null;

  // Convert pixel area to square meters: area_m2 = area_px / (pxPerMeter^2)
  return areaPx / (pxPerMeter * pxPerMeter);
}

function recalculateAllAreas(){
  // Recalculate area for all polygons with the current calibration
  polygons.forEach(poly => {
    if(poly.points.length >= 3) {
      poly.area = computeAreaForPoints(poly.points);
    }
  });
  updatePolygonList();
}

// Multi-Polygon rendering and management
function clearOverlayDrawings(){
  overlay.innerHTML = '';
}

function renderAllPolygons(){
  clearOverlayDrawings();
  
  // Render saved polygons
  polygons.forEach(poly => {
    if(!poly.visible || poly.points.length === 0) return;
    
    // Draw polygon shape
    const shape = document.createElementNS('http://www.w3.org/2000/svg','polygon');
    const points = poly.points.map(p=>`${p.x},${p.y}`).join(' ');
    shape.setAttribute('points', points);
    shape.setAttribute('fill', poly.color + '40'); // Add transparency
    shape.setAttribute('stroke', poly.color);
    shape.setAttribute('stroke-width', 2);
    shape.setAttribute('data-poly-id', poly.id);
    shape.style.pointerEvents = 'none';
    overlay.appendChild(shape);
    
    // Draw vertex points
    poly.points.forEach((pt, idx) => {
      const circle = document.createElementNS('http://www.w3.org/2000/svg','circle');
      circle.setAttribute('cx', pt.x);
      circle.setAttribute('cy', pt.y);
      circle.setAttribute('r', 6);
      circle.setAttribute('fill', poly.color);
      circle.setAttribute('stroke', 'white');
      circle.setAttribute('stroke-width', 2);
      circle.setAttribute('class', 'polypoint');
      circle.setAttribute('data-poly-id', poly.id);
      circle.setAttribute('data-point-idx', idx);
      circle.style.pointerEvents = 'auto';
      circle.style.cursor = 'grab';
      
      // Hover effects
      circle.addEventListener('mouseenter', () => {
        if(draggedPointIndex === null) {
          circle.setAttribute('r', 8);
          circle.setAttribute('stroke-width', 2.5);
        }
      });
      
      circle.addEventListener('mouseleave', () => {
        if(draggedPointIndex === null) {
          circle.setAttribute('r', 6);
          circle.setAttribute('stroke-width', 2);
        }
      });
      
      // Dragging
      circle.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        draggedPointIndex = idx;
        draggedPolygonId = poly.id;
        circle.style.cursor = 'grabbing';
      });
      
      overlay.appendChild(circle);
    });
  });
  
  // Render current polygon being drawn
  if(drawingMode && currentPolygon.length > 0) {
    redrawCurrentPolygon();
  }
}

function redrawCurrentPolygon(){
  // Don't clear all - just update current drawing
  const existing = overlay.querySelector('.current-drawing');
  if(existing) existing.remove();
  const existingPoints = overlay.querySelectorAll('.current-point');
  existingPoints.forEach(p => p.remove());
  
  const color = polygons.find(p => p.id === currentPolygonId)?.color || '#0066cc';
  
  if(currentPolygon.length >= 2) {
    const shape = document.createElementNS('http://www.w3.org/2000/svg','polygon');
    const points = currentPolygon.map(p=>`${p.x},${p.y}`).join(' ');
    shape.setAttribute('points', points);
    shape.setAttribute('fill', color + '40');
    shape.setAttribute('stroke', color);
    shape.setAttribute('stroke-width', 3);
    shape.setAttribute('class', 'current-drawing');
    shape.style.pointerEvents = 'none';
    overlay.appendChild(shape);
  }
  
  currentPolygon.forEach((pt, idx) => {
    const circle = document.createElementNS('http://www.w3.org/2000/svg','circle');
    circle.setAttribute('cx', pt.x);
    circle.setAttribute('cy', pt.y);
    circle.setAttribute('r', 7);
    circle.setAttribute('fill', '#ff6b00');
    circle.setAttribute('stroke', 'white');
    circle.setAttribute('stroke-width', 2.5);
    circle.setAttribute('class', 'current-point');
    circle.style.pointerEvents = 'none';
    overlay.appendChild(circle);
  });
}

function updatePolygonList(){
  polygonList.innerHTML = '';
  
  if(polygons.length === 0) {
    polygonList.innerHTML = '<div style="color:#999;font-size:13px">Keine Polygone</div>';
    return;
  }
  
  polygons.forEach(poly => {
    const item = document.createElement('div');
    item.className = 'polygon-item';
    if(!poly.visible) item.style.opacity = '0.5';
    
    const areaText = poly.area !== null ? `${poly.area.toFixed(2)} m²` : 'Nicht kalibriert';
    const workplaces = poly.workplaces || 0;
    
    item.innerHTML = `
      <div class="polygon-item-header">
        <div class="polygon-item-name" style="color:${poly.color}">${poly.name}</div>
        <div class="polygon-item-actions">
          <button class="btn-rename" title="Umbenennen">✏️</button>
          <button class="btn-delete" title="Löschen">🗑️</button>
        </div>
      </div>
      <div class="polygon-item-area">${areaText}</div>
      <div class="polygon-item-workplaces" style="margin-top:5px;display:flex;align-items:center;gap:8px;font-size:13px">
        <label style="color:#666">Arbeitsplätze:</label>
        <input type="number" class="workplaces-input" value="${workplaces}" min="0" style="width:60px;padding:2px 5px;border:1px solid #ddd;border-radius:3px" />
      </div>
    `;
    
    // Click to select/deselect
    item.addEventListener('click', (e) => {
      if(e.target.closest('.polygon-item-actions')) return;
      poly.visible = !poly.visible;
      renderAllPolygons();
      updatePolygonList();
    });
    
    // Rename
    item.querySelector('.btn-rename').addEventListener('click', (e) => {
      e.stopPropagation();
      const newName = prompt('Neuer Name:', poly.name);
      if(newName) {
        poly.name = newName;
        updatePolygonList();
      }
    });
    
    // Delete
    item.querySelector('.btn-delete').addEventListener('click', (e) => {
      e.stopPropagation();
      if(confirm(`"${poly.name}" löschen?`)) {
        polygons = polygons.filter(p => p.id !== poly.id);
        renderAllPolygons();
        updatePolygonList();
      }
    });
    
    // Workplaces input
    const workplacesInput = item.querySelector('.workplaces-input');
    workplacesInput.addEventListener('click', (e) => {
      e.stopPropagation();
    });
    workplacesInput.addEventListener('change', (e) => {
      const value = parseInt(e.target.value) || 0;
      poly.workplaces = Math.max(0, value);
      e.target.value = poly.workplaces;
    });
    
    polygonList.appendChild(item);
  });
  
  // Add total summary
  if(polygons.length > 0) {
    const totalWorkplaces = polygons.reduce((sum, p) => sum + (p.workplaces || 0), 0);
    const totalArea = polygons
      .filter(p => p.visible && p.area !== null)
      .reduce((sum, p) => sum + p.area, 0);
    
    const summary = document.createElement('div');
    summary.style.cssText = 'margin-top:15px;padding-top:15px;border-top:2px solid #e0e0e0;font-weight:bold;font-size:14px';
    summary.innerHTML = `
      <div style="margin-bottom:5px">Gesamt:</div>
      ${pxPerMeter && totalArea > 0 ? `<div style="color:#666;font-size:13px;margin-bottom:3px">Fläche: ${totalArea.toFixed(2)} m²</div>` : ''}
      ${totalWorkplaces > 0 ? `<div style="color:#666;font-size:13px">Arbeitsplätze: ${totalWorkplaces}</div>` : ''}
    `;
    polygonList.appendChild(summary);
  }
}

// Project Save/Load functionality
saveProjectBtn.addEventListener('click', () => {
  if(!pdfDoc) {
    alert('Bitte lade zuerst einen Grundriss');
    return;
  }
  
  const projectData = {
    version: '1.0',
    pdfFilename: currentPdfFilename,
    calibration: pxPerMeter,
    polygons: polygons.map(p => ({
      id: p.id,
      name: p.name,
      points: p.points,
      area: p.area,
      color: p.color,
      visible: p.visible,
      workplaces: p.workplaces || 0
    })),
    timestamp: new Date().toISOString()
  };
  
  const dataStr = JSON.stringify(projectData, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  const projectName = currentPdfFilename ? currentPdfFilename.replace('.pdf', '') : 'projekt';
  a.download = `${projectName}-projekt.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

loadProjectInput.addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if(!f) return;
  
  try {
    const text = await f.text();
    const projectData = JSON.parse(text);
    
    // Validate project data
    if(!projectData.version || !projectData.polygons) {
      alert('Ungültige Projekt-Datei');
      return;
    }
    
    // Ask user to upload the PDF
    const pdfName = projectData.pdfFilename || 'das PDF';
    const loadPdf = confirm(`Projekt geladen. Bitte lade jetzt die zugehörige PDF-Datei "${pdfName}" hoch.\n\nKlicke OK und wähle dann die PDF-Datei aus.`);
    
    if(!loadPdf) return;
    
    // Store project data temporarily
    window.pendingProject = projectData;
    
    // Trigger PDF file input
    fileInput.click();
    
  } catch(err) {
    alert('Fehler beim Laden der Projekt-Datei: ' + err.message);
  }
  
  // Reset input
  e.target.value = '';
});

// Hook into PDF loading to restore project data
const originalLoadPdfFromUrl = loadPdfFromUrl;
loadPdfFromUrl = function(url) {
  originalLoadPdfFromUrl(url);
  
  // Check if there's a pending project to restore
  if(window.pendingProject) {
    // Wait for PDF to render, then restore project
    setTimeout(() => {
      const projectData = window.pendingProject;
      
      // Restore calibration
      pxPerMeter = projectData.calibration;
      if(pxPerMeter) {
        calInfo.textContent = `Kalibrierung: ${pxPerMeter.toFixed(2)} px/m`;
      }
      
      // Restore polygons
      polygons = projectData.polygons || [];
      nextPolygonId = Math.max(...polygons.map(p => p.id), 0) + 1;
      
      // Re-render
      renderAllPolygons();
      updatePolygonList();
      
      // Clear pending project
      delete window.pendingProject;
      
      alert('Projekt erfolgreich geladen!');
    }, 500);
  }
};

// PDF Export functionality
exportPdfBtn.addEventListener('click', async () => {
  if(!pdfDoc) {
    alert('Bitte lade zuerst einen Grundriss');
    return;
  }
  
  if(polygons.length === 0) {
    alert('Keine Polygone zum Exportieren vorhanden');
    return;
  }
  
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({
    orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4'
  });
  
  // PDF dimensions in mm
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();
  const margin = 10; // mm
  
  // Calculate required space for the list
  const visiblePolygons = polygons.filter(p => p.visible);
  const lineHeight = 5;
  const headerHeight = 14; // Header "Polygone und Flächen:"
  const titleSpacing = 7;
  const totalLineSpacing = 3; // Space before total
  const totalLineHeight = 6; // Total line height
  
  // Calculate minimum list height needed
  const minListHeight = headerHeight + titleSpacing + 
                        (visiblePolygons.length * lineHeight) + 
                        (pxPerMeter ? totalLineSpacing + totalLineHeight : 0);
  
  // Reserve space for list (minimum 25mm, maximum 60mm)
  const listHeight = Math.min(Math.max(minListHeight + 10, 25), 60);
  
  const availableWidth = pdfWidth - (2 * margin);
  const availableHeight = pdfHeight - listHeight - (2 * margin);
  
  // Calculate scaling to fit the canvas in available space
  const scaleX = availableWidth / canvas.width;
  const scaleY = availableHeight / canvas.height;
  const scale = Math.min(scaleX, scaleY);
  
  const imgWidth = canvas.width * scale;
  const imgHeight = canvas.height * scale;
  
  // Center the image
  const xOffset = margin + (availableWidth - imgWidth) / 2;
  const yOffset = margin;
  
  // Create a temporary canvas to combine floor plan and polygons
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = canvas.width;
  tempCanvas.height = canvas.height;
  const tempCtx = tempCanvas.getContext('2d');
  
  // Draw the floor plan
  tempCtx.drawImage(canvas, 0, 0);
  
  // Draw polygons with labels
  polygons.forEach(poly => {
    if(!poly.visible || poly.points.length < 3) return;
    
    // Draw polygon
    tempCtx.beginPath();
    tempCtx.moveTo(poly.points[0].x, poly.points[0].y);
    for(let i = 1; i < poly.points.length; i++) {
      tempCtx.lineTo(poly.points[i].x, poly.points[i].y);
    }
    tempCtx.closePath();
    
    // Fill with transparency
    tempCtx.fillStyle = poly.color + '40';
    tempCtx.fill();
    
    // Stroke
    tempCtx.strokeStyle = poly.color;
    tempCtx.lineWidth = 3;
    tempCtx.stroke();
    
    // Calculate centroid for label placement
    let centroidX = 0, centroidY = 0;
    poly.points.forEach(pt => {
      centroidX += pt.x;
      centroidY += pt.y;
    });
    centroidX /= poly.points.length;
    centroidY /= poly.points.length;
    
    // Draw label (name)
    tempCtx.font = 'bold 20px Arial';
    tempCtx.textAlign = 'center';
    tempCtx.textBaseline = 'middle';
    
    // Draw text background
    const textMetrics = tempCtx.measureText(poly.name);
    const textWidth = textMetrics.width;
    const textHeight = 24;
    tempCtx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    tempCtx.fillRect(
      centroidX - textWidth / 2 - 5,
      centroidY - textHeight / 2,
      textWidth + 10,
      textHeight
    );
    
    // Draw text
    tempCtx.fillStyle = poly.color;
    tempCtx.fillText(poly.name, centroidX, centroidY);
  });
  
  // Add the combined image to PDF
  const imgData = tempCanvas.toDataURL('image/jpeg', 0.95);
  pdf.addImage(imgData, 'JPEG', xOffset, yOffset, imgWidth, imgHeight);
  
  // Add polygon list
  let listY = yOffset + imgHeight + 15;
  pdf.setFontSize(14);
  pdf.setFont(undefined, 'bold');
  pdf.text('Polygone und Flächen:', margin, listY);
  
  pdf.setFontSize(10);
  pdf.setFont(undefined, 'normal');
  
  let currentY = listY + titleSpacing;
  const maxYOnFirstPage = pdfHeight - margin;
  
  let polyIndex = 1;
  visiblePolygons.forEach((poly, index) => {
    // Check if we need a new page
    if(currentY + lineHeight > maxYOnFirstPage) {
      // Add new page
      pdf.addPage();
      currentY = margin + 10; // Start position on new page
      
      // Add header on new page
      pdf.setFontSize(14);
      pdf.setFont(undefined, 'bold');
      pdf.text('Polygone und Flächen (Fortsetzung):', margin, margin);
      pdf.setFontSize(10);
      pdf.setFont(undefined, 'normal');
      currentY = margin + 17;
    }
    
    const areaText = poly.area !== null ? `${poly.area.toFixed(2)} m²` : 'Nicht kalibriert';
    const workplacesText = (poly.workplaces && poly.workplaces > 0) ? ` | ${poly.workplaces} AP` : '';
    const text = `${polyIndex}. ${poly.name}: ${areaText}${workplacesText}`;
    
    // Draw colored square indicator
    pdf.setFillColor(poly.color);
    pdf.rect(margin, currentY - 3, 3, 3, 'F');
    
    pdf.text(text, margin + 5, currentY);
    currentY += lineHeight;
    polyIndex++;
  });
  
  // Add totals if available
  const totalArea = visiblePolygons
    .filter(p => p.area !== null)
    .reduce((sum, p) => sum + p.area, 0);
  const totalWorkplaces = visiblePolygons
    .reduce((sum, p) => sum + (p.workplaces || 0), 0);
  
  if(pxPerMeter || totalWorkplaces > 0) {
    // Check if total lines fit on current page
    const neededLines = (pxPerMeter ? 1 : 0) + (totalWorkplaces > 0 ? 1 : 0);
    const neededSpace = totalLineSpacing + (neededLines * 6);
    
    if(currentY + neededSpace > maxYOnFirstPage) {
      pdf.addPage();
      currentY = margin + 10;
    } else {
      currentY += totalLineSpacing;
    }
    
    pdf.setFont(undefined, 'bold');
    
    if(pxPerMeter && totalArea > 0) {
      pdf.text(`Gesamtfläche: ${totalArea.toFixed(2)} m²`, margin, currentY);
      currentY += 6;
    }
    
    if(totalWorkplaces > 0) {
      pdf.text(`Gesamt Arbeitsplätze: ${totalWorkplaces}`, margin, currentY);
    }
  }
  
  // Save the PDF
  pdf.save('grundriss-export.pdf');
});

// Basic helper to fetch example local file if needed
window.loadPdfFromUrl = loadPdfFromUrl; // expose for debugging

// Scale all stored pixel coordinates when zoom level changes
function scalePoints(ratio) {
  if(ratio === 1) return;
  polygons.forEach(poly => {
    poly.points = poly.points.map(pt => ({x: pt.x * ratio, y: pt.y * ratio}));
  });
  currentPolygon = currentPolygon.map(pt => ({x: pt.x * ratio, y: pt.y * ratio}));
  // pxPerMeter is also in canvas-pixel units, must scale with everything else
  if(pxPerMeter) {
    pxPerMeter *= ratio;
  }
}

// Zoom functionality
zoomInBtn.addEventListener('click', () => {
  if(!pdfDoc) return;
  const newScale = Math.min(scale + SCALE_STEP, MAX_SCALE);
  scalePoints(newScale / scale);
  scale = newScale;
  renderPage(pdfDoc, 1);
});

zoomOutBtn.addEventListener('click', () => {
  if(!pdfDoc) return;
  const newScale = Math.max(scale - SCALE_STEP, MIN_SCALE);
  scalePoints(newScale / scale);
  scale = newScale;
  renderPage(pdfDoc, 1);
});

zoomResetBtn.addEventListener('click', () => {
  if(!pdfDoc) return;
  scalePoints(fitScale / scale);
  scale = fitScale;
  renderPage(pdfDoc, 1);
});

// Mousewheel zoom support
const pdfContainer = document.getElementById('pdfContainer');
pdfContainer.addEventListener('wheel', (e) => {
  if(!pdfDoc) return;

  // Check if Ctrl/Cmd key is pressed for zoom
  if(e.ctrlKey || e.metaKey) {
    e.preventDefault();

    const delta = e.deltaY > 0 ? -SCALE_STEP : SCALE_STEP;
    const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale + delta));
    scalePoints(newScale / scale);
    scale = newScale;
    renderPage(pdfDoc, 1);
  }
}, { passive: false });

// Responsive: if window resizes, we should keep canvas visible size; we render at native pixel sizes from PDF.js
window.addEventListener('resize', ()=>{
  // nothing complex here; PDF.js would need re-render for different scale; we keep current rendering
});
