const NEW_CATEGORY_VALUE = "__new_category__";
const TEMP_CATEGORY_VALUE = "__temp_category__";
const STATIC_CATEGORY_PREFIX = "static:";
const BCV_RATE_STORAGE_KEY = "gastos_operativos_tasa_bcv";
const BASE_CATEGORIES = ["COMIDA", "HERRAMIENTAS", "MATERIALES", "EQUIPOS", "INSUMOS", "VEHICULOS"];
const HIDDEN_SEEDED_CATEGORIES = [
    "Gasolina",
    "Cambio de Aceite / Filtros",
    "Reparación / Pieza Mecánica",
    "Mano de Obra",
    "Comida / Viáticos",
    "Herramientas / Insumos"
];

const state = {
    tasaBcv: 0,
    categorias: [],
    selectedFile: null,
    tempCategory: null,
    syncingMoney: false,
    currentUser: null,
    historyRows: []
};

const elements = {
    form: document.querySelector("#expenseForm"),
    fecha: document.querySelector("#fecha"),
    categoria: document.querySelector("#categoria"),
    deleteCategoryButton: document.querySelector("#deleteCategoryButton"),
    vehiculoDetalleField: document.querySelector("#vehiculoDetalleField"),
    vehiculoDetalle: document.querySelector("#vehiculoDetalle"),
    montoUsd: document.querySelector("#montoUsd"),
    montoVes: document.querySelector("#montoVes"),
    monedaUsd: document.querySelector("#monedaUsd"),
    monedaVes: document.querySelector("#monedaVes"),
    numeroFactura: document.querySelector("#numeroFactura"),
    descripcion: document.querySelector("#descripcion"),
    comprobanteInput: document.querySelector("#comprobanteInput"),
    dropZone: document.querySelector("#dropZone"),
    filePreview: document.querySelector("#filePreview"),
    bcvBadge: document.querySelector("#bcvBadge"),
    bcvValue: document.querySelector("#bcvValue"),
    historyList: document.querySelector("#historyList"),
    historyCount: document.querySelector("#historyCount"),
    submitButton: document.querySelector("#submitButton"),
    logoutButton: document.querySelector("#logoutButton"),
    userEmail: document.querySelector("#userEmail"),
    periodFilter: document.querySelector("#periodFilter"),
    fromDate: document.querySelector("#fromDate"),
    toDate: document.querySelector("#toDate"),
    refreshButton: document.querySelector("#refreshButton"),
    exportButton: document.querySelector("#exportButton"),
    totalUsd: document.querySelector("#totalUsd"),
    totalVes: document.querySelector("#totalVes"),
    totalReceipts: document.querySelector("#totalReceipts"),
    tabButtons: document.querySelectorAll(".module-tab"),
    modulePanels: document.querySelectorAll(".module-panel")
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
    const { data, error } = await supabaseClient.auth.getSession();

    if (error || !data.session) {
        window.location.href = "index.html";
        return;
    }

    state.currentUser = data.session.user;
    elements.userEmail.textContent = state.currentUser.email || "Usuario activo";
    elements.fecha.value = toDateInput(new Date());

    bindEvents();
    setPeriodDates("month");

    await Promise.all([
        loadBcvRate(),
        loadCategorias(),
        loadHistorico()
    ]);
}

