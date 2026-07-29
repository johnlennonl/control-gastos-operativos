const NEW_CATEGORY_VALUE = "__new_category__";
const TEMP_CATEGORY_VALUE = "__temp_category__";
const STATIC_CATEGORY_PREFIX = "static:";
const BCV_RATE_STORAGE_KEY = "gastos_operativos_tasa_bcv";
const BCV_EUR_RATE_STORAGE_KEY = "gastos_operativos_tasa_bcv_eur";
const BINANCE_RATE_STORAGE_KEY = "gastos_operativos_tasa_binance";
const EXPENSE_DRAFT_STORAGE_KEY = "gastos_operativos_borrador";
const BCV_REFRESH_INTERVAL_MS = 30 * 60 * 1000;
const PAYMENT_METHODS = {
    USD: ["Efectivo", "USDT", "Zelle", "Binance"],
    VES: ["Pago móvil", "Transferencia", "Punto de venta", "Efectivo Bs"]
};
const BASE_CATEGORIES = ["COMIDA", "HERRAMIENTAS", "MATERIALES", "EQUIPOS", "INSUMOS", "VEHICULOS"];
const VEHICLE_KILOMETER_DETAILS = ["GASOLINA", "CAMBIO DE ACEITE", "SERVICIOS"];
const HISTORY_SELECT_FULL = "id,user_email,fecha,categoria_nombre,numero_factura,moneda,forma_pago,tipo_tasa,monto_usd,tasa_bcv,monto_ves,vehiculo_nombre,vehiculo_placa,kilometraje,litros_gasolina,detalle_actividad,descripcion,responsable,comprobante_url,created_at";
const HISTORY_SELECT_LEGACY = "id,user_email,fecha,categoria_nombre,numero_factura,moneda,forma_pago,tipo_tasa,monto_usd,tasa_bcv,monto_ves,kilometraje,detalle_actividad,descripcion,responsable,comprobante_url,created_at";
const VEHICLES = [
    { name: "Gran Vitara", plate: "AFN06W" },
    { name: "Kaicene", plate: "A24AY7C" },
    { name: "Hunter", plate: "A87BD3J" },
    { name: "Silverado", plate: "A95A01A" },
    { name: "Cruze", plate: "AD286ZG" }
];
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
    tasaBcvEur: 0,
    tasaBinance: 0,
    categorias: [],
    selectedFile: null,
    tempCategory: null,
    syncingMoney: false,
    restoringDraft: false,
    lastMoneyInput: "USD",
    switchingTab: false,
    currentUser: null,
    currentUserName: "",
    userRole: "operador",
    isAdmin: false,
    historyRows: []
};

const elements = {
    form: document.querySelector("#expenseForm"),
    fecha: document.querySelector("#fecha"),
    categoria: document.querySelector("#categoria"),
    deleteCategoryButton: document.querySelector("#deleteCategoryButton"),
    vehiculoUnidadField: document.querySelector("#vehiculoUnidadField"),
    vehiculoUnidad: document.querySelector("#vehiculoUnidad"),
    vehiculoDetalleField: document.querySelector("#vehiculoDetalleField"),
    vehiculoDetalle: document.querySelector("#vehiculoDetalle"),
    contextDetailSection: document.querySelector("#contextDetailSection"),
    vehiculoKilometrajeField: document.querySelector("#vehiculoKilometrajeField"),
    kilometraje: document.querySelector("#kilometraje"),
    litrosGasolinaField: document.querySelector("#litrosGasolinaField"),
    litrosGasolina: document.querySelector("#litrosGasolina"),
    comidaDetalleField: document.querySelector("#comidaDetalleField"),
    comidaDetalle: document.querySelector("#comidaDetalle"),
    montoUsd: document.querySelector("#montoUsd"),
    montoVes: document.querySelector("#montoVes"),
    moneySection: document.querySelector("#moneySection"),
    moneyGrid: document.querySelector("#moneyGrid"),
    moneySectionLabel: document.querySelector("#moneySectionLabel"),
    montoUsdWrap: document.querySelector("#montoUsdWrap"),
    montoVesWrap: document.querySelector("#montoVesWrap"),
    montoBaseLabel: document.querySelector("#montoBaseLabel"),
    rateSection: document.querySelector("#rateSection"),
    monedaUsd: document.querySelector("#monedaUsd"),
    monedaVes: document.querySelector("#monedaVes"),
    formaPago: document.querySelector("#formaPago"),
    tipoTasa: document.querySelector("#tipoTasa"),
    tasaCambio: document.querySelector("#tasaCambio"),
    numeroFactura: document.querySelector("#numeroFactura"),
    descripcion: document.querySelector("#descripcion"),
    comprobanteInput: document.querySelector("#comprobanteInput"),
    dropZone: document.querySelector("#dropZone"),
    filePreview: document.querySelector("#filePreview"),
    historyList: document.querySelector("#historyList"),
    historyCount: document.querySelector("#historyCount"),
    submitButton: document.querySelector("#submitButton"),
    logoutButton: document.querySelector("#logoutButton"),
    reloadAppButton: document.querySelector("#reloadAppButton"),
    profileButton: document.querySelector("#profileButton"),
    userEmail: document.querySelector("#userEmail"),
    periodFilter: document.querySelector("#periodFilter"),
    fromDate: document.querySelector("#fromDate"),
    toDate: document.querySelector("#toDate"),
    refreshButton: document.querySelector("#refreshButton"),
    exportButton: document.querySelector("#exportButton"),
    totalUsd: document.querySelector("#totalUsd"),
    totalVes: document.querySelector("#totalVes"),
    totalReceipts: document.querySelector("#totalReceipts"),
    pageLoader: document.querySelector("#pageLoader"),
    tabButtons: document.querySelectorAll(".module-tab"),
    modulePanels: document.querySelectorAll(".module-panel")
};

document.addEventListener("DOMContentLoaded", init);

function showPageLoader() {
    elements.pageLoader.classList.add("is-visible");
    elements.pageLoader.setAttribute("aria-hidden", "false");
}

function hidePageLoader() {
    elements.pageLoader.classList.remove("is-visible");
    elements.pageLoader.setAttribute("aria-hidden", "true");
}

async function loadCurrentUserRole() {
    const metadataRole = state.currentUser?.app_metadata?.rol || state.currentUser?.user_metadata?.rol;

    if (metadataRole === "admin") {
        setUserRole("admin");
        return;
    }

    try {
        const { data, error } = await supabaseClient
            .from("usuarios_roles")
            .select("rol")
            .eq("user_id", state.currentUser.id)
            .maybeSingle();

        if (error) throw error;
        setUserRole(data?.rol || "operador");
    } catch (error) {
        console.error(error);
        setUserRole("operador");
    }
}

async function loadCurrentUserProfile() {
    try {
        const { data, error } = await supabaseClient
            .from("usuarios_perfiles")
            .select("nombre")
            .eq("user_id", state.currentUser.id)
            .maybeSingle();

        if (error) throw error;
        state.currentUserName = data?.nombre || "";
        updateUserChip();
    } catch (error) {
        console.error(error);
        state.currentUserName = "";
        updateUserChip();
    }
}

