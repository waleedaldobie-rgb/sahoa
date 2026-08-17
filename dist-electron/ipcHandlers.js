var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/electron/ipcHandlers.ts
var ipcHandlers_exports = {};
__export(ipcHandlers_exports, {
  registerIpcHandlers: () => registerIpcHandlers
});
module.exports = __toCommonJS(ipcHandlers_exports);
var import_electron = require("electron");

// src/electron/errorHandler.ts
function translateDatabaseError(error) {
  if (!error) {
    return new Error("\u062D\u062F\u062B \u062E\u0637\u0623 \u063A\u064A\u0631 \u0645\u062A\u0648\u0642\u0639 \u0623\u062B\u0646\u0627\u0621 \u0645\u0639\u0627\u0644\u062C\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A.");
  }
  const rawMsg = error.message || String(error);
  const code = error.code || "";
  console.error("[Global Exception Handler] Caught IPC Error:", { code, rawMsg, error });
  if (code === "SQLITE_CONSTRAINT_FOREIGNKEY" || rawMsg.includes("FOREIGN KEY constraint failed") || rawMsg.includes("foreign key") || rawMsg.includes("FOREIGNKEY")) {
    return new Error("\u0644\u0627 \u064A\u0645\u0643\u0646 \u062D\u0630\u0641 \u0647\u0630\u0627 \u0627\u0644\u0635\u0646\u0641 \u0644\u0627\u0631\u062A\u0628\u0627\u0637\u0647 \u0628\u0637\u0644\u0628\u0627\u062A \u0645\u0648\u062C\u0648\u062F\u0629");
  }
  if (code === "SQLITE_CONSTRAINT_UNIQUE" || rawMsg.includes("UNIQUE constraint failed") || rawMsg.includes("unique constraint")) {
    return new Error("\u0644\u0627 \u064A\u0645\u0643\u0646 \u0627\u0644\u0625\u0636\u0627\u0641\u0629: \u0647\u0630\u0627 \u0627\u0644\u0631\u0642\u0645 \u0623\u0648 \u0627\u0644\u0633\u062C\u0644 \u0645\u0633\u062C\u0644 \u0645\u0633\u0628\u0642\u0627\u064B \u0641\u064A \u0627\u0644\u0646\u0638\u0627\u0645.");
  }
  if (code === "SQLITE_CONSTRAINT_NOTNULL" || rawMsg.includes("NOT NULL constraint failed")) {
    return new Error("\u062A\u0639\u0630\u0631 \u0627\u0644\u062D\u0641\u0638: \u062A\u0648\u062C\u062F \u0628\u064A\u0627\u0646\u0627\u062A \u0623\u0633\u0627\u0633\u064A\u0629 \u0625\u0644\u0632\u0627\u0645\u064A\u0629 \u0645\u0641\u0642\u0648\u062F\u0629\u060C \u064A\u0631\u062C\u0649 \u0627\u0633\u062A\u0643\u0645\u0627\u0644 \u0643\u0627\u0641\u0629 \u0627\u0644\u062D\u0642\u0648\u0644.");
  }
  if (code === "SQLITE_BUSY" || rawMsg.includes("database is locked") || rawMsg.includes("database table is locked")) {
    return new Error("\u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0645\u0634\u063A\u0648\u0644\u0629 \u062D\u0627\u0644\u064A\u0627\u064B \u0628\u0639\u0645\u0644\u064A\u0629 \u0623\u062E\u0631\u0649\u060C \u064A\u0631\u062C\u0649 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629 \u0628\u0639\u062F \u0644\u062D\u0638\u0627\u062A.");
  }
  if (code === "SQLITE_CORRUPT" || rawMsg.includes("database disk image is malformed")) {
    return new Error("\u062A\u0646\u0628\u064A\u0647: \u062A\u0645 \u0627\u0643\u062A\u0634\u0627\u0641 \u062E\u0644\u0644 \u0641\u064A \u0645\u0644\u0641 \u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A\u060C \u064A\u0631\u062C\u0649 \u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0646\u0633\u062E\u0629 \u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629.");
  }
  if (/[\u0600-\u06FF]/.test(rawMsg)) {
    const cleanMsg = rawMsg.replace(/^Error invoking remote method '.*?':\s*/, "").replace(/^Error:\s*/, "");
    return new Error(cleanMsg);
  }
  return new Error("\u062D\u062F\u062B \u062E\u0637\u0623 \u063A\u064A\u0631 \u0645\u062A\u0648\u0642\u0639 \u0623\u062B\u0646\u0627\u0621 \u062A\u0646\u0641\u064A\u0630 \u0627\u0644\u0639\u0645\u0644\u064A\u0629\u060C \u064A\u0631\u062C\u0649 \u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629 \u0644\u0627\u062D\u0642\u0627\u064B.");
}
function safeIpcHandle(ipcMain2, channel, handler) {
  ipcMain2.handle(channel, async (event, ...args) => {
    try {
      return await handler(event, ...args);
    } catch (error) {
      const friendlyError = translateDatabaseError(error);
      throw friendlyError;
    }
  });
}

// src/services/shared/measurementDefaults.ts
var EMPTY_MEASUREMENTS = {
  frontLength: "",
  backLength: "",
  shoulderWidth: "",
  shoulderSlope: "",
  sleeveLength: "",
  cuffWidth: "",
  handOpeningTop: "",
  handOpeningMid: "",
  handOpeningLowerMid: "",
  handOpeningBottom: "",
  neckSize: "",
  neckHeight: "",
  chestSize: "",
  waistSize: "",
  hipSize: "",
  clearances: "",
  stepSize: "",
  overlapSize: "",
  pieceCount: "",
  bottomSweep: "",
  currentWeight: ""
};
var EMPTY_STYLE_DETAILS = {
  neckSizeHeader: "",
  neckHeightHeader: "",
  neckType: "",
  neckShape: "",
  neckPadding: "",
  neckLining: "",
  neckNotes: "",
  buttonsType: "",
  habroorType: "",
  habroorPadding: "",
  habroorLining: "",
  habroorStyle: "",
  habroorLength: "",
  habroorBottom: "",
  sleeveCuffLength: "",
  sleevePlainLength: "",
  sleeveType: "",
  sleevePadding: "",
  sleeveShape: "",
  sleeveLining: "",
  pleatsStyle: "",
  sleeveNotes: "",
  chestPocketDrop: "",
  chestPocketWidth: "",
  chestPocketPadding: "",
  chestPocketStyle: "",
  chestLining: "",
  pocketNotes: "",
  sidePockets: "",
  mobilePocketRight: "",
  mobilePocketLeft: "",
  penPocketStyle: "",
  rightSide: "",
  leftSide: "",
  bottomHemShape: "",
  cuff1: "",
  cuff2: "",
  cuff3: "",
  cuff4: "",
  cuff5: "",
  stitchingType: "",
  richieMark: "",
  generalNotes: "",
  additionalNotes: "",
  tailorNotes: "",
  modelPhoto: "",
  modelTextDescription: ""
};
var normalizeMeasurements = (value) => ({
  ...EMPTY_MEASUREMENTS,
  ...value || {}
});
var normalizeStyleDetails = (value) => ({
  ...EMPTY_STYLE_DETAILS,
  ...value || {}
});

// src/domain/amountRules.ts
function normalizePositiveAmount(amount, label) {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new Error(`${label} \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 \u0623\u0643\u0628\u0631 \u0645\u0646 \u0635\u0641\u0631`);
  }
  return numericAmount;
}

// src/domain/inventoryRules.ts
var round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
var calculateStockBalance = (beforeValue, deltaValue, itemName) => {
  const before = round2(beforeValue);
  const delta = round2(deltaValue);
  const after = round2(before + delta);
  if (after < -1e-4) {
    throw new Error(`\u0644\u0627 \u064A\u0645\u0643\u0646 \u062A\u0646\u0641\u064A\u0630 \u0627\u0644\u062D\u0631\u0643\u0629\u061B \u0627\u0644\u0643\u0645\u064A\u0629 \u0627\u0644\u0645\u062A\u0627\u062D\u0629 \u0645\u0646 ${itemName} \u063A\u064A\u0631 \u0643\u0627\u0641\u064A\u0629.`);
  }
  return { before, after: Math.max(0, after) };
};

