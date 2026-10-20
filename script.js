document.addEventListener("DOMContentLoaded", async () => {
  // --- INICIO: VERIFICACIÓN DE SESIÓN ---
  const isLoggedIn = sessionStorage.getItem("isLoggedIn");
  const usuarioActivo = sessionStorage.getItem("usuarioActivo");

  if (!isLoggedIn || isLoggedIn !== "true") {
    window.location.href = "login.html";
    return; 
  }
  // --- FIN: VERIFICACIÓN DE SESIÓN ---

  const DB_NAME = "cml_db";
  const DB_VERSION = 3;
  const STORE_PREFIX = "expedientes";
  const DOCUMENTS_STORE_PREFIX = "documentos";

  const MODULES = {
    'ingreso': 'Ingreso',
    'contralor': 'Contralor Municipal',
    'direccion-general': 'Dirección General',
    'auditoria': 'Auditoría Interna',
    'despacho': 'Dirección de Despacho',
    'juridica': 'Consultoría Jurídica',
    'talento': 'Dirección de Talento Humano',
    'finanzas': 'Dirección de Administración y Finanzas',
    'relaciones': 'Dirección de Relaciones Institucionales y Corporativas',
    'atencion': 'Dirección General de Atención al Ciudadano y Control Social',
    'obras': 'Dirección de Control de Obras y Servicios Públicos',
    'investigativa': 'Dirección de Potestad Investigativa',
    'responsabilidades': 'Dirección de Determinación de Responsabilidades',
    'control-local': 'Dirección de Control del Poder Público Municipal y demás Entidades Locales'
  };

  let db;
  let activeModuleId = 'ingreso';
  let expedientes = [];
  let documentos = [];
  let editingId = null;
  let contextTargetId = null;
  let currentExpedienteId = null;
  let filesToUpload = [];

  const mainContent = document.getElementById("main-content");
  const modalOverlay = document.getElementById("modal-overlay");
  const scanModalOverlay = document.getElementById("scan-modal-overlay");
  const viewModalOverlay = document.getElementById("view-modal-overlay");
  const contextMenu = document.getElementById("context-menu");

  const cedulaInput = document.getElementById("cedula-input");
  const nombreInput = document.getElementById("nombre-input");
  const cargoInput = document.getElementById("cargo-input");
  const fechaInput = document.getElementById("fecha-input");
  const estatusInput = document.getElementById("estatus-input");
  const modalOk = document.getElementById("modal-ok");
  const modalCancel = document.getElementById("modal-cancel");

  const dropArea = document.getElementById("drop-area");
  const fileInput = document.getElementById("file-input");
  const selectFilesBtn = document.getElementById("select-files-btn");
  const previewArea = document.getElementById("preview-area");
  const previewContainer = document.getElementById("preview-container");
  const documentNameInput = document.getElementById("document-name");
  const scanModalSave = document.getElementById("scan-modal-save");
  const scanModalCancel = document.getElementById("scan-modal-cancel");

  const viewModalClose = document.getElementById("view-modal-close");
  const documentViewImage = document.getElementById("document-view-image");
  const viewModalTitle = document.getElementById("view-modal-title");

  try {
    db = await initDatabase();
    setupEventListeners();
    switchModule(activeModuleId);
  } catch (error) {
    console.error("Error al inicializar la aplicación:", error);
    alert("No se pudo inicializar el sistema. Por favor, recarga la página.");
  }

  async function initDatabase() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        console.log("Actualizando base de datos a versión:", DB_VERSION);
        
        const oldStoreNames = ['expedientes', 'documentos'];
        oldStoreNames.forEach(name => {
          if (db.objectStoreNames.contains(name)) {
            console.log("Eliminando store antiguo:", name);
            db.deleteObjectStore(name);
          }
        });

        Object.keys(MODULES).forEach(moduleId => {
          const expedientesStoreName = `${STORE_PREFIX}_${moduleId}`;
          const documentosStoreName = `${DOCUMENTS_STORE_PREFIX}_${moduleId}`;
          
          console.log("Verificando store:", expedientesStoreName);
          if (!db.objectStoreNames.contains(expedientesStoreName)) {
            console.log("Creando store:", expedientesStoreName);
            db.createObjectStore(expedientesStoreName, { keyPath: "id" });
          }
          
          console.log("Verificando store:", documentosStoreName);
          if (!db.objectStoreNames.contains(documentosStoreName)) {
            console.log("Creando store:", documentosStoreName);
            const store = db.createObjectStore(documentosStoreName, { keyPath: "id" });
            store.createIndex("expediente_id", "expediente_id", { unique: false });
          }
        });
        
        console.log("Stores en la base de datos después de la actualización:");
        for (let i = 0; i < db.objectStoreNames.length; i++) {
          console.log("- ", db.objectStoreNames.item(i));
        }
      };
    });
  }

  function setupEventListeners() {
    Object.keys(MODULES).forEach(moduleId => {
      const btn = document.getElementById(`btn-${moduleId}`);
      if (btn) {
        btn.addEventListener("click", () => switchModule(moduleId));
      }
    });

    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        sessionStorage.clear();
        window.location.href = "login.html";
      });
    }

    modalCancel.addEventListener("click", closeModal);
    modalOk.addEventListener("click", handleModalOk);
    scanModalCancel.addEventListener("click", closeScanModal);
    scanModalSave.addEventListener("click", saveDocuments);
    selectFilesBtn.addEventListener("click", () => fileInput.click());
    viewModalClose.addEventListener("click", closeViewModal);
    documentNameInput.addEventListener("input", updateSaveButtonState);

    fileInput.addEventListener("change", handleFileSelect);
    dropArea.addEventListener("dragover", handleDragOver);
    dropArea.addEventListener("dragleave", handleDragLeave);
    dropArea.addEventListener("drop", handleDrop);
    document.addEventListener("paste", handlePaste);

    [cedulaInput, nombreInput, cargoInput, fechaInput, estatusInput].forEach((input, idx, arr) => {
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          if (idx < arr.length - 1) arr[idx + 1].focus();
          else handleModalOk();
        } else if (e.key === "Escape") closeModal();
      });
    });
    document.addEventListener("click", (e) => { if (!contextMenu.contains(e.target)) hideContextMenu(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") { hideContextMenu(); closeModal(); closeScanModal(); closeViewModal(); } });

    document.getElementById("ctx-open").addEventListener("click", () => { if (contextTargetId) openExpedienteView(contextTargetId); hideContextMenu(); });
    document.getElementById("ctx-rename").addEventListener("click", () => { handleContextRename(); });
    document.getElementById("ctx-delete").addEventListener("click", () => { handleContextDelete(); });
  }

  function switchModule(moduleId) {
    if (!MODULES[moduleId]) return;

    activeModuleId = moduleId;
    expedientes = [];
    documentos = [];
    editingId = null;
    contextTargetId = null;
    currentExpedienteId = null;

    document.querySelectorAll('.sidebar li').forEach(item => item.classList.remove('active'));
    document.getElementById(`btn-${moduleId}`).parentElement.classList.add('active');

    renderModuleUI(moduleId);

    // --- MODIFICADO: Mostrar nombre y rol del usuario activo ---
    const usernameDisplay = document.getElementById("active-username-display");
    const userRoleDisplay = document.getElementById("active-user-role-display");
    
    const usuarioActivo = sessionStorage.getItem("usuarioActivo") || "Usuario";
    const tipoUsuarioActivo = sessionStorage.getItem("tipoUsuarioActivo") || "admin";

    if (usernameDisplay) {
      usernameDisplay.textContent = usuarioActivo;
    }

    if (userRoleDisplay) {
      if (tipoUsuarioActivo === 'admin') {
        userRoleDisplay.textContent = 'Administrador';
      } else if (tipoUsuarioActivo === 'user') {
        userRoleDisplay.textContent = 'Administradora';
      } else {
        userRoleDisplay.textContent = 'Invitado';
      }
    }
    // --- FIN DE LA MODIFICACIÓN ---

    loadExpedientes();
  }

  function renderModuleUI(moduleId) {
    const moduleName = MODULES[moduleId];
    mainContent.innerHTML = `
      <section class="module-panel" id="module-panel">
        <div class="panel-header">
          <h2>${moduleName} – Serie de Documentación</h2>
          <div class="panel-actions">
            <button class="btn primary" id="create-folder-btn">+ Crear carpeta</button>
          </div>
        </div>
        
        <div class="search-container">
          <div class="search-bar">
            <div class="search-icon">🔍</div>
            <input type="text" id="folder-search" placeholder="Buscar carpetas por nombre..." autocomplete="off">
          </div>
          <div class="search-results-count" id="search-results-count"></div>
        </div>
        
        <p class="lead">
          Crea carpetas para organizar la serie<br>
          documental. Haz clic derecho sobre una carpeta<br>
          para renombrar o eliminar.
        </p>
        <div class="folders-grid" id="folders-grid" aria-live="polite"></div>
      </section>

      <section class="folder-view" id="folder-view" style="display:none;">
        <div class="folder-view-header">
          <button class="btn ghost" id="back-to-ingreso">← Volver</button>
          <h3 id="folder-view-title"></h3>
        </div>
        <div class="folder-view-body">
          <div class="ficha-registro">
            <div class="ficha-item"><span class="ficha-label">Cédula:</span> <span id="ficha-cedula"></span></div>
            <div class="ficha-item"><span class="ficha-label">Nombre completo:</span> <span id="ficha-nombre"></span></div>
            <div class="ficha-item"><span class="ficha-label">Cargo:</span> <span id="ficha-cargo"></span></div>
            <div class="ficha-item"><span class="ficha-label">Fecha de ingreso:</span> <span id="ficha-fecha"></span></div>
            <div class="ficha-item"><span class="ficha-label">Estatus:</span> <span id="ficha-estatus" class="estatus-badge"></span></div>
          </div>
          
          <div class="documents-section">
            <div class="section-header">
              <h3>Documentos Escaneados</h3>
              <button class="btn primary" id="scan-document-btn">+ Escanear Documento</button>
            </div>
            
            <div class="search-container">
              <div class="search-bar">
                <div class="search-icon">🔍</div>
                <input type="text" id="document-search" placeholder="Buscar documentos por nombre..." autocomplete="off">
              </div>
              <div class="search-results-count" id="doc-search-results-count"></div>
            </div>
            
            <div class="documents-list" id="documents-list">
              <div class="empty-state" id="empty-documents">
                <p>No hay documentos escaneados. Haz clic en "Escanear Documento" para agregar.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    `;
    
    document.getElementById("create-folder-btn").addEventListener("click", () => { openModal("Crear carpeta"); editingId = null; });
    document.getElementById("back-to-ingreso").addEventListener("click", () => { showModulePanel(); });
    document.getElementById("scan-document-btn").addEventListener("click", openScanModal);
    
    const folderSearchInput = document.getElementById("folder-search");
    folderSearchInput.addEventListener("input", (e) => {
      const searchTerm = e.target.value.trim().toLowerCase();
      filterFolders(searchTerm);
    });
    
    const documentSearchInput = document.getElementById("document-search");
    documentSearchInput.addEventListener("input", (e) => {
      const searchTerm = e.target.value.trim().toLowerCase();
      filterDocuments(searchTerm);
    });
  }

  function showModulePanel() {
    document.getElementById('module-panel').style.display = '';
    document.getElementById('folder-view').style.display = 'none';
  }

  function getStoreNames() {
    return {
      expedientes: `${STORE_PREFIX}_${activeModuleId}`,
      documentos: `${DOCUMENTS_STORE_PREFIX}_${activeModuleId}`
    };
  }

  async function loadExpedientes() {
    try {
      const { expedientes: storeName } = getStoreNames();
      console.log("Cargando expedientes desde store:", storeName);
      
      if (!db.objectStoreNames.contains(storeName)) {
        console.error("El store no existe:", storeName);
        expedientes = [];
        renderExpedientes();
        return;
      }
      
      expedientes = await new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readonly");
        const store = tx.objectStore(storeName);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
      
      console.log("Expedientes cargados:", expedientes.length);
      renderExpedientes();
    } catch (error) {
      console.error("Error al cargar expedientes:", error);
      expedientes = [];
      renderExpedientes();
    }
  }

  async function saveExpediente(exp) {
    try {
      const { expedientes: storeName } = getStoreNames();
      console.log("Guardando expediente en store:", storeName);
      
      if (!db.objectStoreNames.contains(storeName)) {
        console.error("El store no existe:", storeName);
        throw new Error("El store de expedientes no existe");
      }
      
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        const req = store.put(exp);
        req.onsuccess = resolve;
        req.onerror = () => reject(req.error);
      });
    } catch (error) {
      console.error("Error al guardar expediente:", error);
      throw error;
    }
  }

  async function deleteExpediente(id) {
    try {
      const { expedientes: expedientesStore, documentos: documentosStore } = getStoreNames();
      console.log("Eliminando expediente:", id);
      
      if (!db.objectStoreNames.contains(expedientesStore) || !db.objectStoreNames.contains(documentosStore)) {
        console.error("Uno de los stores no existe");
        throw new Error("Los stores necesarios no existen");
      }
      
      return new Promise((resolve, reject) => {
        const tx = db.transaction([expedientesStore, documentosStore], "readwrite");
        tx.objectStore(expedientesStore).delete(id);
        
        const index = tx.objectStore(documentosStore).index("expediente_id");
        const req = index.openCursor(IDBKeyRange.only(id));
        req.onsuccess = (e) => {
          const cursor = e.target.result;
          if (cursor) {
            cursor.delete();
            cursor.continue();
          }
        };
        
        tx.oncomplete = () => {
          expedientes = expedientes.filter(x => x.id !== id);
          renderExpedientes();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      });
    } catch (error) {
      console.error("Error al eliminar expediente:", error);
      throw error;
    }
  }

  async function loadDocuments(expedienteId) {
    try {
      const { documentos: storeName } = getStoreNames();
      console.log("Cargando documentos para expediente:", expedienteId);
      
      if (!db.objectStoreNames.contains(storeName)) {
        console.error("El store no existe:", storeName);
        documentos = [];
        renderDocuments();
        return;
      }
      
      documentos = await new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readonly");
        const store = tx.objectStore(storeName);
        const index = store.index("expediente_id");
        const req = index.getAll(expedienteId);
        req.onsuccess = () => {
          const docs = req.result || [];
          docs.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
          resolve(docs);
        };
        req.onerror = () => reject(req.error);
      });
      
      console.log("Documentos cargados:", documentos.length);
      renderDocuments();
    } catch (error) {
      console.error("Error al cargar documentos:", error);
      documentos = [];
      renderDocuments();
    }
  }

  async function saveDocumentToDB(document) {
    try {
      const { documentos: storeName } = getStoreNames();
      console.log("Guardando documento en store:", storeName);
      
      if (!db.objectStoreNames.contains(storeName)) {
        console.error("El store no existe:", storeName);
        throw new Error("El store de documentos no existe");
      }
      
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        const req = store.put(document);
        req.onsuccess = resolve;
        req.onerror = () => reject(req.error);
      });
    } catch (error) {
      console.error("Error al guardar documento:", error);
      throw error;
    }
  }

  async function deleteDocumentFromDB(documentId) {
    try {
      const { documentos: storeName } = getStoreNames();
      console.log("Eliminando documento:", documentId);
      
      if (!db.objectStoreNames.contains(storeName)) {
        console.error("El store no existe:", storeName);
        throw new Error("El store de documentos no existe");
      }
      
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        const req = store.delete(documentId);
        req.onsuccess = resolve;
        req.onerror = () => reject(req.error);
      });
    } catch (error) {
      console.error("Error al eliminar documento:", error);
      throw error;
    }
  }

  function renderExpedientes() {
    const grid = document.getElementById("folders-grid");
    expedientes.sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto, 'es', { sensitivity: 'base' }));
    grid.innerHTML = "";
    
    if (expedientes.length === 0) {
      grid.innerHTML = `<div style="text-align: center; padding: 80px 20px; color: #94a3b8; font-size: 16px; line-height: 1.6;">No hay carpetas.<br><br>Presiona "<strong>+ Crear carpeta</strong>" para empezar.</div>`;
      return;
    }

    expedientes.forEach(exp => {
      const div = document.createElement("div");
      div.className = "folder";
      div.tabIndex = 0;
      div.dataset.id = exp.id;
      div.setAttribute("data-fullname", exp.nombreCompleto);
      div.innerHTML = `<div class="folder-icon">📂</div><div class="folder-name" data-original="${escapeHtml(exp.nombreCompleto)}" title="${escapeHtml(exp.nombreCompleto)}">${escapeHtml(exp.nombreCompleto)}</div>`;
      div.addEventListener("click", () => openExpedienteView(exp.id));
      div.addEventListener("keydown", (e) => { if (e.key === "Enter") openExpedienteView(exp.id); });
      div.addEventListener("contextmenu", (e) => { e.preventDefault(); contextTargetId = exp.id; showContextMenuAt(e.clientX, e.clientY); });
      grid.appendChild(div);
    });
  }

  function openModal(title, data = {}) {
    document.getElementById("modal-title").textContent = title;
    cedulaInput.value = data.cedula || "";
    nombreInput.value = data.nombreCompleto || "";
    cargoInput.value = data.cargo || "";
    fechaInput.value = data.fechaIngreso || "";
    estatusInput.value = data.estatus || "";
    modalOverlay.style.display = "flex";
    modalOverlay.setAttribute("aria-hidden", "false");
    setTimeout(() => cedulaInput.focus(), 80);
  }

  function closeModal() {
    modalOverlay.style.display = "none";
    modalOverlay.setAttribute("aria-hidden", "true");
    editingId = null;
  }

  async function handleModalOk() {
    try {
      const cedula = cedulaInput.value.trim();
      const nombreCompleto = nombreInput.value.trim();
      const cargo = cargoInput.value.trim();
      const fechaIngreso = fechaInput.value;
      const estatus = estatusInput.value;

      if (!cedula || !nombreCompleto || !cargo || !fechaIngreso || !estatus) {
        alert("Todos los campos son requeridos.");
        cedulaInput.focus();
        return;
      }
      if (expedientes.some(x => x.cedula === cedula && x.id !== editingId)) {
        alert("La cédula ya existe. Debe ser única.");
        cedulaInput.focus();
        return;
      }

      const now = Date.now();
      const newExp = {
        id: editingId || idGen(),
        cedula, nombreCompleto, cargo, fechaIngreso, estatus,
        createdAt: editingId ? expedientes.find(x => x.id === editingId)?.createdAt || now : now,
        updatedAt: now
      };

      await saveExpediente(newExp);
      await loadExpedientes();
      closeModal();
    } catch (error) {
      console.error("Error al guardar expediente:", error);
      alert("Ocurrió un error al guardar el expediente. Por favor, inténtalo de nuevo.");
    }
  }

  function openExpedienteView(id) {
    const exp = expedientes.find(x => x.id === id);
    if (!exp) return;
    
    currentExpedienteId = id;
    showFolderView(exp);
  }

  function showFolderView(exp) {
    document.getElementById('module-panel').style.display = 'none';
    document.getElementById('folder-view').style.display = '';
    
    document.getElementById('folder-view-title').textContent = exp.nombreCompleto;
    document.getElementById('ficha-cedula').textContent = exp.cedula;
    document.getElementById('ficha-nombre').textContent = exp.nombreCompleto;
    document.getElementById('ficha-cargo').textContent = exp.cargo;
    document.getElementById('ficha-fecha').textContent = new Date(exp.fechaIngreso).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    
    const fichaEstatus = document.getElementById('ficha-estatus');
    fichaEstatus.textContent = exp.estatus;
    fichaEstatus.className = `estatus-badge estatus-${exp.estatus.toLowerCase()}`;
    
    const documentSearchInput = document.getElementById("document-search");
    if (documentSearchInput) {
      documentSearchInput.value = "";
    }
    
    loadDocuments(exp.id);
  }
  
  function renderDocuments() {
    const documentsList = document.getElementById("documents-list");
    if (documentos.length === 0) {
      documentsList.innerHTML = `<div class="empty-state"><p>No hay documentos escaneados. Haz clic en "Escanear Documento" para agregar.</p></div>`;
      return;
    }

    documentsList.innerHTML = "";
    documentos.forEach(doc => {
      const docItem = document.createElement("div");
      docItem.className = "document-item";
      docItem.dataset.id = doc.id;
      
      const fileIcon = getFileIcon(doc.tipo);
      const formattedDate = new Date(doc.fechaCreacion).toLocaleDateString('es-VE');
      
      docItem.innerHTML = `
        <div class="document-icon">${fileIcon}</div>
        <div class="document-info">
          <div class="document-name" data-original="${escapeHtml(doc.nombre)}" title="${escapeHtml(doc.nombre)}">${escapeHtml(doc.nombre)}</div>
          <div class="document-date">${formattedDate}</div>
        </div>
        <div class="document-actions">
          <button class="btn-icon btn-edit" title="Editar nombre" data-id="${doc.id}">✏️</button>
          <button class="btn-icon btn-view" title="Ver documento" data-id="${doc.id}">👁️</button>
          <button class="btn-icon btn-delete" title="Eliminar" data-id="${doc.id}">🗑️</button>
          <button class="btn btn-pdf" title="Exportar a PDF" data-id="${doc.id}">PDF</button>
        </div>
      `;
      documentsList.appendChild(docItem);
    });
    
    documentsList.querySelectorAll(".btn-edit").forEach(btn => btn.addEventListener("click", (e) => { e.stopPropagation(); editDocumentName(btn.dataset.id); }));
    documentsList.querySelectorAll(".btn-view").forEach(btn => btn.addEventListener("click", (e) => { e.stopPropagation(); viewDocument(btn.dataset.id); }));
    documentsList.querySelectorAll(".btn-delete").forEach(btn => btn.addEventListener("click", (e) => { e.stopPropagation(); deleteDocument(btn.dataset.id); }));
    documentsList.querySelectorAll(".btn-pdf").forEach(btn => btn.addEventListener("click", (e) => { e.stopPropagation(); exportToPDF(btn.dataset.id); }));
  }

  function openScanModal() { scanModalOverlay.style.display = "flex"; scanModalOverlay.setAttribute("aria-hidden", "false"); resetScanModal(); }
  function closeScanModal() { scanModalOverlay.style.display = "none"; scanModalOverlay.setAttribute("aria-hidden", "true"); resetScanModal(); }
  function resetScanModal() { filesToUpload = []; previewArea.style.display = "none"; previewContainer.innerHTML = ""; documentNameInput.value = ""; scanModalSave.disabled = true; fileInput.value = ""; }
  function handleFileSelect(e) { addFiles(Array.from(e.target.files)); }
  function handleDragOver(e) { e.preventDefault(); dropArea.classList.add("dragover"); }
  function handleDragLeave(e) { e.preventDefault(); dropArea.classList.remove("dragover"); }
  function handleDrop(e) { e.preventDefault(); dropArea.classList.remove("dragover"); const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/")); if (files.length > 0) addFiles(files); else alert("Por favor, solo selecciona archivos de imagen."); }
  function handlePaste(e) { if (scanModalOverlay.style.display !== "flex") return; const items = Array.from(e.clipboardData.items).filter(i => i.type.startsWith("image/")); items.forEach(item => { const file = item.getAsFile(); if (file) addFiles([file]); }); }
  
  function addFiles(files) {
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        filesToUpload.push({ file, dataUrl: e.target.result, name: file.name });
        updatePreview();
      };
      reader.readAsDataURL(file);
    });
  }

  function updatePreview() {
    if (filesToUpload.length === 0) { previewArea.style.display = "none"; scanModalSave.disabled = true; return; }
    previewArea.style.display = "flex"; previewContainer.innerHTML = "";
    filesToUpload.forEach((file, index) => {
      const previewItem = document.createElement("div");
      previewItem.className = "preview-item";
      previewItem.innerHTML = `<img src="${file.dataUrl}" alt="${escapeHtml(file.name)}"><button class="remove-preview" data-index="${index}">✕</button>`;
      previewContainer.appendChild(previewItem);
    });
    if (filesToUpload.length === 1 && !documentNameInput.value) documentNameInput.value = filesToUpload[0].name.replace(/\.[^/.]+$/, "");
    updateSaveButtonState();
    document.querySelectorAll(".remove-preview").forEach(btn => { btn.addEventListener("click", (e) => { const index = parseInt(e.target.dataset.index); filesToUpload.splice(index, 1); updatePreview(); }); });
  }

  function updateSaveButtonState() { const hasFiles = filesToUpload.length > 0; const hasName = documentNameInput.value.trim() !== ""; scanModalSave.disabled = !(hasFiles && hasName); }

  async function saveDocuments() {
    try {
      const documentName = documentNameInput.value.trim();
      if (!documentName || filesToUpload.length === 0) return;
      
      for (const fileData of filesToUpload) {
        const document = { id: idGen(), expediente_id: currentExpedienteId, nombre: documentName, tipo: fileData.file.type, datos: fileData.dataUrl, fechaCreacion: Date.now(), fechaModificacion: Date.now() };
        await saveDocumentToDB(document);
      }
      
      await loadDocuments(currentExpedienteId);
      closeScanModal();
    } catch (error) {
      console.error("Error al guardar documentos:", error);
      alert("Ocurrió un error al guardar los documentos. Por favor, inténtalo de nuevo.");
    }
  }

  async function editDocumentName(documentId) {
    try {
      const doc = documentos.find(d => d.id === documentId);
      if (!doc) return;
      
      const newName = prompt("Editar nombre del documento:", doc.nombre);
      if (!newName || newName.trim() === "") return;
      
      doc.nombre = newName.trim();
      doc.fechaModificacion = Date.now();
      await saveDocumentToDB(doc);
      await loadDocuments(currentExpedienteId);
    } catch (error) {
      console.error("Error al actualizar nombre:", error);
      alert("Ocurrió un error al actualizar el nombre del documento.");
    }
  }

  function viewDocument(documentId) {
    const doc = documentos.find(d => d.id === documentId);
    if (!doc) return;
    viewModalTitle.textContent = doc.nombre;
    documentViewImage.src = doc.datos;
    viewModalOverlay.style.display = "flex";
    viewModalOverlay.setAttribute("aria-hidden", "false");
  }

  function closeViewModal() { viewModalOverlay.style.display = "none"; viewModalOverlay.setAttribute("aria-hidden", "true"); documentViewImage.src = ""; }

  async function deleteDocument(documentId) {
    try {
      const doc = documentos.find(d => d.id === documentId);
      if (!doc || !confirm(`¿Estás seguro de que quieres eliminar "${doc.nombre}"?`)) return;
      
      await deleteDocumentFromDB(documentId);
      await loadDocuments(currentExpedienteId);
    } catch (error) {
      console.error("Error al eliminar documento:", error);
      alert("Ocurrió un error al eliminar el documento.");
    }
  }

  function exportToPDF(documentId) {
    const doc = documentos.find(d => d.id === documentId);
    if (!doc || !window.jspdf) { alert("No se pudo generar el PDF."); return; }
    const img = new Image();
    img.onload = function() {
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ orientation: 'p', unit: 'pt', format: 'letter' });
      const margin = 72; const pageWidth = pdf.internal.pageSize.getWidth(); const pageHeight = pdf.internal.pageSize.getHeight();
      const maxWidth = pageWidth - (margin * 2); const maxHeight = pageHeight - (margin * 2);
      const ratio = Math.min(maxWidth / this.width, maxHeight / this.height);
      const finalWidth = this.width * ratio; const finalHeight = this.height * ratio;
      pdf.addImage(doc.datos, 'PNG', (pageWidth - finalWidth) / 2, (pageHeight - finalHeight) / 2, finalWidth, finalHeight);
      pdf.save(`${doc.nombre}.pdf`);
    };
    img.onerror = () => alert("No se pudo cargar la imagen para generar el PDF.");
    img.src = doc.datos;
  }

  function idGen() { return "exp_" + Math.random().toString(36).slice(2, 9); }
  function getFileIcon(fileType) { return fileType.startsWith("image/") ? "🖼️" : "📄"; }
  function escapeHtml(str) { return String(str).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  
  function showContextMenuAt(x, y) {
    contextMenu.style.display = "block"; contextMenu.style.left = x + "px"; contextMenu.style.top = y + "px"; contextMenu.setAttribute("aria-hidden", "false");
    const rect = contextMenu.getBoundingClientRect(); const vw = window.innerWidth; const vh = window.innerHeight;
    if (rect.right > vw) contextMenu.style.left = Math.max(8, vw - rect.width - 8) + "px";
    if (rect.bottom > vh) contextMenu.style.top = Math.max(8, vh - rect.height - 8) + "px";
  }

  function hideContextMenu() { contextMenu.style.display = "none"; contextMenu.setAttribute("aria-hidden", "true"); contextTargetId = null; }

  function handleContextRename() {
    if (!contextTargetId) return hideContextMenu();
    const exp = expedientes.find(x => x.id === contextTargetId);
    if (!exp) return hideContextMenu();
    editingId = exp.id;
    openModal("Editar carpeta", exp);
    hideContextMenu();
  }

  function handleContextDelete() {
    if (!contextTargetId) return hideContextMenu();
    if (!confirm("¿Eliminar la carpeta? Esta acción no se puede deshacer.")) return hideContextMenu();
    deleteExpediente(contextTargetId);
    hideContextMenu();
  }

  function filterFolders(searchTerm) {
    const grid = document.getElementById("folders-grid");
    const resultsCount = document.getElementById("search-results-count");
    const allFolders = grid.querySelectorAll(".folder");
    let visibleCount = 0;
    
    allFolders.forEach(folder => {
      const nameElement = folder.querySelector(".folder-name");
      const originalText = nameElement.getAttribute("data-original").toLowerCase();
      
      if (originalText.includes(searchTerm)) {
        folder.style.display = "";
        visibleCount++;
        
        if (searchTerm.length > 0) {
          const regex = new RegExp(`(${escapeRegExp(searchTerm)})`, 'gi');
          nameElement.innerHTML = originalText.replace(regex, '<span class="search-highlight">$1</span>');
        } else {
          nameElement.innerHTML = nameElement.getAttribute("data-original");
        }
      } else {
        folder.style.display = "none";
      }
    });
    
    if (searchTerm.length > 0) {
      resultsCount.textContent = `${visibleCount} carpeta${visibleCount !== 1 ? 's' : ''} encontrada${visibleCount !== 1 ? 's' : ''}`;
      resultsCount.style.display = "block";
    } else {
      resultsCount.style.display = "none";
    }
  }

  function filterDocuments(searchTerm) {
    const documentsList = document.getElementById("documents-list");
    const resultsCount = document.getElementById("doc-search-results-count");
    const allDocuments = documentsList.querySelectorAll(".document-item");
    let visibleCount = 0;
    
    allDocuments.forEach(doc => {
      const nameElement = doc.querySelector(".document-name");
      const originalText = nameElement.getAttribute("data-original").toLowerCase();
      
      if (originalText.includes(searchTerm)) {
        doc.style.display = "";
        visibleCount++;
        
        if (searchTerm.length > 0) {
          const regex = new RegExp(`(${escapeRegExp(searchTerm)})`, 'gi');
          nameElement.innerHTML = originalText.replace(regex, '<span class="search-highlight">$1</span>');
        } else {
          nameElement.innerHTML = nameElement.getAttribute("data-original");
        }
      } else {
        doc.style.display = "none";
      }
    });
    
    if (searchTerm.length > 0) {
      resultsCount.textContent = `${visibleCount} documento${visibleCount !== 1 ? 's' : ''} encontrado${visibleCount !== 1 ? 's' : ''}`;
      resultsCount.style.display = "block";
    } else {
      resultsCount.style.display = "none";
    }
  }

  function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  document.getElementById("main-content").addEventListener("contextmenu", (e) => {
    if (e.target.closest(".folder") || e.target.closest(".document-item") || e.target.closest(".modal")) return;
    e.preventDefault(); 
    return;

    contextTargetId = null;
    const ctxList = contextMenu.querySelector("ul");
    ctxList.innerHTML = `<li id="ctx-create">Crear</li><li id="ctx-refresh">Actualizar</li>`;
    showContextMenuAt(e.clientX, e.clientY);
    document.getElementById("ctx-create").addEventListener("click", () => { openModal("Crear carpeta"); hideContextMenu(); restoreContextMenuTemplate(); }, { once: true });
    document.getElementById("ctx-refresh").addEventListener("click", () => { loadExpedientes(); hideContextMenu(); restoreContextMenuTemplate(); }, { once: true });
  });

  function restoreContextMenuTemplate() {
    const ctxList = contextMenu.querySelector("ul");
    ctxList.innerHTML = `<li id="ctx-open">Abrir</li><li id="ctx-rename">Editar</li><li id="ctx-delete">Eliminar</li>`;
    document.getElementById("ctx-open").addEventListener("click", () => { if (contextTargetId) openExpedienteView(contextTargetId); hideContextMenu(); });
    document.getElementById("ctx-rename").addEventListener("click", handleContextRename);
    document.getElementById("ctx-delete").addEventListener("click", handleContextDelete);
  }
});