async function openProfileModal() {
    const result = await Swal.fire({
        title: "",
        customClass: { popup: "profile-modal-popup" },
        html: `
            <section class="profile-modal-card">
                <div class="profile-modal-head">
                    <span class="profile-modal-kicker">Cuenta</span>
                    <h2>Perfil y seguridad</h2>
                    <p>Actualiza tu nombre visible o cambia tu contraseña cuando lo necesites.</p>
                </div>
                <div class="profile-modal-body">
                    <div class="profile-email-chip">
                        <span>Correo de acceso</span>
                        <strong>${escapeHtml(state.currentUser.email || "Usuario activo")}</strong>
                    </div>
                    <div class="profile-fields-grid">
                        <div class="profile-field profile-field--full">
                            <label for="swalDisplayName">Nombre visible <span>(opcional)</span></label>
                            <input id="swalDisplayName" type="text" autocomplete="name" placeholder="Nombre visible" value="${escapeAttribute(state.currentUserName)}">
                        </div>
                        <div class="profile-field">
                            <label for="swalPassword">Nueva contraseña <span>(opcional)</span></label>
                            <input id="swalPassword" type="password" autocomplete="new-password" placeholder="Mínimo 6 caracteres">
                        </div>
                        <div class="profile-field">
                            <label for="swalPasswordConfirm">Confirmar contraseña</label>
                            <input id="swalPasswordConfirm" type="password" autocomplete="new-password" placeholder="Repite la contraseña">
                        </div>
                    </div>
                </div>
            </section>
        `,
        showCancelButton: true,
        confirmButtonText: "Guardar cambios",
        cancelButtonText: "Configurar luego",
        focusConfirm: false,
        didOpen: () => document.querySelector("#swalDisplayName")?.focus(),
        preConfirm: () => {
            const nombre = document.querySelector("#swalDisplayName").value.trim().replace(/\s+/g, " ");
            const password = document.querySelector("#swalPassword").value;
            const passwordConfirm = document.querySelector("#swalPasswordConfirm").value;

            if (nombre && nombre.length < 2) {
                Swal.showValidationMessage("El nombre debe tener al menos 2 caracteres.");
                return false;
            }

            if ((password || passwordConfirm) && password.length < 6) {
                Swal.showValidationMessage("La contraseña debe tener al menos 6 caracteres.");
                return false;
            }

            if (password !== passwordConfirm) {
                Swal.showValidationMessage("Las contraseñas no coinciden.");
                return false;
            }

            return { nombre, password };
        }
    });

    if (!result.isConfirmed) return;

    try {
        if (result.value.nombre) {
            const { error } = await supabaseClient
                .from("usuarios_perfiles")
                .upsert({
                    user_id: state.currentUser.id,
                    email: state.currentUser.email,
                    nombre: result.value.nombre,
                    updated_at: new Date().toISOString()
                }, { onConflict: "user_id" });

            if (error) throw error;
            state.currentUserName = result.value.nombre;
            updateUserChip();
        }

        if (result.value.password) {
            const { error } = await supabaseClient.auth.updateUser({ password: result.value.password });
            if (error) throw error;
        }

        await Swal.fire({ icon: "success", title: "Perfil actualizado", timer: 1300, showConfirmButton: false });
    } catch (error) {
        console.error(error);
        await Swal.fire({ icon: "error", title: "No se pudo guardar", text: error.message });
    }
}

function setUserRole(role) {
    state.userRole = role === "admin" ? "admin" : "operador";
    state.isAdmin = state.userRole === "admin";
    updateUserChip();
    syncAdminAccess();
}

function syncAdminAccess() {
    const historyTab = Array.from(elements.tabButtons).find((button) => button.dataset.tabTarget === "historico");

    if (historyTab) {
        historyTab.hidden = !state.isAdmin;
        historyTab.disabled = !state.isAdmin;
    }

    const historyPanel = Array.from(elements.modulePanels).find((panel) => panel.dataset.panel === "historico");
    if (!state.isAdmin && historyPanel) {
        historyPanel.hidden = true;
        historyPanel.classList.remove("is-active", "is-entering", "is-leaving");
        activateTab("nuevo-gasto");
    }

    elements.exportButton.hidden = !state.isAdmin;
    elements.exportButton.disabled = !state.isAdmin;
    elements.exportButton.title = state.isAdmin ? "" : "Solo administrador";
}

function updateUserChip() {
    elements.userEmail.textContent = state.currentUserName || state.currentUser?.email || "Usuario activo";
    elements.profileButton.title = "Perfil";
}

async function init() {
    showPageLoader();
    const { data, error } = await supabaseClient.auth.getSession();

    if (error || !data.session) {
        showPageLoader();
        window.location.href = "index.html";
        return;
    }

    state.currentUser = data.session.user;
    elements.userEmail.textContent = state.currentUser.email || "Usuario activo";
    await loadCurrentUserRole();
    await loadCurrentUserProfile();
    elements.fecha.value = toDateInput(new Date());
    state.tasaBinance = Number(localStorage.getItem(BINANCE_RATE_STORAGE_KEY)) || 0;
    renderPaymentMethods("USD");
    syncPaymentMode();
    syncRateTypeToPayment(false);

    bindEvents();
    setPeriodDates("month");

    const startupTasks = [loadBcvRate(), loadBcvEuroRate(), loadCategorias()];
    if (state.isAdmin) {
        startupTasks.push(loadHistorico());
    }

    await Promise.all(startupTasks);

    restoreExpenseDraft();

    setupBcvAutoRefresh();
    hidePageLoader();
}

function bindEvents() {
    elements.tabButtons.forEach((button) => {
        button.addEventListener("click", () => activateTab(button.dataset.tabTarget));
    });
    elements.profileButton.addEventListener("click", () => openProfileModal());
    elements.reloadAppButton.addEventListener("click", reloadPlatform);
    elements.logoutButton.addEventListener("click", logout);
    elements.categoria.addEventListener("change", handleCategoryChange);
    elements.deleteCategoryButton.addEventListener("click", deleteSelectedCategory);
    elements.vehiculoUnidad.addEventListener("change", () => {
        if (elements.categoria.value) {
            elements.categoria.dataset.previous = elements.categoria.value;
        }
        elements.vehiculoDetalle.value = "";
        updateVehicleDetailVisibility();
        updateContextDetailVisibility();
    });
    elements.vehiculoDetalle.addEventListener("change", () => {
        if (elements.categoria.value) {
            elements.categoria.dataset.previous = elements.categoria.value;
        }

        updateContextDetailVisibility();
    });
    elements.monedaUsd.addEventListener("change", handleCurrencyModeChange);
    elements.monedaVes.addEventListener("change", handleCurrencyModeChange);
    elements.formaPago.addEventListener("change", handlePaymentMethodChange);
    elements.tipoTasa.addEventListener("change", handleRateTypeChange);
    elements.tasaCambio.addEventListener("input", handleRateInput);
    elements.montoUsd.addEventListener("input", () => syncMoney("USD"));
    elements.montoVes.addEventListener("input", () => syncMoney("VES"));
    elements.form.addEventListener("submit", saveExpense);
    elements.form.addEventListener("input", saveExpenseDraft);
    elements.form.addEventListener("change", saveExpenseDraft);
    elements.form.addEventListener("reset", () => {
        clearExpenseDraft();
        setTimeout(resetFormState, 0);
    });
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

async function activateTab(target) {
    if (state.switchingTab) return;
    if (target === "historico" && !state.isAdmin) return;

    const currentPanel = Array.from(elements.modulePanels).find((panel) => !panel.hidden);
    const nextPanel = Array.from(elements.modulePanels).find((panel) => panel.dataset.panel === target);

    if (!nextPanel || currentPanel === nextPanel) return;

    elements.tabButtons.forEach((button) => {
        const isActive = button.dataset.tabTarget === target;
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-selected", String(isActive));
    });

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduceMotion) {
        currentPanel.hidden = true;
        currentPanel.classList.remove("is-active");
        nextPanel.hidden = false;
        nextPanel.classList.add("is-active");
        return;
    }

    state.switchingTab = true;
    currentPanel.classList.add("is-leaving");
    await delay(160);
    currentPanel.hidden = true;
    currentPanel.classList.remove("is-active", "is-leaving");

    nextPanel.hidden = false;
    nextPanel.classList.add("is-active", "is-entering");
    requestAnimationFrame(() => {
        nextPanel.classList.remove("is-entering");
        state.switchingTab = false;
    });
}

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function logout() {
    showPageLoader();
    await supabaseClient.auth.signOut();
    window.location.href = "index.html";
}