function bindEvents() {
    elements.tabButtons.forEach((button) => {
        button.addEventListener("click", () => activateTab(button.dataset.tabTarget));
    });
    elements.logoutButton.addEventListener("click", logout);
    elements.bcvBadge.addEventListener("click", editBcvRate);
    elements.categoria.addEventListener("change", handleCategoryChange);
    elements.deleteCategoryButton.addEventListener("click", deleteSelectedCategory);
    elements.vehiculoDetalle.addEventListener("change", () => {
        if (elements.categoria.value) {
            elements.categoria.dataset.previous = elements.categoria.value;
        }
    });
    elements.montoUsd.addEventListener("input", () => syncMoney("USD"));
    elements.montoVes.addEventListener("input", () => syncMoney("VES"));
    elements.form.addEventListener("submit", saveExpense);
    elements.form.addEventListener("reset", () => setTimeout(resetFormState, 0));
    elements.periodFilter.addEventListener("change", () => {
        setPeriodDates(elements.periodFilter.value);
        loadHistorico();
    });
    elements.fromDate.addEventListener("change", () => {
        elements.periodFilter.value = "custom";
        loadHistorico();
    });
    elements.toDate.addEventListener("change", () => {
        elements.periodFilter.value = "custom";
        loadHistorico();
    });
    elements.refreshButton.addEventListener("click", loadHistorico);
    elements.exportButton.addEventListener("click", exportExcel);
    elements.historyList.addEventListener("click", handleHistoryClick);

    elements.dropZone.addEventListener("click", () => elements.comprobanteInput.click());
    elements.dropZone.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            elements.comprobanteInput.click();
        }
    });
    elements.comprobanteInput.addEventListener("change", () => handleFile(elements.comprobanteInput.files[0]));

    ["dragenter", "dragover"].forEach((eventName) => {
        elements.dropZone.addEventListener(eventName, (event) => {
            event.preventDefault();
            elements.dropZone.classList.add("is-dragover");
        });
    });

    ["dragleave", "drop"].forEach((eventName) => {
        elements.dropZone.addEventListener(eventName, (event) => {
            event.preventDefault();
            elements.dropZone.classList.remove("is-dragover");
        });
    });

    elements.dropZone.addEventListener("drop", (event) => {
        handleFile(event.dataTransfer.files[0]);
    });
}

function activateTab(target) {
    elements.tabButtons.forEach((button) => {
        const isActive = button.dataset.tabTarget === target;
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-selected", String(isActive));
    });

    elements.modulePanels.forEach((panel) => {
        const isActive = panel.dataset.panel === target;
        panel.hidden = !isActive;
        panel.classList.toggle("is-active", isActive);
    });
}

async function logout() {
    await supabaseClient.auth.signOut();
    window.location.href = "index.html";
}

async function loadBcvRate() {
    const savedRate = Number(localStorage.getItem(BCV_RATE_STORAGE_KEY));

    if (Number.isFinite(savedRate) && savedRate > 0) {
        setBcvRate(savedRate);
    }

    try {
        const response = await fetch("https://ve.dolarapi.com/v1/dolares/oficial", { cache: "no-store" });
        if (!response.ok) throw new Error("No se pudo consultar DolarAPI Venezuela.");

        const data = await response.json();
        const rate = Number(data.promedio);
        if (!Number.isFinite(rate) || rate <= 0) throw new Error("La tasa BCV recibida no es válida.");

        setBcvRate(rate);
        localStorage.setItem(BCV_RATE_STORAGE_KEY, String(rate));
    } catch (error) {
        console.error(error);

        if (state.tasaBcv > 0) {
            return;
        }

        await editBcvRate("No pude consultar la tasa BCV en vivo. Cárgala manualmente para continuar.");
    }
}

function setBcvRate(rate) {
    state.tasaBcv = Number(rate) || 0;
    elements.bcvValue.textContent = state.tasaBcv > 0 ? `${formatNumber(state.tasaBcv, 4)} Bs` : "Sin tasa";

    if (elements.montoUsd.value) {
        syncMoney("USD");
    } else if (elements.montoVes.value) {
        syncMoney("VES");
    }
}