// src/electron/repositories/customerRepository.ts
var CustomerRepository = class {
  constructor(db) {
    this.db = db;
  }
  list() {
    return this.db.prepare("SELECT * FROM customers ORDER BY name ASC").all();
  }
  listMeasurementHistory() {
    return this.db.prepare("SELECT * FROM customer_measurement_history ORDER BY saved_at DESC").all();
  }
  findById(id) {
    return this.db.prepare("SELECT * FROM customers WHERE id = ?").get(id);
  }
  findByPhone(phone) {
    return this.db.prepare("SELECT id FROM customers WHERE phone = ?").get(phone);
  }
  findByPhoneExcludingId(phone, id) {
    return this.db.prepare("SELECT id FROM customers WHERE phone = ? AND id != ?").get(phone, id);
  }
  insert(row) {
    this.db.prepare(`
      INSERT INTO customers (id, name, phone, created_at, updated_at, measurements_json, style_details_json)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      row.id,
      row.name,
      row.phone,
      row.createdAt,
      row.updatedAt || row.createdAt,
      row.measurementsJson,
      row.styleDetailsJson
    );
  }
  update(row) {
    this.db.prepare(`
      UPDATE customers
      SET name = ?, phone = ?, measurements_json = ?, style_details_json = ?, updated_at = ?
      WHERE id = ?
    `).run(row.name, row.phone, row.measurementsJson, row.styleDetailsJson, row.updatedAt, row.id);
  }
  deleteById(id) {
    this.db.prepare("DELETE FROM customers WHERE id = ?").run(id);
  }
  insertMeasurementHistory(row) {
    this.db.prepare(`
      INSERT INTO customer_measurement_history (id, customer_id, saved_at, note, measurements_json, style_details_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(row.id, row.customerId, row.savedAt, row.note, row.measurementsJson, row.styleDetailsJson);
  }
};

// src/electron/repositories/cashRepository.ts
var CashRepository = class {
  constructor(db) {
    this.db = db;
  }
  insert(transaction) {
    this.db.prepare(`
      INSERT INTO cash_transactions (
        id, direction, source_type, source_id, order_id, reference_number, amount,
        payment_method, transaction_date, description, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      transaction.id,
      transaction.direction,
      transaction.sourceType,
      transaction.sourceId || null,
      transaction.orderId || null,
      transaction.referenceNumber || null,
      Math.round((Number(transaction.amount) + Number.EPSILON) * 100) / 100,
      transaction.paymentMethod,
      transaction.transactionDate,
      transaction.description,
      transaction.notes || null,
      transaction.createdAt
    );
  }
  list() {
    return this.db.prepare("SELECT * FROM cash_transactions ORDER BY transaction_date DESC, created_at DESC").all();
  }
  findById(id) {
    return this.db.prepare("SELECT * FROM cash_transactions WHERE id = ?").get(id);
  }
  findBySourceId(sourceId) {
    return this.db.prepare("SELECT id FROM cash_transactions WHERE source_id = ?").get(sourceId);
  }
};

// src/electron/services/customerService.ts
var parseMeasurements = (value) => {
  try {
    return normalizeMeasurements(JSON.parse(value || "{}"));
  } catch {
    return normalizeMeasurements();
  }
};
var parseStyleDetails = (value) => {
  try {
    return normalizeStyleDetails(JSON.parse(value || "{}"));
  } catch {
    return normalizeStyleDetails();
  }
};
var createHistoryId = () => `HIST-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
var CustomerService = class {
  constructor(repository, db) {
    this.repository = repository;
    this.db = db;
  }
  list() {
    const historyMap = /* @__PURE__ */ new Map();
    for (const history of this.repository.listMeasurementHistory()) {
      const list = historyMap.get(history.customer_id) || [];
      list.push({
        id: history.id,
        savedAt: history.saved_at,
        note: history.note || "",
        measurements: parseMeasurements(history.measurements_json),
        styleDetails: parseStyleDetails(history.style_details_json)
      });
      historyMap.set(history.customer_id, list);
    }
    return this.repository.list().map((customer) => this.toCustomer(customer, historyMap.get(customer.id) || []));
  }
  create(input) {
    const id = input.id || `CUST-${Date.now()}`;
    const name = input.name || "\u0639\u0645\u064A\u0644 \u062C\u062F\u064A\u062F";
    const phone = (input.phone || "").trim();
    const createdAt = input.createdAt || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    if (this.repository.findByPhone(phone)) throw new Error("\u0631\u0642\u0645 \u0627\u0644\u062C\u0648\u0627\u0644 \u0645\u0633\u062C\u0644 \u0628\u0627\u0644\u0641\u0639\u0644 \u0644\u0639\u0645\u064A\u0644 \u0622\u062E\u0631");
    const measurements = normalizeMeasurements(input.measurements);
    const styleDetails = normalizeStyleDetails(input.styleDetails);
    this.repository.insert({
      id,
      name,
      phone,
      createdAt,
      measurementsJson: JSON.stringify(measurements),
      styleDetailsJson: JSON.stringify(styleDetails)
    });
    return { id, name, phone, createdAt, updatedAt: createdAt, measurements, styleDetails, measurementHistory: [] };
  }
  update(customer) {
    const phone = (customer.phone || "").trim();
    if (this.repository.findByPhoneExcludingId(phone, customer.id)) throw new Error("\u0631\u0642\u0645 \u0627\u0644\u062C\u0648\u0627\u0644 \u0645\u0633\u062C\u0644 \u0628\u0627\u0644\u0641\u0639\u0644 \u0644\u0639\u0645\u064A\u0644 \u0622\u062E\u0631");
    const existing = this.repository.findById(customer.id);
    if (!existing) throw new Error("\u0627\u0644\u0639\u0645\u064A\u0644 \u0627\u0644\u0645\u0637\u0644\u0648\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
    const measurements = normalizeMeasurements(customer.measurements);
    const styleDetails = normalizeStyleDetails(customer.styleDetails);
    const measurementsJson = JSON.stringify(measurements);
    const styleDetailsJson = JSON.stringify(styleDetails);
    const hasMeasurementChanges = existing.measurements_json !== measurementsJson || existing.style_details_json !== styleDetailsJson;
    const updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    const updateTx = this.db.transaction(() => {
      if (hasMeasurementChanges) {
        this.repository.insertMeasurementHistory({
          id: createHistoryId(),
          customerId: customer.id,
          savedAt: updatedAt,
          note: "\u0646\u0633\u062E\u0629 \u0633\u0627\u0628\u0642\u0629 \u0642\u0628\u0644 \u0625\u0646\u0634\u0627\u0621 \u0645\u0642\u0627\u0633 \u062C\u062F\u064A\u062F",
          measurementsJson: existing.measurements_json,
          styleDetailsJson: existing.style_details_json
        });
      }
      this.repository.update({
        id: customer.id,
        name: customer.name,
        phone,
        measurementsJson,
        styleDetailsJson,
        updatedAt
      });
    });
    updateTx();
    return true;
  }
  delete(id) {
    this.repository.deleteById(id);
    return true;
  }
  saveMeasurementHistory(customerId, note) {
    const customer = this.repository.findById(customerId);
    if (!customer) throw new Error("\u0627\u0644\u0639\u0645\u064A\u0644 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0641\u064A \u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A");
    const id = createHistoryId();
    const savedAt = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    const safeNote = note || "\u062A\u062D\u062F\u064A\u062B \u0645\u0642\u0627\u0633\u0627\u062A";
    this.repository.insertMeasurementHistory({
      id,
      customerId,
      savedAt,
      note: safeNote,
      measurementsJson: customer.measurements_json,
      styleDetailsJson: customer.style_details_json
    });
    return {
      id,
      savedAt,
      note,
      measurements: parseMeasurements(customer.measurements_json),
      styleDetails: parseStyleDetails(customer.style_details_json)
    };
  }
  toCustomer(row, measurementHistory) {
    return {
      id: row.id,
      name: row.name,
      phone: row.phone,
      createdAt: row.created_at,
      updatedAt: row.updated_at || void 0,
      measurements: parseMeasurements(row.measurements_json),
      styleDetails: parseStyleDetails(row.style_details_json),
      measurementHistory
    };
  }
};

// src/electron/repositories/inventoryRepository.ts
var InventoryRepository = class {
  constructor(db) {
    this.db = db;
  }
  getMeta(itemType, itemId) {
    if (itemType === "fabric") {
      const row = this.db.prepare("SELECT id, name, quantity_meters AS quantity, purchase_price AS purchasePrice, '\u0645\u062A\u0631' AS unit FROM fabrics WHERE id = ?").get(itemId);
      if (!row) throw new Error("\u0635\u0646\u0641 \u0627\u0644\u0642\u0645\u0627\u0634 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
      return { table: "fabrics", quantityColumn: "quantity_meters", ...row };
    }
    if (itemType === "accessory") {
      const row = this.db.prepare("SELECT id, name, quantity, purchase_price AS purchasePrice, unit FROM accessories WHERE id = ?").get(itemId);
      if (!row) throw new Error("\u0635\u0646\u0641 \u0627\u0644\u0625\u0643\u0633\u0633\u0648\u0627\u0631 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
      return { table: "accessories", quantityColumn: "quantity", ...row };
    }
    throw new Error("\u0646\u0648\u0639 \u0627\u0644\u0635\u0646\u0641 \u063A\u064A\u0631 \u0645\u062F\u0639\u0648\u0645");
  }
  updateQuantity(meta, quantity, itemId) {
    this.db.prepare(`UPDATE ${meta.table} SET ${meta.quantityColumn} = ? WHERE id = ?`).run(quantity, itemId);
  }
  insertMovement(row) {
    this.db.prepare(`
      INSERT INTO inventory_movements (
        id, item_type, item_id, item_name, direction, quantity, quantity_before,
        quantity_after, unit, reason, reference_type, reference_id, reference_number, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      row.id,
      row.itemType,
      row.itemId,
      row.itemName,
      row.direction,
      row.quantity,
      row.quantityBefore,
      row.quantityAfter,
      row.unit,
      row.reason,
      row.referenceType || null,
      row.referenceId || null,
      row.referenceNumber || null,
      row.createdAt
    );
  }
  listMovements(itemType, itemId) {
    let query = "SELECT * FROM inventory_movements";
    const params = [];
    const filters = [];
    if (itemType) {
      filters.push("item_type = ?");
      params.push(itemType);
    }
    if (itemId) {
      filters.push("item_id = ?");
      params.push(itemId);
    }
    if (filters.length) query += ` WHERE ${filters.join(" AND ")}`;
    query += " ORDER BY created_at DESC";
    return this.db.prepare(query).all(...params);
  }
};

// src/electron/services/inventoryService.ts
var InventoryService = class {
  constructor(repository) {
    this.repository = repository;
  }
  getMeta(itemType, itemId) {
    return this.repository.getMeta(itemType, itemId);
  }
  listMovements(itemType, itemId) {
    return this.repository.listMovements(itemType, itemId).map((row) => ({
      id: row.id,
      itemType: row.item_type,
      itemId: row.item_id,
      itemName: row.item_name,
      direction: row.direction,
      quantity: row.quantity,
      quantityBefore: row.quantity_before,
      quantityAfter: row.quantity_after,
      unit: row.unit,
      reason: row.reason,
      referenceType: row.reference_type || void 0,
      referenceId: row.reference_id || void 0,
      referenceNumber: row.reference_number || void 0,
      createdAt: row.created_at
    }));
  }
  adjustStock(itemType, itemId, quantity, reason, direction = "adjustment") {
    if (!reason || !reason.trim()) throw new Error("\u0633\u0628\u0628 \u0627\u0644\u062A\u0633\u0648\u064A\u0629 \u0645\u0637\u0644\u0648\u0628");
    const numericQuantity = Number(quantity);
    if (!Number.isFinite(numericQuantity) || numericQuantity === 0) throw new Error("\u0643\u0645\u064A\u0629 \u0627\u0644\u062A\u0633\u0648\u064A\u0629 \u064A\u062C\u0628 \u0623\u0646 \u062A\u0643\u0648\u0646 \u0631\u0642\u0645\u0627\u064B \u063A\u064A\u0631 \u0635\u0641\u0631\u064A");
    const delta = direction === "return" ? Math.abs(numericQuantity) : numericQuantity;
    return this.recordMovement(itemType, itemId, delta, direction, reason.trim(), { type: "stock_adjustment", id: itemId });
  }
  recordMovement(itemType, itemId, delta, direction, reason, reference) {
    const meta = this.repository.getMeta(itemType, itemId);
    const { before, after: safeAfter } = calculateStockBalance(meta.quantity, delta, meta.name);
    const id = `MOV-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const createdAt = (/* @__PURE__ */ new Date()).toISOString();
    this.repository.updateQuantity(meta, safeAfter, itemId);
    this.repository.insertMovement({
      id,
      itemType,
      itemId,
      itemName: meta.name,
      direction,
      quantity: Math.abs(delta),
      quantityBefore: before,
      quantityAfter: safeAfter,
      unit: meta.unit,
      reason,
      referenceType: reference?.type,
      referenceId: reference?.id,
      referenceNumber: reference?.number,
      createdAt
    });
    return {
      id,
      itemType,
      itemId,
      itemName: meta.name,
      direction,
      quantity: Math.abs(delta),
      quantityBefore: before,
      quantityAfter: safeAfter,
      unit: meta.unit,
      reason,
      referenceType: reference?.type,
      referenceId: reference?.id,
      referenceNumber: reference?.number,
      createdAt
    };
  }
};

// src/electron/repositories/orderEventRepository.ts
var OrderEventRepository = class {
  constructor(db) {
    this.db = db;
  }
  insert(event) {
    const duplicate = this.db.prepare("SELECT id FROM order_events WHERE id = ?").get(event.id);
    if (duplicate) return;
    this.db.prepare(`
      INSERT INTO order_events (id, order_id, event_type, title, description, from_status, to_status, actor, metadata_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      event.id,
      event.orderId,
      event.type,
      event.title,
      event.description,
      event.fromStatus || null,
      event.toStatus || null,
      event.actor || null,
      event.metadata ? JSON.stringify(event.metadata) : null,
      event.createdAt
    );
  }
  list(orderId) {
    return orderId ? this.db.prepare("SELECT * FROM order_events WHERE order_id = ? ORDER BY created_at DESC").all(orderId) : this.db.prepare("SELECT * FROM order_events ORDER BY created_at DESC").all();
  }
};

// src/electron/repositories/accountingRepository.ts
var AccountingRepository = class {
  constructor(db) {
    this.db = db;
  }
  listPurchases() {
    return this.db.prepare("SELECT * FROM purchases ORDER BY purchase_date DESC, created_at DESC").all();
  }
  listPurchaseLines() {
    return this.db.prepare("SELECT * FROM purchase_lines ORDER BY created_at ASC").all();
  }
  findPurchase(id) {
    return this.db.prepare("SELECT * FROM purchases WHERE id = ?").get(id);
  }
  insertPurchase(row) {
    this.db.prepare(`
      INSERT INTO purchases (id, supplier, invoice_number, purchase_date, total_amount, payment_method, notes, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', ?)
    `).run(row.id, row.supplier, row.invoiceNumber || null, row.purchaseDate, row.totalAmount, row.paymentMethod, row.notes || null, row.createdAt);
  }
  insertPurchaseLine(row) {
    this.db.prepare(`
      INSERT INTO purchase_lines (id, purchase_id, item_type, item_id, item_name, quantity, unit, unit_price, total_amount, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(row.id, row.purchaseId, row.itemType, row.itemId, row.itemName, row.quantity, row.unit, row.unitPrice, row.totalAmount, row.createdAt);
  }
  updatePurchasePrice(itemType, itemId, price) {
    const table = itemType === "fabric" ? "fabrics" : "accessories";
    this.db.prepare(`UPDATE ${table} SET purchase_price = ? WHERE id = ?`).run(price, itemId);
  }
  listExpenses() {
    return this.db.prepare("SELECT * FROM expenses ORDER BY expense_date DESC, created_at DESC").all();
  }
  findExpense(id) {
    return this.db.prepare("SELECT * FROM expenses WHERE id = ?").get(id);
  }
  insertExpense(row) {
    this.db.prepare(`
      INSERT INTO expenses (id, category, amount, expense_date, payment_method, description, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(row.id, row.category, row.amount, row.expenseDate, row.paymentMethod, row.description, row.notes || null, row.createdAt);
  }
};

// src/electron/services/accountingService.ts
var AccountingService = class {
  constructor(repository, inventoryService, cashRepository, db) {
    this.repository = repository;
    this.inventoryService = inventoryService;
    this.cashRepository = cashRepository;
    this.db = db;
  }
  listPurchases() {
    return { rows: this.repository.listPurchases(), lines: this.repository.listPurchaseLines() };
  }
  findPurchase(id) {
    const row = this.repository.findPurchase(id);
    if (!row) return void 0;
    return { row, lines: this.repository.listPurchaseLines().filter((line) => line.purchase_id === id) };
  }
  createPurchase(payload) {
    const purchaseId = payload.id || `PUR-${Date.now()}`;
    const existing = this.findPurchase(purchaseId);
    if (existing) return { id: purchaseId, now: existing.row.created_at };
    const lines = Array.isArray(payload.lines) ? payload.lines : [];
    if (!payload.supplier?.trim()) throw new Error("\u0627\u0633\u0645 \u0627\u0644\u0645\u0648\u0631\u062F \u0645\u0637\u0644\u0648\u0628");
    if (lines.length === 0) throw new Error("\u0623\u0636\u0641 \u0635\u0646\u0641\u0627\u064B \u0648\u0627\u062D\u062F\u0627\u064B \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644 \u0625\u0644\u0649 \u0627\u0644\u0645\u0634\u062A\u0631\u064A\u0627\u062A");
    const tx = this.db.transaction(() => {
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const purchaseDate = payload.purchaseDate || now.slice(0, 10);
      let totalAmount = 0;
      const preparedLines = [];
      for (const line of lines) {
        const quantity = Number(line.quantity);
        const unitPrice = Number(line.unitPrice);
        if (!line.itemType || !line.itemId || !Number.isFinite(quantity) || quantity <= 0) throw new Error("\u0628\u064A\u0627\u0646\u0627\u062A \u0643\u0645\u064A\u0629 \u0627\u0644\u0645\u0634\u062A\u0631\u064A\u0627\u062A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
        if (!Number.isFinite(unitPrice) || unitPrice < 0) throw new Error("\u0633\u0639\u0631 \u0627\u0644\u0634\u0631\u0627\u0621 \u0644\u0627 \u064A\u0645\u0643\u0646 \u0623\u0646 \u064A\u0643\u0648\u0646 \u0633\u0627\u0644\u0628\u0627\u064B");
        const meta = this.inventoryService.getMeta(line.itemType, line.itemId);
        const total = round2(quantity * unitPrice);
        totalAmount += total;
        preparedLines.push({ input: line, meta, quantity, unitPrice, total });
      }
      this.repository.insertPurchase({
        id: purchaseId,
        supplier: payload.supplier.trim(),
        invoiceNumber: payload.invoiceNumber,
        purchaseDate,
        totalAmount: round2(totalAmount),
        paymentMethod: payload.paymentMethod || "cash",
        notes: payload.notes,
        createdAt: now
      });
      for (const line of preparedLines) {
        this.inventoryService.recordMovement(line.input.itemType, line.input.itemId, line.quantity, "purchase", `\u0634\u0631\u0627\u0621 \u0645\u0646 \u0627\u0644\u0645\u0648\u0631\u062F ${payload.supplier.trim()}`, {
          type: "purchase",
          id: purchaseId,
          number: payload.invoiceNumber || purchaseId
        });
        this.repository.insertPurchaseLine({
          id: `PURL-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          purchaseId,
          itemType: line.input.itemType,
          itemId: line.input.itemId,
          itemName: line.meta.name,
          quantity: line.quantity,
          unit: line.input.unit || line.meta.unit,
          unitPrice: line.unitPrice,
          totalAmount: line.total,
          createdAt: now
        });
        this.repository.updatePurchasePrice(line.input.itemType, line.input.itemId, line.unitPrice);
      }
      if (totalAmount > 0) {
        const cash = {
          id: `CASH-PUR-${purchaseId}`,
          direction: "out",
          sourceType: "purchase",
          sourceId: purchaseId,
          referenceNumber: payload.invoiceNumber || purchaseId,
          amount: round2(totalAmount),
          paymentMethod: payload.paymentMethod || "cash",
          transactionDate: purchaseDate,
          description: `\u0634\u0631\u0627\u0621 \u0645\u062E\u0632\u0648\u0646 \u0645\u0646 ${payload.supplier.trim()}`,
          notes: payload.notes || void 0,
          createdAt: now
        };
        this.cashRepository.insert(cash);
      }
      return { id: purchaseId, now };
    });
    return tx();
  }
  listExpenses() {
    return this.repository.listExpenses();
  }
  findExpense(id) {
    return this.repository.findExpense(id);
  }
  createExpense(payload) {
    const expenseId = payload.id || `EXP-${Date.now()}`;
    if (this.repository.findExpense(expenseId)) return expenseId;
    if (!payload.category?.trim() || !payload.description?.trim()) throw new Error("\u062A\u0635\u0646\u064A\u0641 \u0648\u0648\u0635\u0641 \u0627\u0644\u0645\u0635\u0631\u0648\u0641 \u0645\u0637\u0644\u0648\u0628\u0627\u0646");
    const amount = normalizePositiveAmount(payload.amount, "\u0645\u0628\u0644\u063A \u0627\u0644\u0645\u0635\u0631\u0648\u0641");
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const expenseDate = payload.expenseDate || now.slice(0, 10);
    const tx = this.db.transaction(() => {
      this.repository.insertExpense({
        id: expenseId,
        category: payload.category.trim(),
        amount: round2(amount),
        expenseDate,
        paymentMethod: payload.paymentMethod || "cash",
        description: payload.description.trim(),
        notes: payload.notes,
        createdAt: now
      });
      this.cashRepository.insert({
        id: `CASH-EXP-${expenseId}`,
        direction: "out",
        sourceType: "expense",
        sourceId: expenseId,
        referenceNumber: expenseId,
        amount: round2(amount),
        paymentMethod: payload.paymentMethod || "cash",
        transactionDate: expenseDate,
        description: payload.description.trim(),
        notes: payload.notes || void 0,
        createdAt: now
      });
    });
    tx();
    return expenseId;
  }
};

// src/electron/repositories/orderRepository.ts
var OrderRepository = class {
  constructor(db) {
    this.db = db;
  }
  list() {
    return this.db.prepare("SELECT * FROM orders ORDER BY order_date DESC, created_at DESC").all();
  }
  listMaterialUsages(orderId) {
    return orderId ? this.db.prepare("SELECT * FROM order_material_usages WHERE order_id = ? ORDER BY created_at ASC").all(orderId) : this.db.prepare("SELECT * FROM order_material_usages ORDER BY created_at ASC").all();
  }
  findById(id) {
    return this.db.prepare("SELECT * FROM orders WHERE id = ?").get(id);
  }
  findByOrderNumber(orderNumber) {
    return this.db.prepare("SELECT * FROM orders WHERE order_number = ?").get(orderNumber);
  }
  count() {
    return Number(this.db.prepare("SELECT COUNT(*) AS count FROM orders").get().count || 0);
  }
};

// src/electron/repositories/orderWriteRepository.ts
var OrderWriteRepository = class {
  constructor(db) {
    this.db = db;
  }
  updatePayment(orderId, paidAmount, remainingAmount) {
    this.db.prepare(`
      UPDATE orders SET paid_amount = ?, remaining_amount = ?
      WHERE id = ?
    `).run(paidAmount, remainingAmount, orderId);
  }
  updateStatus(orderId, status, updatedAt) {
    this.db.prepare("UPDATE orders SET status = ?, updated_at = ? WHERE id = ?").run(status, updatedAt, orderId);
  }
  insertOrder(row) {
    this.db.prepare(`
      INSERT INTO orders (
        id, order_number, customer_id, customer_name, customer_phone,
        thobe_type_id, thobe_type_name, fabric_id, fabric_name, fabric_color,
        fabric_consumption_meters, fabric_buy_price_at_order, garment_count,
        order_date, delivery_date, status, total_amount, paid_amount, remaining_amount,
        is_custom_measurement, measurements_json, style_details_json, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      row.id,
      row.orderNumber,
      row.customerId,
      row.customerName,
      row.customerPhone,
      row.thobeTypeId || null,
      row.thobeTypeName,
      row.fabricId || null,
      row.fabricName,
      row.fabricColor,
      row.fabricConsumptionMeters,
      row.fabricBuyPriceAtOrder,
      row.garmentCount,
      row.orderDate,
      row.deliveryDate,
      row.status,
      row.totalAmount,
      row.paidAmount,
      row.remainingAmount,
      row.isCustomMeasurement ? 1 : 0,
      row.measurementsJson,
      row.styleDetailsJson,
      row.notes,
      row.createdAt
    );
  }
  insertMaterialUsage(row) {
    this.db.prepare(`
      INSERT INTO order_material_usages (id, order_id, item_type, item_id, item_name, quantity, unit, unit_cost_at_usage, total_cost, source_movement_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(row.id, row.orderId, row.itemType, row.itemId, row.itemName, row.quantity, row.unit, row.unitCostAtUsage, row.totalCost, row.sourceMovementId, row.createdAt);
  }
  insertInvoice(row) {
    this.db.prepare(`
      INSERT INTO invoices (
        id, invoice_number, order_id, customer_name, customer_phone,
        order_date, total_amount, paid_amount, remaining_amount, payment_status, payments_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(row.id, row.invoiceNumber, row.orderId, row.customerName, row.customerPhone, row.orderDate, row.totalAmount, row.paidAmount, row.remainingAmount, row.paymentStatus, row.paymentsJson);
  }
  deleteMaterialUsages(orderId) {
    this.db.prepare("DELETE FROM order_material_usages WHERE order_id = ?").run(orderId);
  }
  updateOrder(row) {
    this.db.prepare(`
      UPDATE orders SET
        customer_name = ?, customer_phone = ?, thobe_type_id = ?, thobe_type_name = ?,
        fabric_id = ?, fabric_name = ?, fabric_color = ?, garment_count = ?,
        fabric_consumption_meters = ?, delivery_date = ?, status = ?,
        total_amount = ?, paid_amount = ?, remaining_amount = ?,
        measurements_json = ?, style_details_json = ?, notes = ?, updated_at = ?
      WHERE id = ?
    `).run(
      row.customerName,
      row.customerPhone,
      row.thobeTypeId || null,
      row.thobeTypeName,
      row.fabricId || null,
      row.fabricName,
      row.fabricColor,
      row.garmentCount,
      row.fabricConsumptionMeters,
      row.deliveryDate,
      row.status,
      row.totalAmount,
      row.paidAmount,
      row.remainingAmount,
      row.measurementsJson,
      row.styleDetailsJson,
      row.notes,
      row.updatedAt,
      row.id
    );
  }
  delete(id) {
    this.db.prepare("DELETE FROM orders WHERE id = ?").run(id);
  }
};

// src/electron/repositories/invoiceRepository.ts
var InvoiceRepository = class {
  constructor(db) {
    this.db = db;
  }
  list() {
    return this.db.prepare("SELECT * FROM invoices ORDER BY order_date DESC").all();
  }
  findById(id) {
    return this.db.prepare("SELECT * FROM invoices WHERE id = ?").get(id);
  }
  findByOrderId(orderId) {
    return this.db.prepare("SELECT * FROM invoices WHERE order_id = ?").get(orderId);
  }
  deleteByOrderId(orderId) {
    this.db.prepare("DELETE FROM invoices WHERE order_id = ?").run(orderId);
  }
  updateAmounts(orderId, totalAmount, paidAmount, remainingAmount, paymentStatus) {
    this.db.prepare(`
      UPDATE invoices SET total_amount = ?, paid_amount = ?, remaining_amount = ?, payment_status = ?
      WHERE order_id = ?
    `).run(totalAmount, paidAmount, remainingAmount, paymentStatus, orderId);
  }
  updatePayment(id, paidAmount, remainingAmount, paymentStatus, paymentsJson) {
    this.db.prepare(`
      UPDATE invoices SET paid_amount = ?, remaining_amount = ?, payment_status = ?, payments_json = ?
      WHERE id = ?
    `).run(paidAmount, remainingAmount, paymentStatus, paymentsJson, id);
  }
};

// src/domain/orderRules.ts
function calculateOrderAmounts(totalAmount, paidAmount) {
  const total = Number.isFinite(Number(totalAmount)) ? Number(totalAmount) : 0;
  const paid = Number.isFinite(Number(paidAmount)) ? Number(paidAmount) : 0;
  const remainingAmount = total - paid;
  return {
    totalAmount: total,
    paidAmount: paid,
    remainingAmount,
    paymentStatus: remainingAmount <= 0 ? "paid" : paid > 0 ? "partial" : "unpaid"
  };
}
function calculateMaterialCost(usages) {
  return Math.round((usages.reduce((sum, usage) => sum + Number(usage.totalCost || 0), 0) + Number.EPSILON) * 100) / 100;
}
function materialSignature(usages) {
  return usages.filter((usage) => (usage.itemType || usage.item_type) !== "fabric").map((usage) => [
    usage.itemType || usage.item_type || "",
    usage.itemId || usage.item_id || "",
    usage.quantity ?? "",
    usage.unit || "",
    usage.unitCostAtUsage ?? usage.unit_cost_at_usage ?? ""
  ].join(":")).sort().join("|");
}

// src/domain/paymentRules.ts
function normalizePaymentAmount(amount) {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new Error("\u0645\u0628\u0644\u063A \u0627\u0644\u062F\u0641\u0639\u0629 \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 \u0623\u0643\u0628\u0631 \u0645\u0646 \u0635\u0641\u0631");
  }
  return numericAmount;
}
function calculatePaymentUpdate(totalAmount, paidAmount, remainingAmount, amount) {
  const numericAmount = normalizePaymentAmount(amount);
  if (numericAmount > remainingAmount) {
    throw new Error("\u0645\u0628\u0644\u063A \u0627\u0644\u062F\u0641\u0639\u0629 \u064A\u062A\u062C\u0627\u0648\u0632 \u0627\u0644\u0645\u062A\u0628\u0642\u064A \u0639\u0644\u0649 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629");
  }
  return {
    numericAmount,
    ...calculateOrderAmounts(totalAmount, paidAmount + numericAmount)
  };
}

// src/electron/services/paymentService.ts
var PaymentService = class {
  constructor(invoiceRepository, orderWriteRepository, cashRepository, eventRepository, db) {
    this.invoiceRepository = invoiceRepository;
    this.orderWriteRepository = orderWriteRepository;
    this.cashRepository = cashRepository;
    this.eventRepository = eventRepository;
    this.db = db;
  }
  addPayment(invoiceId, amount, method, note, paymentId) {
    const tx = this.db.transaction(() => {
      const invoice = this.invoiceRepository.findById(invoiceId);
      if (!invoice) throw new Error("\u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629");
      const paymentCalculation = calculatePaymentUpdate(
        invoice.total_amount,
        invoice.paid_amount,
        invoice.remaining_amount,
        amount
      );
      const { numericAmount, paidAmount: newPaid, remainingAmount: newRemaining, paymentStatus: newStatus } = paymentCalculation;
      const existingPayments = JSON.parse(invoice.payments_json || "[]");
      const id = paymentId || `PAY-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      if (existingPayments.some((payment) => payment.id === id) || this.cashRepository.findBySourceId(id)) return false;
      const paymentDate = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
      const createdAt = (/* @__PURE__ */ new Date()).toISOString();
      const newPayment = {
        id,
        invoiceId,
        orderId: invoice.order_id,
        amount: numericAmount,
        paymentDate,
        method,
        note
      };
      existingPayments.push(newPayment);
      this.invoiceRepository.updatePayment(invoiceId, newPaid, newRemaining, newStatus, JSON.stringify(existingPayments));
      this.orderWriteRepository.updatePayment(invoice.order_id, newPaid, newRemaining);
      this.cashRepository.insert({
        id: `CASH-PAY-${id}`,
        direction: "in",
        sourceType: "customer_payment",
        sourceId: id,
        orderId: invoice.order_id,
        referenceNumber: invoice.invoice_number,
        amount: numericAmount,
        paymentMethod: method,
        transactionDate: paymentDate,
        description: `\u062F\u0641\u0639\u0629 \u0639\u0645\u064A\u0644 \u0644\u0644\u0641\u0627\u062A\u0648\u0631\u0629 ${invoice.invoice_number}`,
        notes: note || void 0,
        createdAt
      });
      const event = {
        id: `EVT-PAYMENT-${id}`,
        orderId: invoice.order_id,
        type: "payment",
        title: "\u062A\u0645 \u062A\u0633\u062C\u064A\u0644 \u062F\u0641\u0639\u0629",
        description: `\u062A\u0645 \u062A\u0633\u062C\u064A\u0644 \u062F\u0641\u0639\u0629 \u0628\u0642\u064A\u0645\u0629 ${numericAmount} \u0644\u0644\u0641\u0627\u062A\u0648\u0631\u0629 ${invoice.invoice_number}.`,
        actor: "\u0627\u0644\u0646\u0638\u0627\u0645",
        metadata: { paymentId: id, amount: numericAmount, method, remainingAmount: newRemaining },
        createdAt
      };
      this.eventRepository.insert(event);
      return true;
    });
    return tx();
  }
};

// src/electron/services/orderStatusService.ts
var OrderStatusService = class {
  constructor(orderRepository, orderWriteRepository, inventoryService, eventRepository, db) {
    this.orderRepository = orderRepository;
    this.orderWriteRepository = orderWriteRepository;
    this.inventoryService = inventoryService;
    this.eventRepository = eventRepository;
    this.db = db;
  }
  updateStatus(orderId, status) {
    const tx = this.db.transaction(() => {
      const order = this.orderRepository.findById(orderId);
      if (!order) return false;
      const materials = this.orderRepository.listMaterialUsages(orderId);
      if (status === "cancelled" && order.status !== "cancelled") {
        for (const material of materials) {
          if (material.item_id) {
            this.inventoryService.recordMovement(material.item_type, material.item_id, material.quantity, "return", "\u0625\u0631\u062C\u0627\u0639 \u0645\u0648\u0627\u062F \u0628\u0633\u0628\u0628 \u0625\u0644\u063A\u0627\u0621 \u0627\u0644\u0637\u0644\u0628", {
              type: "order_cancel",
              id: orderId,
              number: order.order_number
            });
          }
        }
      } else if (order.status === "cancelled" && status !== "cancelled") {
        for (const material of materials) {
          if (material.item_id) {
            this.inventoryService.recordMovement(material.item_type, material.item_id, -material.quantity, "sale", "\u0625\u0639\u0627\u062F\u0629 \u0627\u0633\u062A\u0647\u0644\u0627\u0643 \u0645\u0648\u0627\u062F \u0628\u0639\u062F \u0625\u0644\u063A\u0627\u0621 \u0627\u0644\u0625\u0644\u063A\u0627\u0621", {
              type: "order_reactivate",
              id: orderId,
              number: order.order_number
            });
          }
        }
      }
      const updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      this.orderWriteRepository.updateStatus(orderId, status, updatedAt);
      if (order.status !== status) {
        const event = {
          id: `EVT-STATUS-${orderId}-${Date.now()}`,
          orderId,
          type: "status_changed",
          title: `\u062A\u063A\u064A\u064A\u0631 \u0627\u0644\u062D\u0627\u0644\u0629 \u0625\u0644\u0649 ${status}`,
          description: `\u062A\u0645 \u062A\u063A\u064A\u064A\u0631 \u062D\u0627\u0644\u0629 \u0627\u0644\u0637\u0644\u0628 \u0645\u0646 ${order.status} \u0625\u0644\u0649 ${status}${status === "cancelled" ? " \u0645\u0639 \u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u0645\u0648\u0627\u062F \u0644\u0644\u0645\u062E\u0632\u0648\u0646" : order.status === "cancelled" ? " \u0645\u0639 \u0625\u0639\u0627\u062F\u0629 \u0627\u0633\u062A\u0647\u0644\u0627\u0643 \u0627\u0644\u0645\u0648\u0627\u062F" : ""}.`,
          fromStatus: order.status,
          toStatus: status,
          actor: "\u0627\u0644\u0646\u0638\u0627\u0645",
          createdAt: updatedAt
        };
        this.eventRepository.insert(event);
      }
      return true;
    });
    return tx();
  }
};

// src/electron/repositories/notificationRepository.ts
var NotificationRepository = class {
  constructor(db) {
    this.db = db;
  }
  insert(row) {
    this.db.prepare(`
      INSERT INTO notifications (id, type, title, message, date, read, customer_phone, order_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(row.id, row.type, row.title, row.message, row.date, row.read ? 1 : 0, row.customerPhone, row.orderId || null);
  }
};

// src/electron/services/whatsappService.ts
var WhatsAppService = class {
  constructor(notificationRepository, orderRepository, eventRepository) {
    this.notificationRepository = notificationRepository;
    this.orderRepository = orderRepository;
    this.eventRepository = eventRepository;
  }
  prepareMessage(phone, customerName, orderNumber, statusText) {
    const internationalPhone = phone.startsWith("0") ? "966" + phone.slice(1) : phone;
    const message = `\u0645\u0631\u062D\u0628\u0627\u064B \u0628\u0643 \u0623/ ${customerName}\u060C \u0646\u0641\u064A\u062F\u0643 \u0628\u0646\u062A\u064A\u062C\u0629 \u0645\u062A\u0627\u0628\u0639\u0629 \u0637\u0644\u0628\u0643 \u0631\u0642\u0645 (#${orderNumber}) \u0644\u062F\u0649 \u0635\u0647\u0648\u0629 \u0644\u0644\u062E\u064A\u0627\u0637\u0629. \u062D\u0627\u0644\u064A\u0627\u064B: ${statusText}. \u064A\u0633\u0639\u062F\u0646\u0627 \u062A\u0648\u0627\u0635\u0644\u0643\u0645 \u062F\u0627\u0626\u0645\u0627\u064B!`;
    const order = this.orderRepository.findByOrderNumber(orderNumber);
    return {
      url: `https://wa.me/${internationalPhone}?text=${encodeURIComponent(message)}`,
      message,
      orderId: order?.id
    };
  }
  logPreparedMessage(phone, customerName, orderNumber, statusText) {
    const prepared = this.prepareMessage(phone, customerName, orderNumber, statusText);
    const notifId = `NOTIF-${Date.now()}`;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    this.notificationRepository.insert({
      id: notifId,
      type: "whatsapp",
      title: `\u062A\u0630\u0643\u064A\u0631 \u0648\u0627\u062A\u0633\u0627\u0628 - \u0637\u0644\u0628 #${orderNumber}`,
      message: `\u062A\u0645 \u0625\u0631\u0633\u0627\u0644 \u0631\u0633\u0627\u0644\u0629 \u0648\u0627\u062A\u0633\u0627\u0628 \u0644\u0644\u0639\u0645\u064A\u0644 ${customerName} (${phone}) - \u0627\u0644\u062D\u0627\u0644\u0629: ${statusText}`,
      date: (/* @__PURE__ */ new Date()).toLocaleString("ar-SA"),
      read: true,
      customerPhone: phone,
      orderId: prepared.orderId || null
    });
    if (prepared.orderId) {
      const event = {
        id: `EVT-WHATSAPP-${notifId}`,
        orderId: prepared.orderId,
        type: "whatsapp",
        title: "\u0641\u062A\u062D \u0631\u0633\u0627\u0644\u0629 \u0648\u0627\u062A\u0633\u0627\u0628",
        description: `\u062A\u0645 \u062A\u062C\u0647\u064A\u0632 \u0631\u0633\u0627\u0644\u0629 \u0648\u0627\u062A\u0633\u0627\u0628 \u0644\u0644\u0639\u0645\u064A\u0644 ${customerName} \u0639\u0646 \u062D\u0627\u0644\u0629 \u0627\u0644\u0637\u0644\u0628: ${statusText}.`,
        actor: "\u0627\u0644\u0646\u0638\u0627\u0645",
        metadata: { phone, orderNumber, statusText },
        createdAt: now
      };
      this.eventRepository.insert(event);
    }
    return prepared.url;
  }
};

// src/electron/services/orderService.ts
var OrderService = class {
  constructor(orderRepository, orderWriteRepository, inventoryService, cashRepository, eventRepository, invoiceRepository, db) {
    this.orderRepository = orderRepository;
    this.orderWriteRepository = orderWriteRepository;
    this.inventoryService = inventoryService;
    this.cashRepository = cashRepository;
    this.eventRepository = eventRepository;
    this.invoiceRepository = invoiceRepository;
    this.db = db;
  }
  createOrder(orderData, fabricConsumptionRate) {
    const existing = orderData.id ? this.orderRepository.findById(orderData.id) : orderData.orderNumber ? this.orderRepository.findByOrderNumber(orderData.orderNumber) : void 0;
    if (existing) {
      return {
        orderId: existing.id,
        orderNumber: existing.order_number,
        remainingAmount: existing.remaining_amount,
        materialUsages: [],
        materialCost: 0,
        profit: round2((existing.total_amount || 0) - 0),
        alreadyExists: true
      };
    }
    const rate = fabricConsumptionRate || 3.5;
    const garmentCount = orderData.garmentCount || 1;
    const requiredMeters = garmentCount * rate;
    const tx = this.db.transaction(() => {
      const orderId = orderData.id || `ORD-${Date.now()}`;
      const orderNumber = orderData.orderNumber || `${1001 + this.orderRepository.count()}`;
      const amounts = calculateOrderAmounts(orderData.totalAmount || 0, orderData.paidAmount || 0);
      const { totalAmount, paidAmount, remainingAmount } = amounts;
      const orderDate = orderData.orderDate || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
      const createdAt = (/* @__PURE__ */ new Date()).toISOString();
      let fabricBuyPrice = 0;
      let fabricMovement;
      if (orderData.fabricId) {
        const fabricMeta = this.inventoryService.getMeta("fabric", orderData.fabricId);
        fabricBuyPrice = fabricMeta.purchasePrice || 0;
        fabricMovement = this.inventoryService.recordMovement("fabric", orderData.fabricId, -requiredMeters, "sale", "\u0627\u0633\u062A\u0647\u0644\u0627\u0643 \u0642\u0645\u0627\u0634 \u0644\u0644\u0637\u0644\u0628", {
          type: "order",
          id: orderId,
          number: orderNumber
        });
      }
      this.orderWriteRepository.insertOrder({
        id: orderId,
        orderNumber,
        customerId: orderData.customerId,
        customerName: orderData.customerName,
        customerPhone: orderData.customerPhone,
        thobeTypeId: orderData.thobeTypeId,
        thobeTypeName: orderData.thobeTypeName || "\u062B\u0648\u0628",
        fabricId: orderData.fabricId,
        fabricName: orderData.fabricName || "\u0642\u0645\u0627\u0634",
        fabricColor: orderData.fabricColor || "\u0623\u0628\u064A\u0636",
        fabricConsumptionMeters: requiredMeters,
        fabricBuyPriceAtOrder: fabricBuyPrice,
        garmentCount,
        orderDate,
        deliveryDate: orderData.deliveryDate || orderDate,
        status: orderData.status || "new",
        totalAmount,
        paidAmount,
        remainingAmount,
        isCustomMeasurement: Boolean(orderData.isCustomMeasurement),
        measurementsJson: JSON.stringify(normalizeMeasurements(orderData.measurements)),
        styleDetailsJson: JSON.stringify(normalizeStyleDetails(orderData.styleDetails)),
        notes: orderData.notes || "",
        createdAt
      });
      const materialUsages = [];
      if (orderData.fabricId && fabricMovement) {
        const usage = {
          id: `OMU-${Date.now()}-fabric`,
          orderId,
          itemType: "fabric",
          itemId: orderData.fabricId,
          itemName: orderData.fabricName || "\u0642\u0645\u0627\u0634",
          quantity: requiredMeters,
          unit: "\u0645\u062A\u0631",
          unitCostAtUsage: fabricBuyPrice,
          totalCost: round2(requiredMeters * fabricBuyPrice),
          sourceMovementId: fabricMovement.id,
          createdAt
        };
        this.orderWriteRepository.insertMaterialUsage({ ...usage, itemId: usage.itemId || "", sourceMovementId: usage.sourceMovementId || "" });
        materialUsages.push(usage);
      }
      for (const material of orderData.materialUsages || []) {
        if (!material.itemId || material.itemType === "fabric" && material.itemId === orderData.fabricId) continue;
        const quantity = Number(material.quantity);
        if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("\u0643\u0645\u064A\u0629 \u0627\u0644\u0645\u0627\u062F\u0629 \u0627\u0644\u0645\u0631\u062A\u0628\u0637\u0629 \u0628\u0627\u0644\u0637\u0644\u0628 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
        const meta = this.inventoryService.getMeta(material.itemType, material.itemId);
        const movement = this.inventoryService.recordMovement(material.itemType, material.itemId, -quantity, "sale", "\u0627\u0633\u062A\u0647\u0644\u0627\u0643 \u0645\u0627\u062F\u0629 \u0644\u0644\u0637\u0644\u0628", {
          type: "order",
          id: orderId,
          number: orderNumber
        });
        const unitCost = Number.isFinite(Number(material.unitCostAtUsage)) ? Number(material.unitCostAtUsage) : Number(meta.purchasePrice || 0);
        const usage = {
          id: `OMU-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          orderId,
          itemType: material.itemType,
          itemId: material.itemId,
          itemName: material.itemName || meta.name,
          quantity,
          unit: material.unit || meta.unit,
          unitCostAtUsage: unitCost,
          totalCost: round2(quantity * unitCost),
          sourceMovementId: movement.id,
          createdAt
        };
        this.orderWriteRepository.insertMaterialUsage({ ...usage, itemId: usage.itemId || "", sourceMovementId: usage.sourceMovementId || "" });
        materialUsages.push(usage);
      }
      const invId = `INV-${orderNumber}`;
      const paymentMethod = orderData.initialPaymentMethod || "cash";
      const paymentId = paidAmount > 0 ? `PAY-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` : void 0;
      const initialPayments = paidAmount > 0 ? [{
        id: paymentId,
        invoiceId: invId,
        orderId,
        amount: paidAmount,
        paymentDate: orderDate,
        method: paymentMethod,
        note: "\u062F\u0641\u0639\u0629 \u0623\u0648\u0644\u0649 \u0639\u0646\u062F \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0637\u0644\u0628"
      }] : [];
      this.orderWriteRepository.insertInvoice({
        id: invId,
        invoiceNumber: `INV-${orderNumber}`,
        orderId,
        customerName: orderData.customerName,
        customerPhone: orderData.customerPhone,
        orderDate,
        totalAmount,
        paidAmount,
        remainingAmount,
        paymentStatus: remainingAmount <= 0 ? "paid" : paidAmount > 0 ? "partial" : "unpaid",
        paymentsJson: JSON.stringify(initialPayments)
      });
      if (paidAmount > 0 && paymentId) {
        this.cashRepository.insert({
          id: `CASH-PAY-${paymentId}`,
          direction: "in",
          sourceType: "customer_payment",
          sourceId: paymentId,
          orderId,
          referenceNumber: orderNumber,
          amount: paidAmount,
          paymentMethod,
          transactionDate: orderDate,
          description: `\u062F\u0641\u0639\u0629 \u0623\u0648\u0644\u0649 \u0644\u0644\u0637\u0644\u0628 #${orderNumber}`,
          createdAt
        });
      }
      const materialCost = calculateMaterialCost(materialUsages);
      this.eventRepository.insert({
        id: `EVT-CREATED-${orderId}`,
        orderId,
        type: "created",
        title: "\u062A\u0645 \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0637\u0644\u0628",
        description: `\u062A\u0645 \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0637\u0644\u0628 #${orderNumber} \u0648\u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629${paidAmount > 0 ? " \u0648\u0627\u0644\u062F\u0641\u0639\u0629 \u0627\u0644\u0623\u0648\u0644\u0649" : ""}.`,
        toStatus: orderData.status || "new",
        actor: "\u0627\u0644\u0646\u0638\u0627\u0645",
        metadata: { materialCost, paidAmount, remainingAmount },
        createdAt
      });
      return { orderId, orderNumber, remainingAmount, materialUsages, materialCost, profit: round2(totalAmount - materialCost) };
    });
    return tx();
  }
  updateOrder(updatedOrder, fabricConsumptionRate) {
    const updateTx = this.db.transaction(() => {
      const existing = this.orderRepository.findById(updatedOrder.id);
      if (!existing) throw new Error("\u0627\u0644\u0637\u0644\u0628 \u0627\u0644\u0645\u0637\u0644\u0648\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
      const rate = fabricConsumptionRate || 3.5;
      const newMeters = (updatedOrder.garmentCount || 1) * rate;
      const oldMaterials = this.orderRepository.listMaterialUsages(updatedOrder.id);
      const fabricChanged = existing.fabric_id !== updatedOrder.fabricId;
      const countChanged = existing.garment_count !== updatedOrder.garmentCount;
      const oldAccessorySignature = materialSignature(oldMaterials);
      const newAccessorySignature = materialSignature(updatedOrder.materialUsages || []);
      const materialPayloadChanged = updatedOrder.materialUsages !== void 0 && oldAccessorySignature !== newAccessorySignature;
      const materialChanged = fabricChanged || countChanged || materialPayloadChanged;
      if (materialChanged && existing.status !== "cancelled") {
        for (const oldMaterial of oldMaterials) {
          if (oldMaterial.item_id) {
            this.inventoryService.recordMovement(oldMaterial.item_type, oldMaterial.item_id, oldMaterial.quantity, "return", "\u0625\u0631\u062C\u0627\u0639 \u0627\u0633\u062A\u0647\u0644\u0627\u0643 \u0645\u0627\u062F\u0629 \u0628\u0639\u062F \u062A\u0639\u062F\u064A\u0644 \u0627\u0644\u0637\u0644\u0628", {
              type: "order_update",
              id: updatedOrder.id,
              number: existing.order_number
            });
          }
        }
        this.orderWriteRepository.deleteMaterialUsages(updatedOrder.id);
        if (updatedOrder.fabricId) {
          const newFabric = this.inventoryService.getMeta("fabric", updatedOrder.fabricId);
          const fabricBuyPrice = fabricChanged ? newFabric.purchasePrice || 0 : existing.fabric_buy_price_at_order || updatedOrder.fabricBuyPriceAtOrder || 0;
          const newFabricMovement = this.inventoryService.recordMovement("fabric", updatedOrder.fabricId, -newMeters, "sale", "\u0627\u0633\u062A\u0647\u0644\u0627\u0643 \u0642\u0645\u0627\u0634 \u0628\u0639\u062F \u062A\u0639\u062F\u064A\u0644 \u0627\u0644\u0637\u0644\u0628", {
            type: "order_update",
            id: updatedOrder.id,
            number: existing.order_number
          });
          this.orderWriteRepository.insertMaterialUsage({
            id: `OMU-${Date.now()}-fabric-update`,
            orderId: updatedOrder.id,
            itemType: "fabric",
            itemId: updatedOrder.fabricId,
            itemName: updatedOrder.fabricName || "\u0642\u0645\u0627\u0634",
            quantity: newMeters,
            unit: "\u0645\u062A\u0631",
            unitCostAtUsage: fabricBuyPrice,
            totalCost: round2(newMeters * fabricBuyPrice),
            sourceMovementId: newFabricMovement.id,
            createdAt: (/* @__PURE__ */ new Date()).toISOString()
          });
          for (const material of updatedOrder.materialUsages || oldMaterials.filter((row) => row.item_type !== "fabric")) {
            const itemId = material.itemId || material.item_id;
            const itemType = material.itemType || material.item_type;
            if (!itemId || itemType === "fabric" && itemId === updatedOrder.fabricId) continue;
            const quantity = Number(material.quantity);
            if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("\u0643\u0645\u064A\u0629 \u0627\u0644\u0645\u0627\u062F\u0629 \u0627\u0644\u0645\u0631\u062A\u0628\u0637\u0629 \u0628\u0627\u0644\u0637\u0644\u0628 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
            const meta = this.inventoryService.getMeta(itemType, itemId);
            const movement = this.inventoryService.recordMovement(itemType, itemId, -quantity, "sale", "\u0627\u0633\u062A\u0647\u0644\u0627\u0643 \u0645\u0627\u062F\u0629 \u0628\u0639\u062F \u062A\u0639\u062F\u064A\u0644 \u0627\u0644\u0637\u0644\u0628", {
              type: "order_update",
              id: updatedOrder.id,
              number: existing.order_number
            });
            const unitCost = Number(material.unitCostAtUsage ?? material.unit_cost_at_usage ?? meta.purchasePrice ?? 0);
            this.orderWriteRepository.insertMaterialUsage({
              id: `OMU-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              orderId: updatedOrder.id,
              itemType,
              itemId,
              itemName: material.itemName || material.item_name || meta.name,
              quantity,
              unit: material.unit || meta.unit,
              unitCostAtUsage: unitCost,
              totalCost: round2(quantity * unitCost),
              sourceMovementId: movement.id,
              createdAt: (/* @__PURE__ */ new Date()).toISOString()
            });
          }
        }
      }
      const totalAmount = updatedOrder.totalAmount || 0;
      const paidAmount = updatedOrder.paidAmount || 0;
      const remainingAmount = calculateOrderAmounts(totalAmount, paidAmount).remainingAmount;
      this.orderWriteRepository.updateOrder({
        id: updatedOrder.id,
        customerName: updatedOrder.customerName,
        customerPhone: updatedOrder.customerPhone,
        thobeTypeId: updatedOrder.thobeTypeId,
        thobeTypeName: updatedOrder.thobeTypeName || "\u062B\u0648\u0628",
        fabricId: updatedOrder.fabricId,
        fabricName: updatedOrder.fabricName || "\u0642\u0645\u0627\u0634",
        fabricColor: updatedOrder.fabricColor || "\u0623\u0628\u064A\u0636",
        garmentCount: updatedOrder.garmentCount || 1,
        fabricConsumptionMeters: newMeters,
        deliveryDate: updatedOrder.deliveryDate,
        status: updatedOrder.status,
        totalAmount,
        paidAmount,
        remainingAmount,
        measurementsJson: JSON.stringify(normalizeMeasurements(updatedOrder.measurements)),
        styleDetailsJson: JSON.stringify(normalizeStyleDetails(updatedOrder.styleDetails)),
        notes: updatedOrder.notes || "",
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      });
      this.invoiceRepository.updateAmounts(updatedOrder.id, totalAmount, paidAmount, remainingAmount, calculateOrderAmounts(totalAmount, paidAmount).paymentStatus);
    });
    updateTx();
    return true;
  }
  deleteOrder(orderId) {
    const deleteTx = this.db.transaction(() => {
      const order = this.orderRepository.findById(orderId);
      if (!order) return;
      if (order.status !== "cancelled") {
        const materials = this.orderRepository.listMaterialUsages(orderId);
        for (const material of materials) {
          if (material.item_id) {
            this.inventoryService.recordMovement(material.item_type, material.item_id, material.quantity, "return", "\u0625\u0631\u062C\u0627\u0639 \u0645\u0648\u0627\u062F \u0628\u0633\u0628\u0628 \u062D\u0630\u0641 \u0627\u0644\u0637\u0644\u0628", {
              type: "order_delete",
              id: orderId,
              number: order.order_number
            });
          }
        }
      }
      const invoice = this.invoiceRepository.findByOrderId(orderId);
      if (invoice) {
        const payments = JSON.parse(invoice.payments_json || "[]");
        for (const payment of payments) {
          const reversalId = `CASH-REV-${payment.id}`;
          if (!this.cashRepository.findById(reversalId)) {
            this.cashRepository.insert({
              id: reversalId,
              direction: "out",
              sourceType: "adjustment",
              sourceId: payment.id,
              referenceNumber: order.order_number,
              amount: payment.amount,
              paymentMethod: payment.method,
              transactionDate: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
              description: `\u0639\u0643\u0633 \u062F\u0641\u0639\u0629 \u0628\u0633\u0628\u0628 \u062D\u0630\u0641 \u0627\u0644\u0637\u0644\u0628 #${order.order_number}`,
              createdAt: (/* @__PURE__ */ new Date()).toISOString()
            });
          }
        }
      }
      this.invoiceRepository.deleteByOrderId(orderId);
      this.orderWriteRepository.deleteMaterialUsages(orderId);
      this.orderWriteRepository.delete(orderId);
    });
    deleteTx();
    return true;
  }
};

// src/electron/repositories/fabricRepository.ts
var FabricRepository = class {
  constructor(db) {
    this.db = db;
  }
  list() {
    const rows = this.db.prepare("SELECT * FROM fabrics ORDER BY name ASC").all();
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      color: row.color,
      colorHex: row.color_hex,
      purchasePrice: row.purchase_price || 0,
      sellingPrice: row.selling_price || 0,
      quantityMeters: row.quantity_meters || 0,
      minStockMeters: row.min_stock_meters || 0
    }));
  }
  insert(fabric) {
    const id = fabric.id || `FAB-${Date.now()}`;
    const record = {
      id,
      name: fabric.name || "\u0642\u0645\u0627\u0634 \u062C\u062F\u064A\u062F",
      color: fabric.color || "\u0623\u0628\u064A\u0636",
      colorHex: fabric.colorHex || "#ffffff",
      purchasePrice: fabric.purchasePrice || 0,
      sellingPrice: fabric.sellingPrice || 0,
      quantityMeters: fabric.quantityMeters || 0,
      minStockMeters: fabric.minStockMeters || 10
    };
    this.db.prepare(`
      INSERT INTO fabrics (id, name, color, color_hex, purchase_price, selling_price, quantity_meters, min_stock_meters, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(record.id, record.name, record.color, record.colorHex, record.purchasePrice, record.sellingPrice, record.quantityMeters, record.minStockMeters, (/* @__PURE__ */ new Date()).toISOString());
    return record;
  }
  update(fabric) {
    this.db.prepare(`
      UPDATE fabrics
      SET name = ?, color = ?, color_hex = ?, purchase_price = ?, selling_price = ?, quantity_meters = ?, min_stock_meters = ?
      WHERE id = ?
    `).run(fabric.name, fabric.color, fabric.colorHex, fabric.purchasePrice, fabric.sellingPrice, fabric.quantityMeters, fabric.minStockMeters, fabric.id);
  }
  delete(id) {
    this.db.prepare("DELETE FROM fabrics WHERE id = ?").run(id);
  }
};

// src/electron/repositories/accessoryRepository.ts
var AccessoryRepository = class {
  constructor(db) {
    this.db = db;
  }
  list() {
    const rows = this.db.prepare("SELECT * FROM accessories ORDER BY category ASC, name ASC").all();
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      category: row.category,
      quantity: row.quantity || 0,
      minStock: row.min_stock || 0,
      unit: row.unit,
      purchasePrice: row.purchase_price || 0,
      sellingPrice: row.selling_price || 0
    }));
  }
  insert(accessory) {
    const id = accessory.id || `ACC-${Date.now()}`;
    const record = {
      id,
      name: accessory.name || "\u0639\u0646\u0635\u0631",
      category: accessory.category || "\u0639\u0627\u0645",
      quantity: accessory.quantity || 0,
      minStock: accessory.minStock || 5,
      unit: accessory.unit || "\u062D\u0628\u0629",
      purchasePrice: accessory.purchasePrice || 0,
      sellingPrice: accessory.sellingPrice || 0
    };
    this.db.prepare(`
      INSERT INTO accessories (id, name, category, quantity, min_stock, unit, purchase_price, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(record.id, record.name, record.category, record.quantity, record.minStock, record.unit, record.purchasePrice || 0, (/* @__PURE__ */ new Date()).toISOString());
    return record;
  }
  update(accessory) {
    this.db.prepare(`
      UPDATE accessories SET name = ?, category = ?, quantity = ?, min_stock = ?, unit = ?, purchase_price = ?, selling_price = ? WHERE id = ?
    `).run(accessory.name, accessory.category, accessory.quantity, accessory.minStock, accessory.unit, accessory.purchasePrice || 0, accessory.sellingPrice || 0, accessory.id);
  }
  delete(id) {
    this.db.prepare("DELETE FROM accessories WHERE id = ?").run(id);
  }
};

// src/electron/repositories/thobeTypeRepository.ts
var ThobeTypeRepository = class {
  constructor(db) {
    this.db = db;
  }
  list() {
    return this.db.prepare("SELECT id, name, default_price as defaultPrice, description FROM dress_types ORDER BY name ASC").all();
  }
  insert(item) {
    const record = {
      id: item.id || `TH-${Date.now()}`,
      name: item.name || "\u0646\u0648\u0639 \u062C\u062F\u064A\u062F",
      defaultPrice: item.defaultPrice || 0,
      description: item.description || ""
    };
    this.db.prepare("INSERT INTO dress_types (id,name,default_price,description) VALUES (?,?,?,?)").run(record.id, record.name, record.defaultPrice, record.description);
    return record;
  }
  update(item) {
    this.db.prepare("UPDATE dress_types SET name=?, default_price=?, description=? WHERE id=?").run(item.name, item.defaultPrice || 0, item.description || "", item.id);
  }
  delete(id) {
    this.db.prepare("DELETE FROM dress_types WHERE id=?").run(id);
  }
};

// src/electron/repositories/colorRepository.ts
var ColorRepository = class {
  constructor(db) {
    this.db = db;
  }
  list() {
    return this.db.prepare("SELECT id, name, hex FROM colors ORDER BY name ASC").all();
  }
  insert(item) {
    const record = {
      id: item.id || `COL-${Date.now()}`,
      name: item.name || "\u0644\u0648\u0646 \u062C\u062F\u064A\u062F",
      hex: item.hex || "#ffffff"
    };
    this.db.prepare("INSERT INTO colors (id,name,hex) VALUES (?,?,?)").run(record.id, record.name, record.hex);
    return record;
  }
  update(item) {
    this.db.prepare("UPDATE colors SET name=?, hex=? WHERE id=?").run(item.name, item.hex, item.id);
  }
  delete(id) {
    this.db.prepare("DELETE FROM colors WHERE id=?").run(id);
  }
};

// src/electron/ipcHandlers.ts
var parseMeasurementsJson = (value) => {
  try {
    return normalizeMeasurements(JSON.parse(value || "{}"));
  } catch {
    return normalizeMeasurements();
  }
};
var parseStyleDetailsJson = (value) => {
  try {
    return normalizeStyleDetails(JSON.parse(value || "{}"));
  } catch {
    return normalizeStyleDetails();
  }
};
var mapOrderEvent = (row) => ({
  id: row.id,
  orderId: row.order_id,
  type: row.event_type,
  title: row.title,
  description: row.description,
  fromStatus: row.from_status || void 0,
  toStatus: row.to_status || void 0,
  actor: row.actor || void 0,
  metadata: row.metadata_json ? JSON.parse(row.metadata_json) : void 0,
  createdAt: row.created_at
});
var mapCashTransaction = (row) => ({
  id: row.id,
  direction: row.direction,
  sourceType: row.source_type,
  sourceId: row.source_id || void 0,
  orderId: row.order_id || void 0,
  referenceNumber: row.reference_number || void 0,
  amount: row.amount,
  paymentMethod: row.payment_method,
  transactionDate: row.transaction_date,
  description: row.description,
  notes: row.notes || void 0,
  createdAt: row.created_at
});
var mapPurchase = (row, lines) => ({
  id: row.id,
  supplier: row.supplier,
  invoiceNumber: row.invoice_number || void 0,
  purchaseDate: row.purchase_date,
  totalAmount: row.total_amount,
  paymentMethod: row.payment_method,
  notes: row.notes || void 0,
  status: row.status,
  lines: lines.filter((line) => line.purchase_id === row.id).map((line) => ({
    id: line.id,
    purchaseId: line.purchase_id,
    itemType: line.item_type,
    itemId: line.item_id,
    itemName: line.item_name,
    quantity: line.quantity,
    unit: line.unit,
    unitPrice: line.unit_price,
    totalAmount: line.total_amount,
    createdAt: line.created_at
  })),
  createdAt: row.created_at
});
var mapExpense = (row) => ({
  id: row.id,
  category: row.category,
  amount: row.amount,
  expenseDate: row.expense_date,
  paymentMethod: row.payment_method,
  description: row.description,
  notes: row.notes || void 0,
  createdAt: row.created_at
});
function registerIpcHandlers(dbManager) {
  const db = dbManager.getRawDb();
  const customerRepository = new CustomerRepository(db);
  const customerService = new CustomerService(customerRepository, db);
  const cashRepository = new CashRepository(db);
  const inventoryRepository = new InventoryRepository(db);
  const inventoryService = new InventoryService(inventoryRepository);
  const orderEventRepository = new OrderEventRepository(db);
  const accountingRepository = new AccountingRepository(db);
  const accountingService = new AccountingService(accountingRepository, inventoryService, cashRepository, db);
  const orderRepository = new OrderRepository(db);
  const orderWriteRepository = new OrderWriteRepository(db);
  const invoiceRepository = new InvoiceRepository(db);
  const paymentService = new PaymentService(invoiceRepository, orderWriteRepository, cashRepository, orderEventRepository, db);
  const orderStatusService = new OrderStatusService(orderRepository, orderWriteRepository, inventoryService, orderEventRepository, db);
  const notificationRepository = new NotificationRepository(db);
  const whatsappService = new WhatsAppService(notificationRepository, orderRepository, orderEventRepository);
  const orderService = new OrderService(orderRepository, orderWriteRepository, inventoryService, cashRepository, orderEventRepository, invoiceRepository, db);
  const fabricRepository = new FabricRepository(db);
  const accessoryRepository = new AccessoryRepository(db);
  const thobeTypeRepository = new ThobeTypeRepository(db);
  const colorRepository = new ColorRepository(db);
  safeIpcHandle(import_electron.ipcMain, "customers:list", async () => customerService.list());
  safeIpcHandle(import_electron.ipcMain, "customers:create", async (_, customer) => customerService.create(customer));
  safeIpcHandle(import_electron.ipcMain, "customers:update", async (_, customer) => customerService.update(customer));
  safeIpcHandle(import_electron.ipcMain, "customers:delete", async (_, customerId) => customerService.delete(customerId));
  safeIpcHandle(import_electron.ipcMain, "customers:saveMeasurementHistory", async (_, customerId, note) => customerService.saveMeasurementHistory(customerId, note));
  safeIpcHandle(import_electron.ipcMain, "fabrics:list", async () => fabricRepository.list());
  safeIpcHandle(import_electron.ipcMain, "fabrics:create", async (_, fabric) => fabricRepository.insert(fabric));
  safeIpcHandle(import_electron.ipcMain, "fabrics:update", async (_, fabric) => {
    fabricRepository.update(fabric);
    return true;
  });
  safeIpcHandle(import_electron.ipcMain, "fabrics:delete", async (_, fabricId) => {
    fabricRepository.delete(fabricId);
    return true;
  });
  safeIpcHandle(import_electron.ipcMain, "accessories:list", async () => accessoryRepository.list());
  safeIpcHandle(import_electron.ipcMain, "accessories:create", async (_, accessory) => accessoryRepository.insert(accessory));
  safeIpcHandle(import_electron.ipcMain, "accessories:update", async (_, accessory) => {
    accessoryRepository.update(accessory);
    return true;
  });
  safeIpcHandle(import_electron.ipcMain, "accessories:delete", async (_, accessoryId) => {
    accessoryRepository.delete(accessoryId);
    return true;
  });
  safeIpcHandle(import_electron.ipcMain, "stockMovements:list", async (_, itemType, itemId) => {
    return inventoryService.listMovements(itemType, itemId);
  });
  safeIpcHandle(import_electron.ipcMain, "stock:adjust", async (_, itemType, itemId, quantity, reason, direction = "adjustment") => {
    return inventoryService.adjustStock(itemType, itemId, quantity, reason, direction);
  });
  safeIpcHandle(import_electron.ipcMain, "purchases:list", async () => {
    const { rows, lines } = accountingService.listPurchases();
    return rows.map((row) => mapPurchase(row, lines));
  });
  safeIpcHandle(import_electron.ipcMain, "purchases:create", async (_, payload) => {
    const result = accountingService.createPurchase(payload);
    const purchase = accountingService.findPurchase(result.id);
    if (!purchase) throw new Error("\u062A\u0639\u0630\u0631 \u0642\u0631\u0627\u0621\u0629 \u0639\u0645\u0644\u064A\u0629 \u0627\u0644\u0634\u0631\u0627\u0621 \u0628\u0639\u062F \u0627\u0639\u062A\u0645\u0627\u062F\u0647\u0627");
    return mapPurchase(purchase.row, purchase.lines);
  });
  safeIpcHandle(import_electron.ipcMain, "expenses:list", async () => accountingService.listExpenses().map(mapExpense));
  safeIpcHandle(import_electron.ipcMain, "expenses:create", async (_, payload) => {
    const expenseId = accountingService.createExpense(payload);
    const expense = accountingService.findExpense(expenseId);
    if (!expense) throw new Error("\u062A\u0639\u0630\u0631 \u0642\u0631\u0627\u0621\u0629 \u0627\u0644\u0645\u0635\u0631\u0648\u0641 \u0628\u0639\u062F \u062D\u0641\u0638\u0647");
    return mapExpense(expense);
  });
  safeIpcHandle(import_electron.ipcMain, "cash:list", async () => {
    return cashRepository.list().map(mapCashTransaction);
  });
  safeIpcHandle(import_electron.ipcMain, "cash:createAdjustment", async (_, payload) => {
    const amount = normalizePositiveAmount(payload.amount, "\u0645\u0628\u0644\u063A \u0627\u0644\u062D\u0631\u0643\u0629");
    if (!payload.description?.trim()) throw new Error("\u0648\u0635\u0641 \u0627\u0644\u062D\u0631\u0643\u0629 \u0627\u0644\u0645\u0627\u0644\u064A\u0629 \u0645\u0637\u0644\u0648\u0628");
    const id = payload.id || `CASH-${Date.now()}`;
    const existing = cashRepository.findById(id);
    if (existing) return mapCashTransaction(existing);
    const transaction = {
      id,
      direction: payload.direction === "out" ? "out" : "in",
      sourceType: payload.sourceType || "adjustment",
      sourceId: payload.sourceId,
      referenceNumber: payload.referenceNumber,
      amount: round2(amount),
      paymentMethod: payload.paymentMethod || "cash",
      transactionDate: payload.transactionDate || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
      description: payload.description.trim(),
      notes: payload.notes,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    cashRepository.insert(transaction);
    return transaction;
  });
  safeIpcHandle(import_electron.ipcMain, "orderMaterials:list", async (_, orderId) => {
    const rows = orderRepository.listMaterialUsages(orderId);
    return rows.map((row) => ({
      id: row.id,
      orderId: row.order_id,
      itemType: row.item_type,
      itemId: row.item_id || void 0,
      itemName: row.item_name,
      quantity: row.quantity,
      unit: row.unit,
      unitCostAtUsage: row.unit_cost_at_usage,
      totalCost: row.total_cost,
      sourceMovementId: row.source_movement_id || void 0,
      createdAt: row.created_at
    }));
  });
  safeIpcHandle(import_electron.ipcMain, "thobeTypes:list", async () => thobeTypeRepository.list());
  safeIpcHandle(import_electron.ipcMain, "thobeTypes:create", async (_, item) => thobeTypeRepository.insert(item));
  safeIpcHandle(import_electron.ipcMain, "thobeTypes:update", async (_, item) => {
    thobeTypeRepository.update(item);
    return true;
  });
  safeIpcHandle(import_electron.ipcMain, "thobeTypes:delete", async (_, id) => {
    thobeTypeRepository.delete(id);
    return true;
  });
  safeIpcHandle(import_electron.ipcMain, "colors:list", async () => colorRepository.list());
  safeIpcHandle(import_electron.ipcMain, "colors:create", async (_, item) => colorRepository.insert(item));
  safeIpcHandle(import_electron.ipcMain, "colors:update", async (_, item) => {
    colorRepository.update(item);
    return true;
  });
  safeIpcHandle(import_electron.ipcMain, "colors:delete", async (_, id) => {
    colorRepository.delete(id);
    return true;
  });
  safeIpcHandle(import_electron.ipcMain, "orders:events:list", async (_, orderId) => {
    return orderEventRepository.list(orderId).map(mapOrderEvent);
  });
  safeIpcHandle(import_electron.ipcMain, "orders:list", async () => {
    const rows = orderRepository.list();
    const materialRows = orderRepository.listMaterialUsages();
    const materialsByOrder = /* @__PURE__ */ new Map();
    for (const row of materialRows) {
      const usage = {
        id: row.id,
        orderId: row.order_id,
        itemType: row.item_type,
        itemId: row.item_id || void 0,
        itemName: row.item_name,
        quantity: row.quantity,
        unit: row.unit,
        unitCostAtUsage: row.unit_cost_at_usage,
        totalCost: row.total_cost,
        sourceMovementId: row.source_movement_id || void 0,
        createdAt: row.created_at
      };
      materialsByOrder.set(row.order_id, [...materialsByOrder.get(row.order_id) || [], usage]);
    }
    return rows.map((o) => {
      const materialUsages = materialsByOrder.get(o.id) || [];
      const legacyFabricCost = materialUsages.length === 0 ? round2((o.fabric_consumption_meters || 0) * (o.fabric_buy_price_at_order || 0)) : 0;
      const materialCost = round2(materialUsages.reduce((sum, usage) => sum + usage.totalCost, 0) + legacyFabricCost);
      return {
        id: o.id,
        orderNumber: o.order_number,
        customerId: o.customer_id,
        customerName: o.customer_name,
        customerPhone: o.customer_phone,
        thobeTypeId: o.thobe_type_id,
        thobeTypeName: o.thobe_type_name,
        fabricId: o.fabric_id,
        fabricName: o.fabric_name,
        fabricColor: o.fabric_color,
        fabricConsumptionMeters: o.fabric_consumption_meters,
        fabricBuyPriceAtOrder: o.fabric_buy_price_at_order,
        garmentCount: o.garment_count,
        materialUsages,
        materialCost,
        profit: round2((o.total_amount || 0) - materialCost),
        orderDate: o.order_date,
        deliveryDate: o.delivery_date,
        status: o.status,
        totalAmount: o.total_amount,
        paidAmount: o.paid_amount,
        remainingAmount: o.remaining_amount,
        isCustomMeasurement: Boolean(o.is_custom_measurement),
        measurements: parseMeasurementsJson(o.measurements_json),
        styleDetails: parseStyleDetailsJson(o.style_details_json),
        notes: o.notes,
        createdAt: o.created_at
      };
    });
  });
  safeIpcHandle(import_electron.ipcMain, "orders:create", async (_, orderData) => {
    const settings = dbManager.getSettings();
    const result = orderService.createOrder(orderData, settings.fabricConsumptionRatePerGarment || 3.5);
    return {
      ...orderData,
      id: result.orderId,
      orderNumber: result.orderNumber,
      remainingAmount: result.remainingAmount,
      materialUsages: result.materialUsages,
      materialCost: result.materialCost,
      profit: result.profit,
      measurements: normalizeMeasurements(orderData.measurements),
      styleDetails: normalizeStyleDetails(orderData.styleDetails)
    };
  });
  safeIpcHandle(import_electron.ipcMain, "orders:update", async (_, updatedOrder) => {
    const settings = dbManager.getSettings();
    return orderService.updateOrder(updatedOrder, settings.fabricConsumptionRatePerGarment || 3.5);
  });
  safeIpcHandle(import_electron.ipcMain, "orders:delete", async (_, orderId) => {
    return orderService.deleteOrder(orderId);
  });
  safeIpcHandle(import_electron.ipcMain, "orders:updateStatus", async (_, orderId, status) => {
    return orderStatusService.updateStatus(orderId, status);
  });
  safeIpcHandle(import_electron.ipcMain, "invoices:list", async () => {
    const rows = invoiceRepository.list();
    return rows.map((i) => ({
      id: i.id,
      invoiceNumber: i.invoice_number,
      orderId: i.order_id,
      customerName: i.customer_name,
      customerPhone: i.customer_phone,
      orderDate: i.order_date,
      totalAmount: i.total_amount,
      paidAmount: i.paid_amount,
      remainingAmount: i.remaining_amount,
      paymentStatus: i.payment_status,
      payments: JSON.parse(i.payments_json || "[]")
    }));
  });
  safeIpcHandle(import_electron.ipcMain, "invoices:addPayment", async (_, invoiceId, amount, method, note, paymentId) => {
    return paymentService.addPayment(invoiceId, amount, method, note, paymentId);
  });
  safeIpcHandle(import_electron.ipcMain, "data:get", async () => {
    return dbManager.exportFullDataAsJson();
  });
  safeIpcHandle(import_electron.ipcMain, "data:save", async (_, data) => {
    if (!data || !Array.isArray(data.notifications)) return false;
    return dbManager.replaceNotifications(data.notifications);
  });
  safeIpcHandle(import_electron.ipcMain, "preferences:get", async () => {
    return dbManager.getUserPreferences();
  });
  safeIpcHandle(import_electron.ipcMain, "preferences:save", async (_, preferences) => {
    return dbManager.updateUserPreferences(preferences);
  });
  safeIpcHandle(import_electron.ipcMain, "system:backup", async () => {
    return dbManager.backupDatabase("manual_user");
  });
  safeIpcHandle(import_electron.ipcMain, "system:restore", async (_, jsonContent) => {
    return dbManager.restoreFromJson(jsonContent);
  });
  safeIpcHandle(import_electron.ipcMain, "system:clearAllData", async () => {
    return dbManager.clearAllData();
  });
  safeIpcHandle(import_electron.ipcMain, "reports:exportExcel", async (_, startDate, endDate) => {
    const buffer = await dbManager.generateExcelReport(startDate, endDate);
    return buffer.toString("base64");
  });
  safeIpcHandle(import_electron.ipcMain, "settings:get", async () => {
    return dbManager.getSettings();
  });
  safeIpcHandle(import_electron.ipcMain, "settings:update", async (_, key, value) => {
    dbManager.updateSetting(key, value);
    return true;
  });
  safeIpcHandle(import_electron.ipcMain, "whatsapp:send", async (_, phone, customerName, orderNumber, statusText) => {
    const whatsappUrl = whatsappService.logPreparedMessage(phone, customerName, orderNumber, statusText);
    try {
      const { shell } = require("electron");
      await shell.openExternal(whatsappUrl);
    } catch (e) {
      console.error("Failed to open external WhatsApp URL:", e);
    }
    return true;
  });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  registerIpcHandlers
});
//# sourceMappingURL=ipcHandlers.js.map
