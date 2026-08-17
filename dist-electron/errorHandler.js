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

// src/electron/errorHandler.ts
var errorHandler_exports = {};
__export(errorHandler_exports, {
  safeIpcHandle: () => safeIpcHandle,
  translateDatabaseError: () => translateDatabaseError
});
module.exports = __toCommonJS(errorHandler_exports);
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
function safeIpcHandle(ipcMain, channel, handler) {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      return await handler(event, ...args);
    } catch (error) {
      const friendlyError = translateDatabaseError(error);
      throw friendlyError;
    }
  });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  safeIpcHandle,
  translateDatabaseError
});
//# sourceMappingURL=errorHandler.js.map