async function editBcvRate(message = "") {
    const result = await Swal.fire({
        title: "Editar Tasa BCV",
        text: message,
        input: "number",
        inputValue: state.tasaBcv || "",
        inputAttributes: { min: "0", step: "0.0001" },
        showCancelButton: true,
        confirmButtonText: "Actualizar",
        cancelButtonText: "Cancelar",
        inputValidator: (value) => {
            const rate = Number(value);
            if (!Number.isFinite(rate) || rate <= 0) return "Ingresa una tasa mayor a cero.";
            return null;
        }
    });

    if (result.isConfirmed) {
        const rate = Number(result.value);
        setBcvRate(rate);
        localStorage.setItem(BCV_RATE_STORAGE_KEY, String(rate));
    }
}

async function loadCategorias(selectedId = "") {
    const { data, error } = await supabaseClient
        .from("categorias_gastos")
        .select("id,nombre")
        .order("nombre", { ascending: true });

    if (error) {
        console.error(error);
        elements.categoria.innerHTML = '<option value="">Error cargando categorías</option>';
        await Swal.fire({ icon: "error", title: "Error", text: "No se pudieron cargar las categorías." });
        return;
    }

    state.categorias = data || [];
    renderCategorias(selectedId);
}

function renderCategorias(selectedId = "") {
    const savedCategories = state.categorias.filter((categoria) => !isHiddenSeededCategory(categoria.nombre));
    const options = [
        '<option value="">Selecciona una categoría</option>',
        '<optgroup label="Categorías principales">',
        ...BASE_CATEGORIES.map((categoria) => `<option value="${STATIC_CATEGORY_PREFIX}${escapeHtml(categoria)}">${escapeHtml(categoria)}</option>`),
        '</optgroup>'
    ];

    if (state.tempCategory) {
        options.push('<optgroup label="Ítem temporal">');
        options.push(`<option value="${TEMP_CATEGORY_VALUE}">${escapeHtml(state.tempCategory.nombre)}</option>`);
        options.push('</optgroup>');
    }

    if (savedCategories.length) {
        options.push('<optgroup label="Categorías guardadas">');
        options.push(...savedCategories.map((categoria) => `<option value="${escapeHtml(categoria.id)}">${escapeHtml(categoria.nombre)}</option>`));
        options.push('</optgroup>');
    }

    options.push(`<option value="${NEW_CATEGORY_VALUE}">+ Otro ítem temporal o permanente...</option>`);

    elements.categoria.innerHTML = options.join("");
    elements.categoria.value = selectedId;
    updateVehicleDetailVisibility();
    updateCategoryActions();
}

async function handleCategoryChange() {
    if (elements.categoria.value === NEW_CATEGORY_VALUE) {
        await createCategoryModal();
        return;
    }

    elements.categoria.dataset.previous = elements.categoria.value;
    updateVehicleDetailVisibility();
    updateCategoryActions();
}