function reloadPlatform() {
    showPageLoader();
    const url = new URL(window.location.href);
    url.searchParams.set("refresh", String(Date.now()));
    window.location.replace(url.toString());
}

function setupBcvAutoRefresh() {
    setInterval(() => {
        loadBcvRate({ silent: true });
        loadBcvEuroRate({ silent: true });
    }, BCV_REFRESH_INTERVAL_MS);

    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) {
            loadBcvRate({ silent: true });
            loadBcvEuroRate({ silent: true });
        }
    });
}

async function loadBcvRate(options = {}) {
    const { silent = false } = options;
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

        if (state.tasaBcv > 0 || silent) {
            return;
        }

        return;
    }
}

async function loadBcvEuroRate(options = {}) {
    const { silent = false } = options;
    const savedRate = Number(localStorage.getItem(BCV_EUR_RATE_STORAGE_KEY));

    if (Number.isFinite(savedRate) && savedRate > 0) {
        setBcvEuroRate(savedRate);
    }

    try {
        const response = await fetch("https://ve.dolarapi.com/v1/euros/oficial", { cache: "no-store" });
        if (!response.ok) throw new Error("No se pudo consultar la tasa oficial del euro.");

        const data = await response.json();
        const rate = Number(data.promedio);
        if (!Number.isFinite(rate) || rate <= 0) throw new Error("La tasa BCV Euro recibida no es válida.");

        setBcvEuroRate(rate);
        localStorage.setItem(BCV_EUR_RATE_STORAGE_KEY, String(rate));
    } catch (error) {
        console.error(error);

        if (state.tasaBcvEur > 0 || silent) {
            return;
        }

        return;
    }
}

function setBcvEuroRate(rate) {
    state.tasaBcvEur = Number(rate) || 0;
    if (elements.tipoTasa.value === "BCV_EUR") {
        updateRateField();
    }
}

function setBcvRate(rate) {
    state.tasaBcv = Number(rate) || 0;
    if (elements.tipoTasa.value === "BCV_USD" || elements.tipoTasa.value === "BCV") {
        updateRateField();
    }

    syncCurrentMoney();
}

function handleCurrencyModeChange() {
    const moneda = getSelectedCurrency();
    renderPaymentMethods(moneda);
    syncPaymentMode();
    syncRateTypeToPayment();
}

function handlePaymentMethodChange() {
    syncPaymentMode();
    syncRateTypeToPayment();
}

function handleRateTypeChange() {
    if (getSelectedCurrency() !== "VES" && elements.tipoTasa.value === "BINANCE") {
        elements.tipoTasa.value = "BCV_USD";
    }

    updateRateField();
}

function handleRateInput() {
    const rate = parseCurrency(elements.tasaCambio.value);

    syncCurrentMoney();
}

function renderPaymentMethods(moneda, preferredValue = elements.formaPago.value) {
    const methods = PAYMENT_METHODS[moneda] || [];
    elements.formaPago.innerHTML = methods.map((method) => `<option value="${escapeAttribute(method)}">${escapeHtml(method)}</option>`).join("");

    if (methods.includes(preferredValue)) {
        elements.formaPago.value = preferredValue;
    }
}

function getAllPaymentMethods() {
    return [...new Set([...PAYMENT_METHODS.USD, ...PAYMENT_METHODS.VES])];
}

function isUsdtPayment() {
    return getSelectedCurrency() === "USD" && elements.formaPago.value === "USDT";
}

function syncRateTypeToPayment(syncAmounts = true) {
    if (getSelectedCurrency() !== "VES") {
        elements.tipoTasa.innerHTML = '<option value="DIRECTO">Pago directo</option>';
        elements.tipoTasa.value = "DIRECTO";
        elements.tasaCambio.value = "";
        elements.tasaCambio.readOnly = true;
        updateMoneyBaseLabel();
        return;
    }

    const currentType = elements.tipoTasa.value;
    const selectedType = ["BCV_EUR", "MANUAL"].includes(currentType) ? currentType : "BCV_USD";

    renderRateTypeOptions(selectedType);
    updateRateField(syncAmounts);
}

function renderRateTypeOptions(selectedType) {
    const options = [
        { value: "BCV_USD", label: "BCV Dólar" },
        { value: "BCV_EUR", label: "BCV Euro" },
        { value: "MANUAL", label: "Manual" }
    ];

    elements.tipoTasa.innerHTML = options
        .map((option) => `<option value="${option.value}">${option.label}</option>`)
        .join("");
    elements.tipoTasa.value = selectedType;
}

function updateRateField(syncAmounts = true) {
    const tipoTasa = elements.tipoTasa.value;

    if (getSelectedCurrency() !== "VES") {
        elements.tasaCambio.value = "";
        elements.tasaCambio.readOnly = true;
    } else if (tipoTasa === "BCV_USD" || tipoTasa === "BCV") {
        elements.tasaCambio.value = state.tasaBcv > 0 ? state.tasaBcv.toFixed(4) : "";
        elements.tasaCambio.readOnly = true;
    } else if (tipoTasa === "BCV_EUR") {
        elements.tasaCambio.value = state.tasaBcvEur > 0 ? state.tasaBcvEur.toFixed(4) : "";
        elements.tasaCambio.readOnly = true;
    } else if (tipoTasa === "MANUAL") {
        elements.tasaCambio.readOnly = false;
    } else if (tipoTasa === "BINANCE") {
        elements.tasaCambio.value = state.tasaBinance > 0 ? state.tasaBinance.toFixed(4) : "";
        elements.tasaCambio.readOnly = false;
    } else {
        elements.tasaCambio.value = "";
        elements.tasaCambio.readOnly = false;
    }

    updateMoneyBaseLabel();

    if (syncAmounts) {
        syncCurrentMoney();
    }
}

function getSelectedCurrency() {
    return document.querySelector('input[name="moneda"]:checked')?.value || "USD";
}

function updateMoneyInputLock() {
    const usdActive = getSelectedCurrency() === "USD";

    elements.rateSection.classList.toggle("is-hidden", usdActive);
    elements.moneySection.classList.toggle("is-direct", usdActive);
    elements.moneyGrid.classList.toggle("is-single", usdActive);
    elements.montoVesWrap.classList.toggle("is-hidden", usdActive);
    elements.moneySectionLabel.textContent = usdActive ? "Monto pagado" : "Calculadora divisa / VES";
    elements.montoUsd.readOnly = false;
    elements.montoVes.readOnly = usdActive;
    elements.montoUsdWrap.classList.toggle("is-calculated", false);
    elements.montoVesWrap.classList.toggle("is-calculated", usdActive);

    if (usdActive) {
        elements.montoVes.value = "";
    }
}

function updateMoneyBaseLabel() {
    elements.montoBaseLabel.textContent = elements.tipoTasa.value === "BCV_EUR" && getSelectedCurrency() === "VES" ? "EUR" : "USD";
}

function syncPaymentMode() {
    updateMoneyInputLock();
    updateMoneyBaseLabel();
}

function getActiveRate() {
    return parseCurrency(elements.tasaCambio.value);
}

function getRateTypeLabel(tipoTasa) {
    const labels = {
        BCV: "BCV Dólar",
        BCV_USD: "BCV Dólar",
        BCV_EUR: "BCV Euro",
        BINANCE: "Binance / USDT",
        DIRECTO: "Pago directo",
        MANUAL: "Manual"
    };

    return labels[tipoTasa] || "BCV Dólar";
}

function normalizeRateType(tipoTasa) {
    return tipoTasa === "BCV" || !tipoTasa ? "BCV_USD" : tipoTasa;
}