async function createCategoryModal() {
    const previousValue = isKnownCategoryValue(elements.categoria.dataset.previous)
        ? elements.categoria.dataset.previous
        : "";

    const result = await Swal.fire({
        title: "Otro ítem/categoría",
        html: `
            <input id="swalCategoryName" class="swal2-input" placeholder="Ej. Ferretería, repuesto puntual, comida especial">
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: "Usar ítem",
        cancelButtonText: "Cancelar",
        preConfirm: () => {
            const nombre = document.querySelector("#swalCategoryName").value.trim();
            if (!nombre) {
                Swal.showValidationMessage("Ingresa el nombre del ítem o categoría.");
                return false;
            }

            return { nombre };
        }
    });

    if (!result.isConfirmed) {
        elements.categoria.value = previousValue;
        updateVehicleDetailVisibility();
        updateCategoryActions();
        return;
    }

    state.tempCategory = { id: null, nombre: result.value.nombre };
    renderCategorias(TEMP_CATEGORY_VALUE);
    elements.categoria.dataset.previous = TEMP_CATEGORY_VALUE;
    await Swal.fire({ icon: "success", title: "Ítem temporal listo", text: "Después de guardar el gasto te preguntaré si deseas conservarlo como categoría fija.", timer: 1800, showConfirmButton: false });
}

function getSelectedCategory() {
    const value = elements.categoria.value;

    if (value.startsWith(STATIC_CATEGORY_PREFIX)) {
        const nombre = value.replace(STATIC_CATEGORY_PREFIX, "");
        if (nombre === "VEHICULOS" && elements.vehiculoDetalle.value) {
            return { id: null, nombre: `${nombre} - ${elements.vehiculoDetalle.value}` };
        }

        return { id: null, nombre };
    }

    if (value === TEMP_CATEGORY_VALUE && state.tempCategory) {
        return state.tempCategory;
    }

    return state.categorias.find((categoria) => categoria.id === value) || null;
}

function isKnownCategoryValue(value = "") {
    if (!value) return false;
    if (value === TEMP_CATEGORY_VALUE && state.tempCategory) return true;
    if (value.startsWith(STATIC_CATEGORY_PREFIX)) return BASE_CATEGORIES.includes(value.replace(STATIC_CATEGORY_PREFIX, ""));
    return state.categorias.some((categoria) => categoria.id === value);
}

function isHiddenSeededCategory(nombre = "") {
    const normalizedName = normalizeCategoryName(nombre);
    return HIDDEN_SEEDED_CATEGORIES.some((hiddenName) => normalizeCategoryName(hiddenName) === normalizedName);
}

function normalizeCategoryName(nombre = "") {
    return nombre
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
}

function updateVehicleDetailVisibility() {
    const isVehicle = elements.categoria.value === `${STATIC_CATEGORY_PREFIX}VEHICULOS`;
    elements.vehiculoDetalleField.classList.toggle("is-hidden", !isVehicle);

    if (!isVehicle) {
        elements.vehiculoDetalle.value = "";
    }
}

function updateCategoryActions() {
    const selectedSavedCategory = getPersistedSelectedCategory();
    elements.deleteCategoryButton.classList.toggle("is-hidden", !selectedSavedCategory);
}

function getPersistedSelectedCategory() {
    const value = elements.categoria.value;
    if (!value || value === NEW_CATEGORY_VALUE || value === TEMP_CATEGORY_VALUE || value.startsWith(STATIC_CATEGORY_PREFIX)) {
        return null;
    }

    return state.categorias.find((categoria) => categoria.id === value) || null;
}

async function deleteSelectedCategory() {
    const selectedSavedCategory = getPersistedSelectedCategory();
    if (!selectedSavedCategory) return;

    const result = await Swal.fire({
        icon: "warning",
        title: "Eliminar categoría guardada",
        text: `Se eliminará "${selectedSavedCategory.nombre}" del selector. Los gastos históricos conservarán el texto de la categoría.`,
        showCancelButton: true,
        confirmButtonText: "Eliminar",
        cancelButtonText: "Cancelar",
        confirmButtonColor: "#DC2626"
    });

    if (!result.isConfirmed) return;

    elements.deleteCategoryButton.disabled = true;

    try {
        const { data, error } = await supabaseClient
            .from("categorias_gastos")
            .delete()
            .eq("id", selectedSavedCategory.id)
            .select("id");

        if (error) throw error;
        if (!data || data.length === 0) {
            throw new Error("Supabase no eliminó la categoría. Revisa que exista la política DELETE para categorias_gastos.");
        }

        await loadCategorias();
        await Swal.fire({ icon: "success", title: "Categoría eliminada", timer: 1300, showConfirmButton: false });
    } catch (error) {
        console.error(error);
        await Swal.fire({ icon: "error", title: "No se pudo eliminar", text: error.message });
    } finally {
        elements.deleteCategoryButton.disabled = false;
        updateCategoryActions();
    }
}

function syncMoney(source) {
    if (state.syncingMoney || state.tasaBcv <= 0) return;

    state.syncingMoney = true;

    if (source === "USD") {
        const usd = parseCurrency(elements.montoUsd.value);
        elements.montoVes.value = usd > 0 ? (usd * state.tasaBcv).toFixed(2) : "";
        elements.monedaUsd.checked = true;
    } else {
        const ves = parseCurrency(elements.montoVes.value);
        elements.montoUsd.value = ves > 0 ? (ves / state.tasaBcv).toFixed(2) : "";
        elements.monedaVes.checked = true;
    }

    state.syncingMoney = false;
}

function handleFile(file) {
    if (!file) return;

    const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
        Swal.fire({ icon: "warning", title: "Archivo no permitido", text: "Sube una imagen o un PDF." });
        return;
    }

    state.selectedFile = file;
    renderFilePreview(file);
}

function renderFilePreview(file) {
    const sizeKb = Math.max(1, Math.round(file.size / 1024));
    const imagePreview = file.type.startsWith("image/")
        ? `<img src="${URL.createObjectURL(file)}" alt="Vista previa del comprobante">`
        : `<div class="avatar">PDF</div>`;

    elements.filePreview.innerHTML = `
        ${imagePreview}
        <div class="preview-meta">
            <strong>${escapeHtml(file.name)}</strong>
            <small>${escapeHtml(file.type || "Archivo")} - ${sizeKb} KB</small>
        </div>
        <button class="ghost-button" type="button" id="removeFileButton">Quitar</button>
    `;
    elements.filePreview.classList.add("is-visible");

    document.querySelector("#removeFileButton").addEventListener("click", () => {
        state.selectedFile = null;
        elements.comprobanteInput.value = "";
        elements.filePreview.classList.remove("is-visible");
        elements.filePreview.innerHTML = "";
    });
}

async function saveExpense(event) {
    event.preventDefault();

    const selectedCategory = getSelectedCategory();
    const responsable = document.querySelector('input[name="responsable"]:checked')?.value;
    const moneda = document.querySelector('input[name="moneda"]:checked')?.value;

    if (!elements.fecha.value) {
        await Swal.fire({ icon: "warning", title: "Fecha requerida", text: "Selecciona la fecha del gasto." });
        elements.fecha.focus();
        return;
    }

    if (!selectedCategory) {
        await Swal.fire({ icon: "warning", title: "Categoría requerida", text: "Selecciona una categoría o crea una nueva antes de guardar." });
        elements.categoria.focus();
        return;
    }

    if (elements.categoria.value === `${STATIC_CATEGORY_PREFIX}VEHICULOS` && !elements.vehiculoDetalle.value) {
        await Swal.fire({ icon: "warning", title: "Detalle de vehículo requerido", text: "Selecciona si fue gasolina, pieza mecánica, cambio de aceite, servicios o mano de obra." });
        elements.vehiculoDetalle.focus();
        return;
    }

    if (state.tasaBcv <= 0) {
        await Swal.fire({ icon: "warning", title: "Falta la tasa BCV", text: "Carga una tasa válida antes de guardar." });
        return;
    }

    const payload = {
        user_id: state.currentUser.id,
        user_email: state.currentUser.email,
        fecha: elements.fecha.value,
        categoria_id: selectedCategory.id || null,
        categoria_nombre: selectedCategory.nombre,
        numero_factura: cleanText(elements.numeroFactura.value),
        moneda,
        monto_usd: roundMoney(parseCurrency(elements.montoUsd.value)),
        tasa_bcv: Number(state.tasaBcv.toFixed(4)),
        monto_ves: roundMoney(parseCurrency(elements.montoVes.value)),
        descripcion: cleanText(elements.descripcion.value),
        responsable,
        comprobante_url: null
    };

    if (!payload.monto_usd && !payload.monto_ves) {
        await Swal.fire({ icon: "warning", title: "Monto requerido", text: "Ingresa el monto en USD o VES." });
        elements.montoUsd.focus();
        return;
    }

    setSubmitting(true);

    try {
        if (state.selectedFile) {
            payload.comprobante_url = await uploadReceipt(state.selectedFile);
        }

        const { data: insertedExpense, error } = await supabaseClient
            .from("gastos_operativos")
            .insert(payload)
            .select("id")
            .single();
        if (error) throw error;

        await handlePostSaveCategoryPersistence(insertedExpense?.id);
        elements.form.reset();
        resetFormState();
        await loadHistorico();
        activateTab("historico");
    } catch (error) {
        console.error(error);
        await Swal.fire({ icon: "error", title: "No se pudo guardar", text: error.message });
    } finally {
        setSubmitting(false);
    }
}

async function handlePostSaveCategoryPersistence(expenseId) {
    if (!state.tempCategory) {
        await Swal.fire({ icon: "success", title: "Gasto guardado", timer: 1400, showConfirmButton: false });
        return;
    }

    const categoryName = state.tempCategory.nombre;
    const result = await Swal.fire({
        icon: "question",
        title: "Gasto guardado",
        text: `¿Deseas guardar "${categoryName}" como categoría fija para futuros gastos?`,
        showDenyButton: true,
        confirmButtonText: "Sí, guardar categoría",
        denyButtonText: "No, solo este gasto"
    });

    if (!result.isConfirmed) {
        return;
    }

    try {
        const persistedCategory = await persistCategory(categoryName);

        if (expenseId && persistedCategory?.id) {
            const { error } = await supabaseClient
                .from("gastos_operativos")
                .update({ categoria_id: persistedCategory.id })
                .eq("id", expenseId);

            if (error) throw error;
        }

        await Swal.fire({ icon: "success", title: "Categoría guardada", timer: 1300, showConfirmButton: false });
    } catch (error) {
        console.error(error);
        await Swal.fire({ icon: "warning", title: "Gasto guardado", text: `El gasto se guardó, pero no pude conservar "${categoryName}" como categoría fija. ${error.message}` });
    }
}

async function persistCategory(nombre) {
    const existingCategory = state.categorias.find((categoria) => normalizeCategoryName(categoria.nombre) === normalizeCategoryName(nombre));

    if (existingCategory) {
        return existingCategory;
    }

    const { data, error } = await supabaseClient
        .from("categorias_gastos")
        .insert({ nombre })
        .select("id,nombre")
        .single();

    if (error) throw error;

    state.categorias = [...state.categorias, data];
    return data;
}

async function uploadReceipt(file) {
    const extension = file.name.includes(".") ? file.name.split(".").pop().toLowerCase() : "bin";
    const safeName = file.name
        .replace(/\.[^/.]+$/, "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9-_]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase() || "comprobante";
    const path = `${state.currentUser.id}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${safeName}.${extension}`;

    const { error } = await supabaseClient.storage.from(STORAGE_BUCKET).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || "application/octet-stream"
    });

    if (error) throw error;

    const { data } = supabaseClient.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    return data.publicUrl;
}

async function loadHistorico() {
    const from = elements.fromDate.value;
    const to = elements.toDate.value;

    let query = supabaseClient
        .from("gastos_operativos")
        .select("id,user_email,fecha,categoria_nombre,numero_factura,moneda,monto_usd,tasa_bcv,monto_ves,descripcion,responsable,comprobante_url,created_at")
        .order("fecha", { ascending: false })
        .order("created_at", { ascending: false });

    if (from) query = query.gte("fecha", from);
    if (to) query = query.lte("fecha", to);

    const { data, error } = await query.limit(500);

    if (error) {
        console.error(error);
        elements.historyList.innerHTML = '<div class="empty-state">No se pudo cargar el histórico.</div>';
        elements.historyCount.textContent = "Error";
        return;
    }

    state.historyRows = data || [];
    renderHistorico(state.historyRows);
}

function renderHistorico(rows) {
    elements.historyCount.textContent = `${rows.length} ${rows.length === 1 ? "registro" : "registros"}`;
    renderTotals(rows);

    if (!rows.length) {
        elements.historyList.classList.remove("has-records");
        elements.historyList.innerHTML = '<div class="empty-state">No hay gastos en este periodo.</div>';
        return;
    }

    elements.historyList.classList.add("has-records");

    const header = `
        <div class="expense-header" aria-hidden="true">
            <span>Fecha</span>
            <span>Categoría</span>
            <span>Factura</span>
            <span>Monto USD</span>
            <span>Monto VES</span>
            <span>Resp.</span>
            <span>Soporte</span>
            <span>Acción</span>
        </div>
    `;

    const items = rows.map((row) => `
        <article class="expense-row">
            <div><small>Fecha</small><strong>${formatDate(row.fecha)}</strong></div>
            <div class="wide category-cell"><small>Categoría</small><strong title="${escapeAttribute(row.categoria_nombre || "")}">${escapeHtml(row.categoria_nombre || "-")}</strong></div>
            <div><small>Factura</small><span>${escapeHtml(row.numero_factura || "-")}</span></div>
            <div class="amount-cell"><small>Monto</small><span class="money">$ ${formatNumber(row.monto_usd, 2)}</span><span class="money">Bs. ${formatNumber(row.monto_ves, 2)}</span></div>
            <div><small>Resp.</small><span>${escapeHtml(row.responsable || "-")}</span></div>
            <div><small>Soporte</small>${renderReceiptLink(row.comprobante_url)}</div>
            <div><small>Acción</small><button class="delete-expense-button" type="button" data-expense-id="${escapeAttribute(row.id)}">Eliminar</button></div>
        </article>
    `).join("");

    elements.historyList.innerHTML = header + items;
}

async function handleHistoryClick(event) {
    const deleteButton = event.target.closest(".delete-expense-button");
    if (!deleteButton) return;

    const row = state.historyRows.find((item) => item.id === deleteButton.dataset.expenseId);
    if (!row) return;

    const result = await Swal.fire({
        icon: "warning",
        title: "Eliminar gasto",
        text: "Se borrará este registro de prueba y su comprobante si existe.",
        showCancelButton: true,
        confirmButtonText: "Eliminar",
        cancelButtonText: "Cancelar",
        confirmButtonColor: "#DC2626"
    });

    if (!result.isConfirmed) return;

    deleteButton.disabled = true;
    deleteButton.textContent = "Eliminando...";

    try {
        const { data, error } = await supabaseClient
            .from("gastos_operativos")
            .delete()
            .eq("id", row.id)
            .select("id");

        if (error) throw error;

        if (!data || data.length === 0) {
            throw new Error("Supabase no eliminó el registro. Revisa que hayas ejecutado el SQL actualizado con la política de DELETE.");
        }

        try {
            await deleteReceiptFile(row.comprobante_url);
        } catch (storageError) {
            console.warn(storageError);
        }

        await Swal.fire({ icon: "success", title: "Registro eliminado", timer: 1300, showConfirmButton: false });
        await loadHistorico();
    } catch (error) {
        console.error(error);
        deleteButton.disabled = false;
        deleteButton.textContent = "Eliminar";
        await Swal.fire({ icon: "error", title: "No se pudo eliminar", text: error.message });
    }
}

async function deleteReceiptFile(url) {
    const path = getStoragePathFromPublicUrl(url);
    if (!path) return;

    const { error } = await supabaseClient.storage
        .from(STORAGE_BUCKET)
        .remove([path]);

    if (error) throw error;
}

function getStoragePathFromPublicUrl(url) {
    if (!url) return "";

    try {
        const parsedUrl = new URL(url);
        const publicPrefix = `/storage/v1/object/public/${STORAGE_BUCKET}/`;
        const index = parsedUrl.pathname.indexOf(publicPrefix);

        if (index === -1) return "";

        return decodeURIComponent(parsedUrl.pathname.slice(index + publicPrefix.length));
    } catch (error) {
        console.error(error);
        return "";
    }
}

function renderTotals(rows) {
    const totals = rows.reduce((acc, row) => {
        acc.usd += Number(row.monto_usd || 0);
        acc.ves += Number(row.monto_ves || 0);
        acc.receipts += row.comprobante_url ? 1 : 0;
        return acc;
    }, { usd: 0, ves: 0, receipts: 0 });

    elements.totalUsd.textContent = `$ ${formatNumber(totals.usd, 2)}`;
    elements.totalVes.textContent = `Bs. ${formatNumber(totals.ves, 2)}`;
    elements.totalReceipts.textContent = String(totals.receipts);
}

function renderReceiptLink(url) {
    if (!url) return "-";
    return `<a class="receipt-link" href="${escapeAttribute(url)}" target="_blank" rel="noopener">Ver</a>`;
}

function exportExcel() {
    if (!state.historyRows.length) {
        Swal.fire({ icon: "info", title: "Sin datos", text: "No hay gastos para exportar en este periodo." });
        return;
    }

    const rows = state.historyRows.map((row) => ({
        Fecha: formatDate(row.fecha),
        Categoria: row.categoria_nombre || "",
        Factura: row.numero_factura || "",
        Moneda: row.moneda || "",
        "Monto USD": Number(row.monto_usd || 0),
        "Tasa BCV": Number(row.tasa_bcv || 0),
        "Monto VES": Number(row.monto_ves || 0),
        Responsable: row.responsable || "",
        "Registrado por": row.user_email || "",
        Descripcion: row.descripcion || "",
        Comprobante: row.comprobante_url || ""
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet["!cols"] = [
        { wch: 12 }, { wch: 28 }, { wch: 18 }, { wch: 10 }, { wch: 12 }, { wch: 12 },
        { wch: 14 }, { wch: 16 }, { wch: 28 }, { wch: 36 }, { wch: 48 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Gastos");

    const filename = `reporte-gastos-${elements.fromDate.value || "inicio"}-a-${elements.toDate.value || "hoy"}.xlsx`;
    XLSX.writeFile(workbook, filename);
}

function setPeriodDates(period) {
    const today = new Date();
    const start = new Date(today);
    const end = new Date(today);

    if (period === "week") {
        const day = today.getDay() || 7;
        start.setDate(today.getDate() - day + 1);
    }

    if (period === "fortnight") {
        start.setDate(today.getDate() <= 15 ? 1 : 16);
    }

    if (period === "month") {
        start.setDate(1);
    }

    if (period === "custom") return;

    elements.fromDate.value = toDateInput(start);
    elements.toDate.value = toDateInput(end);
}

function resetFormState() {
    elements.fecha.value = toDateInput(new Date());
    elements.monedaUsd.checked = true;
    state.tempCategory = null;
    renderCategorias();
    elements.vehiculoDetalle.value = "";
    updateVehicleDetailVisibility();
    state.selectedFile = null;
    elements.comprobanteInput.value = "";
    elements.filePreview.classList.remove("is-visible");
    elements.filePreview.innerHTML = "";
}

function setSubmitting(isSubmitting) {
    elements.submitButton.disabled = isSubmitting;
    elements.submitButton.textContent = isSubmitting ? "Guardando..." : "Guardar gasto";
}

function parseCurrency(value) {
    const number = Number(String(value).replace(",", "."));
    return Number.isFinite(number) ? number : 0;
}

function roundMoney(value) {
    return Number((Number(value) || 0).toFixed(2));
}

function cleanText(value) {
    const text = value.trim();
    return text || null;
}

function toDateInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function formatNumber(value, decimals) {
    return Number(value || 0).toLocaleString("es-VE", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}

function formatDate(value) {
    if (!value) return "-";
    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year}`;
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, "&#096;");
}