function getMoneyUnit(tipoTasa) {
    return normalizeRateType(tipoTasa) === "BCV_EUR" ? "EUR" : "USD";
}

function getRateDisplay(row) {
    if (row.tipo_tasa === "DIRECTO") {
        return "Sin conversión";
    }

    return `${getRateTypeLabel(row.tipo_tasa)} · ${formatNumber(row.tasa_bcv, 4)}`;
}

function syncCurrentMoney() {
    const moneda = getSelectedCurrency();

    if (moneda === "USD" && elements.montoUsd.value) {
        syncMoney("USD");
    } else if (moneda === "VES" && state.lastMoneyInput === "USD" && elements.montoUsd.value) {
        syncMoney("USD");
    } else if (moneda === "VES" && elements.montoVes.value) {
        syncMoney("VES");
    } else if (elements.montoUsd.value) {
        syncMoney("USD");
    } else if (elements.montoVes.value) {
        syncMoney("VES");
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
    renderVehicleOptions();
    updateVehicleDetailVisibility();
    updateContextDetailVisibility();
    updateCategoryActions();
}

function renderVehicleOptions() {
    const currentValue = elements.vehiculoUnidad.value;
    elements.vehiculoUnidad.innerHTML = [
        '<option value="">Selecciona el vehículo</option>',
        ...VEHICLES.map((vehicle) => `<option value="${escapeAttribute(vehicle.plate)}">${escapeHtml(vehicle.name)} - ${escapeHtml(vehicle.plate)}</option>`)
    ].join("");
    elements.vehiculoUnidad.value = VEHICLES.some((vehicle) => vehicle.plate === currentValue) ? currentValue : "";
}

function getSelectedVehicle() {
    return VEHICLES.find((vehicle) => vehicle.plate === elements.vehiculoUnidad.value) || null;
}

async function handleCategoryChange() {
    if (elements.categoria.value === NEW_CATEGORY_VALUE) {
        await createCategoryModal();
        return;
    }

    elements.categoria.dataset.previous = elements.categoria.value;
    updateVehicleDetailVisibility();
    updateContextDetailVisibility();
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
        updateContextDetailVisibility();
        updateCategoryActions();
        return;
    }

    state.tempCategory = { id: null, nombre: result.value.nombre };
    renderCategorias(TEMP_CATEGORY_VALUE);
    elements.categoria.dataset.previous = TEMP_CATEGORY_VALUE;
    saveExpenseDraft();
    await Swal.fire({ icon: "success", title: "Ítem temporal listo", text: "Después de guardar el gasto te preguntaré si deseas conservarlo como categoría fija.", timer: 1800, showConfirmButton: false });
}

function getSelectedCategory() {
    const value = elements.categoria.value;

    if (value.startsWith(STATIC_CATEGORY_PREFIX)) {
        const nombre = value.replace(STATIC_CATEGORY_PREFIX, "");
        if (nombre === "VEHICULOS" && elements.vehiculoDetalle.value) {
            const vehicle = getSelectedVehicle();
            const vehicleLabel = vehicle ? `${vehicle.name} ${vehicle.plate}` : "SIN VEHICULO";
            return { id: null, nombre: `${nombre} - ${vehicleLabel} - ${elements.vehiculoDetalle.value}` };
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
    const hasVehicle = Boolean(elements.vehiculoUnidad.value);
    elements.vehiculoUnidadField.classList.toggle("is-hidden", !isVehicle);
    elements.vehiculoDetalleField.classList.toggle("is-hidden", !isVehicle || !hasVehicle);

    if (!isVehicle) {
        elements.vehiculoUnidad.value = "";
        elements.vehiculoDetalle.value = "";
    } else if (!hasVehicle) {
        elements.vehiculoDetalle.value = "";
    }

    updateContextDetailVisibility();
}

function updateContextDetailVisibility() {
    const needsKilometraje = shouldAskKilometraje();
    const needsLitrosGasolina = shouldAskLitrosGasolina();
    const needsComidaDetalle = shouldAskComidaDetalle();

    elements.contextDetailSection.classList.toggle("is-hidden", !needsKilometraje && !needsLitrosGasolina && !needsComidaDetalle);
    elements.vehiculoKilometrajeField.classList.toggle("is-hidden", !needsKilometraje);
    elements.litrosGasolinaField.classList.toggle("is-hidden", !needsLitrosGasolina);
    elements.comidaDetalleField.classList.toggle("is-hidden", !needsComidaDetalle);
    elements.kilometraje.required = needsKilometraje;
    elements.comidaDetalle.required = needsComidaDetalle;

    if (!needsKilometraje) {
        elements.kilometraje.value = "";
    }

    if (!needsLitrosGasolina) {
        elements.litrosGasolina.value = "";
    }

    if (!needsComidaDetalle) {
        elements.comidaDetalle.value = "";
    }
}

function shouldAskKilometraje() {
    return elements.categoria.value === `${STATIC_CATEGORY_PREFIX}VEHICULOS` && VEHICLE_KILOMETER_DETAILS.includes(elements.vehiculoDetalle.value);
}

function shouldAskLitrosGasolina() {
    return elements.categoria.value === `${STATIC_CATEGORY_PREFIX}VEHICULOS` && elements.vehiculoDetalle.value === "GASOLINA";
}

function shouldAskComidaDetalle() {
    const selectedCategory = getSelectedCategory();
    return normalizeCategoryName(selectedCategory?.nombre || "") === "comida";
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
    if (state.syncingMoney) return;

    state.syncingMoney = true;
    state.lastMoneyInput = source;

    if (source === "VES") {
        elements.monedaVes.checked = true;
        renderPaymentMethods("VES");
    } else if (getSelectedCurrency() === "USD") {
        elements.monedaUsd.checked = true;
        renderPaymentMethods("USD");
    }

    updateMoneyInputLock();
    syncRateTypeToPayment(false);

    const activeRate = getActiveRate();
    if (activeRate <= 0) {
        state.syncingMoney = false;
        return;
    }

    if (source === "USD") {
        const usd = parseCurrency(elements.montoUsd.value);
        elements.montoVes.value = usd > 0 ? (usd * activeRate).toFixed(2) : "";
    } else {
        const ves = parseCurrency(elements.montoVes.value);
        elements.montoUsd.value = ves > 0 ? (ves / activeRate).toFixed(2) : "";
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
    const moneda = getSelectedCurrency();
    const usesRate = moneda === "VES";
    const activeRate = getActiveRate();

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

    const selectedVehicle = getSelectedVehicle();

    if (elements.categoria.value === `${STATIC_CATEGORY_PREFIX}VEHICULOS` && !selectedVehicle) {
        await Swal.fire({ icon: "warning", title: "Vehículo requerido", text: "Selecciona el vehículo o placa asociado al gasto." });
        elements.vehiculoUnidad.focus();
        return;
    }

    if (elements.categoria.value === `${STATIC_CATEGORY_PREFIX}VEHICULOS` && !elements.vehiculoDetalle.value) {
        await Swal.fire({ icon: "warning", title: "Detalle de vehículo requerido", text: "Selecciona si fue gasolina, pieza mecánica, cambio de aceite, servicios o mano de obra." });
        elements.vehiculoDetalle.focus();
        return;
    }

    if (shouldAskKilometraje() && parseCurrency(elements.kilometraje.value) <= 0) {
        await Swal.fire({ icon: "warning", title: "Kilometraje requerido", text: "Ingresa el kilometraje actual para este gasto de vehículo." });
        elements.kilometraje.focus();
        return;
    }

    if (shouldAskComidaDetalle() && !elements.comidaDetalle.value) {
        await Swal.fire({ icon: "warning", title: "Detalle de comida requerido", text: "Indica si corresponde a Jornada Laboral UVS o Evento." });
        elements.comidaDetalle.focus();
        return;
    }

    if (usesRate && activeRate <= 0) {
        await Swal.fire({ icon: "warning", title: "Falta la tasa", text: "Carga una tasa válida antes de guardar." });
        elements.tasaCambio.focus();
        return;
    }

    const montoDivisa = roundMoney(parseCurrency(elements.montoUsd.value));
    const montoVes = usesRate ? roundMoney(parseCurrency(elements.montoVes.value)) : 0;

    if (usesRate && !montoVes) {
        await Swal.fire({ icon: "warning", title: "Monto requerido", text: "Ingresa el monto pagado en bolívares." });
        elements.montoVes.focus();
        return;
    }

    if (!usesRate && !montoDivisa) {
        await Swal.fire({ icon: "warning", title: "Monto requerido", text: "Ingresa el monto pagado en USD." });
        elements.montoUsd.focus();
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
        forma_pago: elements.formaPago.value,
        tipo_tasa: usesRate ? elements.tipoTasa.value : "DIRECTO",
        monto_usd: montoDivisa,
        tasa_bcv: usesRate ? Number(activeRate.toFixed(4)) : 0,
        monto_ves: montoVes,
        vehiculo_nombre: selectedVehicle?.name || null,
        vehiculo_placa: selectedVehicle?.plate || null,
        kilometraje: shouldAskKilometraje() ? Math.round(parseCurrency(elements.kilometraje.value)) : null,
        litros_gasolina: shouldAskLitrosGasolina() && parseCurrency(elements.litrosGasolina.value) > 0 ? roundMoney(parseCurrency(elements.litrosGasolina.value)) : null,
        detalle_actividad: shouldAskComidaDetalle() ? elements.comidaDetalle.value : null,
        descripcion: cleanText(elements.descripcion.value),
        responsable,
        comprobante_url: null
    };

    setSubmitting(true);

    try {
        if (state.selectedFile) {
            payload.comprobante_url = await uploadReceipt(state.selectedFile);
        }

        const { data: insertedExpense, error } = await insertExpenseWithSchemaFallback(payload);
        if (error) throw error;

        await handlePostSaveCategoryPersistence(insertedExpense?.id);
        clearExpenseDraft();
        elements.form.reset();
        resetFormState();
        if (state.isAdmin) {
            await loadHistorico();
            activateTab("historico");
        }
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
    if (!state.isAdmin) {
        state.historyRows = [];
        return;
    }

    const from = elements.fromDate.value;
    const to = elements.toDate.value;

    let query = supabaseClient
        .from("gastos_operativos")
        .select(HISTORY_SELECT_FULL)
        .order("fecha", { ascending: false })
        .order("created_at", { ascending: false });

    if (from) query = query.gte("fecha", from);
    if (to) query = query.lte("fecha", to);

    let { data, error } = await query.limit(500);

    if (isSchemaCacheColumnError(error)) {
        let legacyQuery = supabaseClient
            .from("gastos_operativos")
            .select(HISTORY_SELECT_LEGACY)
            .order("fecha", { ascending: false })
            .order("created_at", { ascending: false });

        if (from) legacyQuery = legacyQuery.gte("fecha", from);
        if (to) legacyQuery = legacyQuery.lte("fecha", to);

        const legacyResult = await legacyQuery.limit(500);
        data = legacyResult.data;
        error = legacyResult.error;
    }

    if (error) {
        console.error(error);
        elements.historyList.innerHTML = '<div class="empty-state">No se pudo cargar el histórico.</div>';
        elements.historyCount.textContent = "Error";
        return;
    }

    state.historyRows = data || [];
    renderHistorico(state.historyRows);
}

async function insertExpenseWithSchemaFallback(payload) {
    const result = await supabaseClient
        .from("gastos_operativos")
        .insert(payload)
        .select("id")
        .single();

    if (!isSchemaCacheColumnError(result.error)) {
        return result;
    }

    const legacyPayload = { ...payload };
    delete legacyPayload.vehiculo_nombre;
    delete legacyPayload.vehiculo_placa;
    delete legacyPayload.litros_gasolina;

    return supabaseClient
        .from("gastos_operativos")
        .insert(legacyPayload)
        .select("id")
        .single();
}

function isSchemaCacheColumnError(error) {
    if (!error) return false;
    const text = `${error.code || ""} ${error.message || ""} ${error.details || ""}`.toLowerCase();
    return text.includes("pgrst204") || text.includes("schema cache") || text.includes("litros_gasolina") || text.includes("vehiculo_nombre") || text.includes("vehiculo_placa");
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

    const items = rows.map((row) => {
        const title = getExpenseTitle(row);
        const subtitle = [formatDate(row.fecha), row.responsable || "Sin responsable", row.forma_pago || "Sin pago"].filter(Boolean).join(" · ");
        const operationalDetail = getOperationalDetail(row);
        const hasReceipt = Boolean(row.comprobante_url);

        return `
            <article class="expense-card">
                <div class="expense-card-main">
                    <div class="expense-card-head">
                        <div class="expense-title-wrap">
                            <span class="expense-date">${formatDate(row.fecha)}</span>
                            <h3 title="${escapeAttribute(row.categoria_nombre || "")}">${escapeHtml(title)}</h3>
                            <p>${escapeHtml(subtitle)}</p>
                        </div>
                        <div class="expense-amounts" aria-label="Monto del gasto">
                            <strong>${getMoneyUnit(row.tipo_tasa)} ${formatNumber(row.monto_usd, 2)}</strong>
                            <span>Bs. ${formatNumber(row.monto_ves, 2)}</span>
                        </div>
                    </div>

                    <div class="expense-facts">
                        <div><span>Factura</span><strong>${escapeHtml(row.numero_factura || "Sin factura")}</strong></div>
                        <div><span>Tasa</span><strong>${escapeHtml(getRateDisplay(row))}</strong></div>
                        <div><span>Detalle operativo</span><strong>${escapeHtml(operationalDetail)}</strong></div>
                        <div><span>Soporte</span><strong class="${hasReceipt ? "support-ok" : "support-missing"}">${hasReceipt ? "Disponible" : "Sin soporte"}</strong></div>
                    </div>
                </div>

                <div class="expense-card-actions">
                    ${hasReceipt ? renderReceiptLink(row.comprobante_url) : '<span class="receipt-placeholder">Sin comprobante</span>'}
                    <button class="edit-expense-button" type="button" data-expense-id="${escapeAttribute(row.id)}"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>Editar</button>
                    <button class="delete-expense-button" type="button" data-expense-id="${escapeAttribute(row.id)}"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M6 6l1 15h10l1-15"/></svg>Eliminar</button>
                </div>
            </article>
        `;
    }).join("");

    elements.historyList.innerHTML = items;
}

function getExpenseTitle(row) {
    const category = row.categoria_nombre || "Gasto operativo";
    if (row.vehiculo_nombre || row.vehiculo_placa) {
        const vehicle = [row.vehiculo_nombre, row.vehiculo_placa].filter(Boolean).join(" ");
        const detail = category.split(" - ").pop();
        return `${vehicle}${detail && detail !== category ? ` · ${detail}` : ""}`;
    }

    return category;
}

async function handleHistoryClick(event) {
    const editButton = event.target.closest(".edit-expense-button");
    if (editButton) {
        const row = state.historyRows.find((item) => item.id === editButton.dataset.expenseId);
        if (row) await editExpense(row);
        return;
    }

    const deleteButton = event.target.closest(".delete-expense-button");
    if (!deleteButton) return;

    const row = state.historyRows.find((item) => item.id === deleteButton.dataset.expenseId);
    if (!row) return;

    const result = await Swal.fire({
        icon: "warning",
        title: "¿Seguro que deseas eliminar este gasto?",
        text: "Esta acción borrará el registro del histórico y su comprobante si existe. No se puede deshacer.",
        showCancelButton: true,
        confirmButtonText: "Sí, eliminar",
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

async function editExpense(row) {
    const result = await Swal.fire({
        title: "Editar gasto",
        html: `
            <div style="display:grid;gap:10px;text-align:left;">
                <label>Fecha<input id="editFecha" class="swal2-input" type="date" value="${escapeAttribute(row.fecha || "")}"></label>
                <label>N° Factura / Comprobante<input id="editFactura" class="swal2-input" type="text" value="${escapeAttribute(row.numero_factura || "")}" placeholder="Ej. FAC-001245"></label>
                <label>Monto divisa<input id="editMontoUsd" class="swal2-input" type="number" min="0" step="0.01" value="${escapeAttribute(row.monto_usd || 0)}"></label>
                <label>Monto VES<input id="editMontoVes" class="swal2-input" type="number" min="0" step="0.01" value="${escapeAttribute(row.monto_ves || 0)}"></label>
                <label>Forma de pago
                    <select id="editFormaPago" class="swal2-select">
                        ${getAllPaymentMethods().map((method) => `<option value="${escapeAttribute(method)}" ${row.forma_pago === method ? "selected" : ""}>${escapeHtml(method)}</option>`).join("")}
                    </select>
                </label>
                <label>Tipo de tasa
                    <select id="editTipoTasa" class="swal2-select">
                        ${["DIRECTO", "BCV_USD", "BCV_EUR", "MANUAL", "BINANCE"].map((rateType) => `<option value="${rateType}" ${(row.tipo_tasa || "DIRECTO") === rateType ? "selected" : ""}>${getRateTypeLabel(rateType)}</option>`).join("")}
                    </select>
                </label>
                <label>Tasa usada<input id="editTasaCambio" class="swal2-input" type="number" min="0" step="0.0001" value="${escapeAttribute(row.tasa_bcv || 0)}"></label>
                <label>Kilometraje<input id="editKilometraje" class="swal2-input" type="number" min="0" step="1" value="${escapeAttribute(row.kilometraje || "")}" placeholder="Solo si aplica"></label>
                <label>Litros gasolina<input id="editLitrosGasolina" class="swal2-input" type="number" min="0" step="0.01" value="${escapeAttribute(row.litros_gasolina || "")}" placeholder="Solo si aplica"></label>
                <label>Detalle comida
                    <select id="editDetalleActividad" class="swal2-select">
                        ${["", "Jornada Laboral UVS", "Evento"].map((detail) => `<option value="${escapeAttribute(detail)}" ${(row.detalle_actividad || "") === detail ? "selected" : ""}>${detail ? escapeHtml(detail) : "Sin detalle"}</option>`).join("")}
                    </select>
                </label>
                <label>Responsable
                    <select id="editResponsable" class="swal2-select">
                        ${["Ilver", "Manuel", "Irwin"].map((name) => `<option value="${name}" ${row.responsable === name ? "selected" : ""}>${name}</option>`).join("")}
                    </select>
                </label>
                <label>Descripción<textarea id="editDescripcion" class="swal2-textarea" placeholder="Detalle breve del gasto">${escapeHtml(row.descripcion || "")}</textarea></label>
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: "Guardar cambios",
        cancelButtonText: "Cancelar",
        preConfirm: () => {
            const fecha = document.querySelector("#editFecha").value;
            const montoUsd = roundMoney(parseCurrency(document.querySelector("#editMontoUsd").value));
            const montoVes = roundMoney(parseCurrency(document.querySelector("#editMontoVes").value));
            const tipoTasa = document.querySelector("#editTipoTasa").value;
            const tasaCambio = parseCurrency(document.querySelector("#editTasaCambio").value);

            if (!fecha) {
                Swal.showValidationMessage("Selecciona la fecha del gasto.");
                return false;
            }

            if (!montoUsd && !montoVes) {
                Swal.showValidationMessage("Ingresa el monto en USD o VES.");
                return false;
            }

            if (tipoTasa !== "DIRECTO" && tasaCambio <= 0) {
                Swal.showValidationMessage("Ingresa la tasa usada.");
                return false;
            }

            return {
                fecha,
                numero_factura: cleanText(document.querySelector("#editFactura").value),
                forma_pago: document.querySelector("#editFormaPago").value,
                tipo_tasa: tipoTasa,
                tasa_bcv: tipoTasa === "DIRECTO" ? 0 : Number(tasaCambio.toFixed(4)),
                monto_usd: montoUsd,
                monto_ves: montoVes,
                kilometraje: parseCurrency(document.querySelector("#editKilometraje").value) > 0 ? Math.round(parseCurrency(document.querySelector("#editKilometraje").value)) : null,
                litros_gasolina: parseCurrency(document.querySelector("#editLitrosGasolina").value) > 0 ? roundMoney(parseCurrency(document.querySelector("#editLitrosGasolina").value)) : null,
                detalle_actividad: cleanText(document.querySelector("#editDetalleActividad").value),
                responsable: document.querySelector("#editResponsable").value,
                descripcion: cleanText(document.querySelector("#editDescripcion").value)
            };
        }
    });

    if (!result.isConfirmed) return;

    try {
        const { data, error } = await updateExpenseWithSchemaFallback(row.id, result.value);

        if (error) throw error;

        if (!data || data.length === 0) {
            throw new Error("Supabase no actualizó el registro. Revisa la política UPDATE o que el gasto pertenezca a tu usuario.");
        }

        await Swal.fire({ icon: "success", title: "Gasto actualizado", timer: 1300, showConfirmButton: false });
        await loadHistorico();
    } catch (error) {
        console.error(error);
        await Swal.fire({ icon: "error", title: "No se pudo editar", text: error.message });
    }
}

async function updateExpenseWithSchemaFallback(id, payload) {
    const result = await supabaseClient
        .from("gastos_operativos")
        .update(payload)
        .eq("id", id)
        .select("id");

    if (!isSchemaCacheColumnError(result.error)) {
        return result;
    }

    const legacyPayload = { ...payload };
    delete legacyPayload.litros_gasolina;

    return supabaseClient
        .from("gastos_operativos")
        .update(legacyPayload)
        .eq("id", id)
        .select("id");
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

    elements.totalUsd.textContent = formatNumber(totals.usd, 2);
    elements.totalVes.textContent = `Bs. ${formatNumber(totals.ves, 2)}`;
    elements.totalReceipts.textContent = String(totals.receipts);
}

function renderReceiptLink(url) {
    if (!url) return "-";
    return `<a class="receipt-link" href="${escapeAttribute(url)}" target="_blank" rel="noopener">Ver comprobante</a>`;
}

function getOperationalDetail(row) {
    const details = [];

    if (row.detalle_actividad) {
        details.push(row.detalle_actividad);
    }

    if (row.vehiculo_nombre || row.vehiculo_placa) {
        details.push([row.vehiculo_nombre, row.vehiculo_placa].filter(Boolean).join(" · "));
    }

    if (row.kilometraje) {
        details.push(`${formatNumber(row.kilometraje, 0)} km`);
    }

    if (row.litros_gasolina) {
        details.push(`${formatNumber(row.litros_gasolina, 2)} L`);
    }

    return details.join(" · ") || "-";
}

function exportExcel() {
    if (!state.isAdmin) {
        Swal.fire({ icon: "warning", title: "Solo administrador", text: "Tu usuario no tiene permiso para generar el Excel." });
        return;
    }

    if (!state.historyRows.length) {
        Swal.fire({ icon: "info", title: "Sin datos", text: "No hay gastos para exportar en este periodo." });
        return;
    }

    const rows = state.historyRows.map((row) => ({
        Fecha: formatDate(row.fecha),
        Categoria: row.categoria_nombre || "",
        Factura: row.numero_factura || "",
        "Moneda de pago": row.moneda || "",
        "Forma de pago": row.forma_pago || "",
        "Tipo de tasa": getRateTypeLabel(row.tipo_tasa),
        "Tasa usada": Number(row.tasa_bcv || 0),
        "Unidad divisa": getMoneyUnit(row.tipo_tasa),
        "Monto divisa": Number(row.monto_usd || 0),
        "Monto VES": Number(row.monto_ves || 0),
        Vehiculo: row.vehiculo_nombre || "",
        Placa: row.vehiculo_placa || "",
        Kilometraje: row.kilometraje || "",
        "Litros gasolina": row.litros_gasolina || "",
        "Detalle actividad": row.detalle_actividad || "",
        Responsable: row.responsable || "",
        "Registrado por": row.user_email || "",
        Descripcion: row.descripcion || "",
        Comprobante: row.comprobante_url || ""
    }));

    const detailWorksheet = XLSX.utils.json_to_sheet(rows);
    detailWorksheet["!cols"] = [
        { wch: 12 }, { wch: 34 }, { wch: 18 }, { wch: 14 }, { wch: 18 }, { wch: 14 },
        { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 12 },
        { wch: 14 }, { wch: 16 }, { wch: 22 }, { wch: 16 }, { wch: 28 }, { wch: 36 }, { wch: 48 }
    ];

    const summaryRows = buildExcelSummaryRows(state.historyRows);
    const summaryWorksheet = XLSX.utils.aoa_to_sheet(summaryRows);
    summaryWorksheet["!cols"] = [{ wch: 34 }, { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 16 }];
    summaryWorksheet["!rows"] = summaryRows.map((row, index) => ({ hpt: index === 0 ? 30 : index === 4 ? 28 : 20 }));
    summaryWorksheet["!merges"] = buildSummaryMerges(summaryRows);
    styleExcelSummary(summaryWorksheet, summaryRows);
    styleExcelHeader(detailWorksheet, 19);

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, summaryWorksheet, "Resumen");
    XLSX.utils.book_append_sheet(workbook, detailWorksheet, "Detalle");
    workbook.Workbook = {
        Sheets: [
            { name: "Resumen", Hidden: 0, TabColor: { rgb: "2563EB" } },
            { name: "Detalle", Hidden: 0, TabColor: { rgb: "16A34A" } }
        ]
    };

    const filename = `reporte-gastos-${elements.fromDate.value || "inicio"}-a-${elements.toDate.value || "hoy"}.xlsx`;
    XLSX.writeFile(workbook, filename);
}

function buildExcelSummaryRows(rows) {
    const totals = rows.reduce((acc, row) => {
        acc.usd += Number(row.monto_usd || 0);
        acc.ves += Number(row.monto_ves || 0);
        acc.receipts += row.comprobante_url ? 1 : 0;
        acc.count += 1;
        acc.liters += Number(row.litros_gasolina || 0);
        return acc;
    }, { usd: 0, ves: 0, receipts: 0, count: 0, liters: 0 });

    const categories = buildGroupedSummary(rows, (row) => row.categoria_nombre || "Sin categoria");
    const responsibles = buildGroupedSummary(rows, (row) => row.responsable || "Sin responsable");
    const vehicles = buildGroupedSummary(rows.filter((row) => row.vehiculo_nombre || row.vehiculo_placa), (row) => [row.vehiculo_nombre, row.vehiculo_placa].filter(Boolean).join(" - "));

    return [
        ["REPORTE EJECUTIVO DE GASTOS OPERATIVOS"],
        [`Periodo evaluado: ${elements.fromDate.value || "inicio"} al ${elements.toDate.value || "hoy"}`],
        [],
        ["TOTAL DIVISA", "TOTAL VES", "REGISTROS", "COMPROBANTES", "LITROS GASOLINA"],
        [Number(totals.usd.toFixed(2)), Number(totals.ves.toFixed(2)), totals.count, totals.receipts, Number(totals.liters.toFixed(2))],
        [],
        ["DISTRIBUCION POR CATEGORIA"],
        ["Categoria", "USD", "VES", "Registros", "% USD"],
        ...categories.map((row) => appendPercentage(row, totals.usd)),
        [],
        ["DISTRIBUCION POR RESPONSABLE"],
        ["Responsable", "USD", "VES", "Registros", "% USD"],
        ...responsibles.map((row) => appendPercentage(row, totals.usd)),
        [],
        ["DISTRIBUCION POR VEHICULO"],
        ["Vehiculo / placa", "USD", "VES", "Registros", "% USD"],
        ...(vehicles.length ? vehicles.map((row) => appendPercentage(row, totals.usd)) : [["Sin gastos asociados a vehiculos", 0, 0, 0, "0%"]]),
        [],
        ["Nota"],
        ["La hoja Detalle contiene cada gasto individual con factura, pago, responsable y comprobante."]
    ];
}

function buildSummaryMerges(rows) {
    return rows.reduce((merges, row, index) => {
        const label = String(row[0] || "");
        if (index <= 1 || label === "DISTRIBUCION POR CATEGORIA" || label === "DISTRIBUCION POR RESPONSABLE" || label === "DISTRIBUCION POR VEHICULO" || label === "Nota") {
            merges.push({ s: { r: index, c: 0 }, e: { r: index, c: 4 } });
        }
        return merges;
    }, []);
}

function buildGroupedSummary(rows, keyGetter) {
    const groups = rows.reduce((acc, row) => {
        const key = keyGetter(row) || "Sin detalle";
        if (!acc[key]) acc[key] = { usd: 0, ves: 0, count: 0 };
        acc[key].usd += Number(row.monto_usd || 0);
        acc[key].ves += Number(row.monto_ves || 0);
        acc[key].count += 1;
        return acc;
    }, {});

    return Object.entries(groups)
        .sort(([, left], [, right]) => right.usd - left.usd)
        .map(([name, value]) => [name, Number(value.usd.toFixed(2)), Number(value.ves.toFixed(2)), value.count]);
}

function appendPercentage(row, totalUsd) {
    const percentage = totalUsd > 0 ? `${((Number(row[1] || 0) / totalUsd) * 100).toFixed(1)}%` : "0%";
    return [...row, percentage];
}

function styleExcelSummary(worksheet, rows) {
    const range = XLSX.utils.decode_range(worksheet["!ref"]);
    const border = {
        top: { style: "thin", color: { rgb: "D8E1EC" } },
        right: { style: "thin", color: { rgb: "D8E1EC" } },
        bottom: { style: "thin", color: { rgb: "D8E1EC" } },
        left: { style: "thin", color: { rgb: "D8E1EC" } }
    };
    const kpiColors = ["2563EB", "16A34A", "F59E0B", "7C3AED", "0EA5E9"];
    const kpiSoftColors = ["DBEAFE", "DCFCE7", "FEF3C7", "EDE9FE", "E0F2FE"];

    for (let rowIndex = range.s.r; rowIndex <= range.e.r; rowIndex += 1) {
        for (let colIndex = range.s.c; colIndex <= range.e.c; colIndex += 1) {
            const address = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
            if (!worksheet[address]) worksheet[address] = { t: "s", v: "" };

            const value = String(worksheet[address].v || "");
            worksheet[address].s = {
                font: { name: "Calibri", sz: 11, color: { rgb: "1E293B" } },
                alignment: { vertical: "center" },
                border
            };

            if (rowIndex === 0) {
                worksheet[address].s = { font: { name: "Calibri", bold: true, color: { rgb: "FFFFFF" }, sz: 18 }, fill: { fgColor: { rgb: "0F172A" } }, alignment: { horizontal: "center", vertical: "center" }, border };
            } else if (rowIndex === 1) {
                worksheet[address].s = { font: { name: "Calibri", bold: true, color: { rgb: "1D4ED8" }, sz: 12 }, fill: { fgColor: { rgb: "EFF6FF" } }, alignment: { horizontal: "center", vertical: "center" }, border };
            } else if (rowIndex === 3) {
                worksheet[address].s = { font: { name: "Calibri", bold: true, color: { rgb: "FFFFFF" }, sz: 11 }, fill: { fgColor: { rgb: kpiColors[colIndex] || "2563EB" } }, alignment: { horizontal: "center", vertical: "center" }, border };
            } else if (rowIndex === 4) {
                worksheet[address].s = { font: { name: "Calibri", bold: true, color: { rgb: "0F172A" }, sz: 14 }, fill: { fgColor: { rgb: kpiSoftColors[colIndex] || "DBEAFE" } }, alignment: { horizontal: "center", vertical: "center" }, border };
            } else if (value === "RESUMEN GENERAL" || value === "DISTRIBUCION POR CATEGORIA" || value === "DISTRIBUCION POR RESPONSABLE" || value === "DISTRIBUCION POR VEHICULO" || value === "Nota") {
                worksheet[address].s = { font: { name: "Calibri", bold: true, color: { rgb: "FFFFFF" }, sz: 12 }, fill: { fgColor: { rgb: "111827" } }, alignment: { horizontal: "left", vertical: "center" }, border };
            } else if (["Categoria", "Responsable", "Vehiculo / placa"].includes(value)) {
                const headerRow = rows[rowIndex] || [];
                headerRow.forEach((_, index) => {
                    const headerAddress = XLSX.utils.encode_cell({ r: rowIndex, c: index });
                    if (!worksheet[headerAddress]) worksheet[headerAddress] = { t: "s", v: "" };
                    worksheet[headerAddress].s = { font: { name: "Calibri", bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "2563EB" } }, alignment: { horizontal: index === 0 ? "left" : "center", vertical: "center" }, border };
                });
            } else if (colIndex === 0 && value) {
                worksheet[address].s.font.bold = true;
                worksheet[address].s.fill = { fgColor: { rgb: "F8FAFC" } };
            } else if (colIndex > 0 && value) {
                worksheet[address].s.alignment = { horizontal: "center", vertical: "center" };
            }
        }
    }
}

function styleExcelHeader(worksheet, columnCount) {
    const border = {
        top: { style: "thin", color: { rgb: "C7D2FE" } },
        right: { style: "thin", color: { rgb: "C7D2FE" } },
        bottom: { style: "thin", color: { rgb: "C7D2FE" } },
        left: { style: "thin", color: { rgb: "C7D2FE" } }
    };

    for (let colIndex = 0; colIndex < columnCount; colIndex += 1) {
        const address = XLSX.utils.encode_cell({ r: 0, c: colIndex });
        if (!worksheet[address]) continue;
        worksheet[address].s = { font: { name: "Calibri", bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "166534" } }, alignment: { horizontal: "center", vertical: "center" }, border };
    }
    worksheet["!autofilter"] = { ref: worksheet["!ref"] };
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
    state.lastMoneyInput = "USD";
    renderPaymentMethods("USD");
    updateMoneyInputLock();
    syncRateTypeToPayment(false);
    state.tempCategory = null;
    renderCategorias();
    elements.vehiculoUnidad.value = "";
    elements.vehiculoDetalle.value = "";
    elements.kilometraje.value = "";
    elements.litrosGasolina.value = "";
    elements.comidaDetalle.value = "";
    updateVehicleDetailVisibility();
    updateContextDetailVisibility();
    state.selectedFile = null;
    elements.comprobanteInput.value = "";
    elements.filePreview.classList.remove("is-visible");
    elements.filePreview.innerHTML = "";
}

function saveExpenseDraft() {
    if (state.restoringDraft || elements.categoria.value === NEW_CATEGORY_VALUE) return;

    const draft = {
        fecha: elements.fecha.value,
        categoria: elements.categoria.value,
        tempCategory: state.tempCategory,
        vehiculoUnidad: elements.vehiculoUnidad.value,
        vehiculoDetalle: elements.vehiculoDetalle.value,
        kilometraje: elements.kilometraje.value,
        litrosGasolina: elements.litrosGasolina.value,
        comidaDetalle: elements.comidaDetalle.value,
        moneda: getSelectedCurrency(),
        formaPago: elements.formaPago.value,
        tipoTasa: elements.tipoTasa.value,
        tasaCambio: elements.tasaCambio.value,
        montoUsd: elements.montoUsd.value,
        montoVes: elements.montoVes.value,
        numeroFactura: elements.numeroFactura.value,
        descripcion: elements.descripcion.value,
        responsable: document.querySelector('input[name="responsable"]:checked')?.value || "Ilver"
    };

    if (!hasExpenseDraftContent(draft)) {
        clearExpenseDraft();
        return;
    }

    localStorage.setItem(EXPENSE_DRAFT_STORAGE_KEY, JSON.stringify(draft));
}

function restoreExpenseDraft() {
    const savedDraft = localStorage.getItem(EXPENSE_DRAFT_STORAGE_KEY);
    if (!savedDraft) return;

    let draft;
    try {
        draft = JSON.parse(savedDraft);
    } catch (error) {
        console.error(error);
        clearExpenseDraft();
        return;
    }

    if (!hasExpenseDraftContent(draft)) return;

    state.restoringDraft = true;
    state.tempCategory = draft.tempCategory?.nombre ? draft.tempCategory : null;
    renderCategorias(isKnownCategoryValue(draft.categoria) ? draft.categoria : "");

    elements.fecha.value = draft.fecha || toDateInput(new Date());
    elements.vehiculoUnidad.value = draft.vehiculoUnidad || "";
    updateVehicleDetailVisibility();
    elements.vehiculoDetalle.value = draft.vehiculoDetalle || "";
    updateContextDetailVisibility();
    elements.kilometraje.value = draft.kilometraje || "";
    elements.litrosGasolina.value = draft.litrosGasolina || "";
    elements.comidaDetalle.value = draft.comidaDetalle || "";

    elements.monedaUsd.checked = draft.moneda !== "VES";
    elements.monedaVes.checked = draft.moneda === "VES";
    renderPaymentMethods(getSelectedCurrency(), draft.formaPago);
    syncPaymentMode();
    syncRateTypeToPayment(false);
    if (draft.tipoTasa && Array.from(elements.tipoTasa.options).some((option) => option.value === draft.tipoTasa)) {
        elements.tipoTasa.value = draft.tipoTasa;
    }
    if (draft.tipoTasa === "MANUAL") {
        elements.tasaCambio.value = draft.tasaCambio || "";
    } else {
        updateRateField(false);
    }

    elements.montoUsd.value = draft.montoUsd || "";
    elements.montoVes.value = draft.montoVes || "";
    elements.numeroFactura.value = draft.numeroFactura || "";
    elements.descripcion.value = draft.descripcion || "";

    const responsable = Array.from(document.querySelectorAll('input[name="responsable"]'))
        .find((input) => input.value === (draft.responsable || "Ilver"));
    if (responsable) responsable.checked = true;

    updateCategoryActions();
    state.restoringDraft = false;
}

function hasExpenseDraftContent(draft) {
    return Boolean(
        draft?.categoria ||
        draft?.vehiculoUnidad ||
        draft?.vehiculoDetalle ||
        draft?.kilometraje ||
        draft?.litrosGasolina ||
        draft?.comidaDetalle ||
        draft?.montoUsd ||
        draft?.montoVes ||
        draft?.numeroFactura ||
        draft?.descripcion
    );
}

function clearExpenseDraft() {
    localStorage.removeItem(EXPENSE_DRAFT_STORAGE_KEY);
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
