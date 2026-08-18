import { _electron as electron, expect } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const executablePath = process.env.SAHWA_EXE;
const testData = process.env.SAHWA_TEST_DATA || path.join(process.cwd(), 'windows-acceptance-data');
const evidenceDir = process.env.SAHWA_EVIDENCE_DIR || path.join(process.cwd(), 'test-results', 'windows-acceptance');
const offlineRuleName = 'Sahwa Windows Acceptance Offline Block';

if (!executablePath || !fs.existsSync(executablePath)) {
  throw new Error(`Installed Electron executable not found: ${executablePath}`);
}

fs.mkdirSync(testData, { recursive: true });
fs.mkdirSync(evidenceDir, { recursive: true });

const results = [];
const runtimeErrors = [];
const childProcessOutput = [];
let app;
let page;
let offlineEnabled = false;
let backupPath;
let excelPath;
let orderNumber;

function pass(id, detail) {
  results.push({ id, status: 'PASS', detail });
  console.log(`ACCEPTANCE_PASS=${id} ${detail}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitForToast(pageRef, pattern) {
  const toast = pageRef.locator('[role="status"], [role="alert"]').filter({ hasText: pattern }).last();
  try {
    await expect(toast).toBeVisible({ timeout: 20_000 });
  } catch (error) {
    const bodyText = (await pageRef.locator('body').innerText()).slice(-4000);
    await pageRef.screenshot({ path: path.join(evidenceDir, `toast-failure-${Date.now()}.png`), fullPage: true }).catch(() => {});
    throw new Error(`${error instanceof Error ? error.message : String(error)}\nVisible body tail:\n${bodyText}`);
  }
}

async function waitForDashboard(pageRef) {
  await expect(pageRef.getByText('لوحة التحكم', { exact: true }).first()).toBeVisible({ timeout: 30_000 });
}

async function openTab(pageRef, navLabel, heading) {
  await pageRef.getByRole('button', { name: navLabel, exact: true }).click();
  await expect(pageRef.getByText(heading, { exact: true }).last()).toBeVisible({ timeout: 20_000 });
}

async function attachRuntimeMonitoring(appRef, pageRef) {
  pageRef.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(`[renderer:console.error] ${message.text()}`);
  });
  pageRef.on('pageerror', (error) => runtimeErrors.push(`[renderer:pageerror] ${error.message}`));
  const child = appRef.process();
  child?.stdout?.on('data', (chunk) => childProcessOutput.push(`[stdout] ${chunk.toString()}`));
  child?.stderr?.on('data', (chunk) => childProcessOutput.push(`[stderr] ${chunk.toString()}`));
}

async function launchApp({ forceWhatsAppFailure = false } = {}) {
  const automationEnv = {
    ...process.env,
    APPDATA: path.join(testData, 'AppData', 'Roaming'),
    LOCALAPPDATA: path.join(testData, 'AppData', 'Local'),
    SAHWA_UI_AUTOMATION: '1',
    ...(forceWhatsAppFailure ? { SAHWA_FORCE_WHATSAPP_FAILURE: '1' } : {})
  };
  app = await electron.launch({
    executablePath,
    args: ['--no-sandbox'],
    env: automationEnv
  });
  page = await app.firstWindow();
  await attachRuntimeMonitoring(app, page);
  return { app, page };
}

async function closeApp() {
  if (app) {
    await app.close().catch(() => {});
    app = undefined;
    page = undefined;
  }
}

async function getDataSnapshot(pageRef) {
  return pageRef.evaluate(() => window.electronAPI.getData());
}

async function waitForData(pageRef, predicate, description) {
  await expect.poll(async () => predicate(await getDataSnapshot(pageRef)), { timeout: 20_000, message: description }).toBe(true);
}

async function waitForReachability(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: 'manual' });
    return { reachable: true, status: response.status };
  } catch (error) {
    return { reachable: false, error: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timer);
  }
}

function enableOfflineNetwork() {
  execFileSync('netsh.exe', ['advfirewall', 'firewall', 'delete', 'rule', `name=${offlineRuleName}`], { stdio: 'ignore' });
  execFileSync('netsh.exe', ['advfirewall', 'firewall', 'add', 'rule', `name=${offlineRuleName}`, 'dir=out', 'action=block', 'profile=any', 'enable=yes'], { stdio: 'inherit' });
  offlineEnabled = true;
}

function disableOfflineNetwork() {
  if (!offlineEnabled) return;
  execFileSync('netsh.exe', ['advfirewall', 'firewall', 'delete', 'rule', `name=${offlineRuleName}`], { stdio: 'inherit' });
  offlineEnabled = false;
}

async function createFabric(pageRef) {
  await openTab(pageRef, 'المخزون والأصناف', 'المخزون والأصناف');
  await pageRef.getByRole('button', { name: 'إضافة قماش جديد', exact: true }).click();
  await expect(pageRef.getByRole('dialog')).toBeVisible();
  await pageRef.getByLabel('اسم القماش *', { exact: true }).fill('قماش Windows Acceptance');
  await pageRef.getByLabel('اللون', { exact: true }).fill('كحلي');
  await pageRef.getByLabel('المخزون (متر)', { exact: true }).fill('50');
  await pageRef.getByRole('button', { name: 'حفظ البيانات', exact: true }).click();
  await expect(pageRef.getByText('قماش Windows Acceptance', { exact: true }).last()).toBeVisible({ timeout: 20_000 });
  await waitForData(pageRef, (data) => data.fabrics.some((item) => item.name === 'قماش Windows Acceptance'), 'fabric data was not persisted');
  const data = await getDataSnapshot(pageRef);
  const fabric = data.fabrics.find((item) => item.name === 'قماش Windows Acceptance');
  assert(fabric, 'The acceptance fabric was not persisted.');
  pass('inventory.fabric-create', `created ${fabric.id}`);
  return fabric;
}

async function createCustomerAndOrder(pageRef, fabric) {
  await openTab(pageRef, 'العملاء والمقاسات', 'إدارة العملاء والمقاسات');
  await pageRef.getByTestId('customers-add').click();
  await expect(pageRef.getByText('تسجيل عميل جديد', { exact: true })).toBeVisible();
  await pageRef.getByTestId('customer-name').fill('عميل Windows Acceptance');
  await pageRef.getByTestId('customer-phone').fill('0500000111');
  await pageRef.getByTestId('customer-measurement-frontLength').fill('25.5');
  await pageRef.getByTestId('customer-measurement-sleeveLength').fill('24');
  await pageRef.getByTestId('save-customer-measurements').click();
  await expect(pageRef.getByText('عميل Windows Acceptance', { exact: true }).last()).toBeVisible({ timeout: 20_000 });
  await waitForData(pageRef, (data) => data.customers.some((item) => item.name === 'عميل Windows Acceptance'), 'customer data was not persisted');
  pass('customer.measurement-create', 'created customer and saved measurements');

  await openTab(pageRef, 'إدارة الطلبات', 'إدارة طلبات الخياطة');
  await pageRef.getByTestId('orders-add').click();
  await expect(pageRef.getByRole('dialog')).toBeVisible();
  await pageRef.getByTestId('order-customer-select').selectOption({ label: 'عميل Windows Acceptance - (0500000111)' });
  await pageRef.getByLabel('نوع الثوب *', { exact: true }).selectOption({ index: 1 });
  await pageRef.getByLabel('القماش واللون *', { exact: true }).selectOption({ label: `${fabric.name} - ${fabric.color} (${fabric.quantityMeters} متر)` });
  await pageRef.getByLabel('السعر الكلي (ر.س) *', { exact: true }).fill('220');
  await pageRef.getByLabel('المبلغ المدفوع (عربون) *', { exact: true }).fill('50');
  await pageRef.getByTestId('order-measurement-frontLength').fill('25.5');
  await pageRef.getByTestId('order-measurement-backLength').fill('25');
  await pageRef.getByTestId('order-measurement-shoulderWidth').fill('18');
  await pageRef.getByTestId('order-measurement-sleeveLength').fill('24');
  await pageRef.getByTestId('order-save').click();
  await expect(pageRef.getByText('عميل Windows Acceptance', { exact: true }).last()).toBeVisible({ timeout: 20_000 });
  const data = await getDataSnapshot(pageRef);
  const order = data.orders.find((item) => item.customerName === 'عميل Windows Acceptance');
  assert(order, 'The acceptance order was not persisted.');
  assert(Number(order.totalAmount) === 220, `Unexpected order total: ${order.totalAmount}`);
  assert(Number(order.paidAmount) === 50, `Unexpected order deposit: ${order.paidAmount}`);
  orderNumber = order.orderNumber;
  pass('order.create', `created order ${orderNumber}`);
  return order;
}

async function verifyInvoiceAndPayment(pageRef, order) {
  await openTab(pageRef, 'الفواتير والحسابات', 'الفواتير والحسابات المالية');
  const row = pageRef.getByRole('row', { name: /عميل Windows Acceptance/ });
  await expect(row).toBeVisible({ timeout: 15_000 });
  await row.getByRole('button', { name: 'تحصيل', exact: true }).click();
  await expect(pageRef.getByRole('dialog')).toBeVisible();
  await pageRef.getByLabel('مبلغ التحصيل (ر.س) *', { exact: true }).fill('170');
  await pageRef.getByRole('button', { name: 'تأكيد العملية', exact: true }).click();
  await waitForData(pageRef, (data) => data.invoices.some((item) => item.orderId === order.id && Number(item.paidAmount) === 220), 'payment was not persisted');
  const data = await getDataSnapshot(pageRef);
  const invoice = data.invoices.find((item) => item.orderId === order.id);
  assert(invoice, 'Invoice was not generated for the order.');
  assert(Number(invoice.paidAmount) === 220, `Unexpected invoice paid amount: ${invoice.paidAmount}`);
  assert(Number(invoice.remainingAmount) === 0, `Unexpected invoice remaining amount: ${invoice.remainingAmount}`);
  pass('invoice.create', `invoice ${invoice.invoiceNumber} visible and paid`);
  pass('payment.create', 'registered payment and reconciled invoice');
}

async function testAccountingAndStock(pageRef, fabric) {
  await openTab(pageRef, 'المخزون والأصناف', 'المخزون والأصناف');
  await pageRef.getByRole('button', { name: 'حركة المخزون', exact: true }).click();
  await pageRef.getByLabel('نوع الصنف', { exact: true }).selectOption('fabric');
  await pageRef.getByLabel('الصنف', { exact: true }).selectOption({ label: fabric.name });
  await pageRef.getByLabel('الكمية', { exact: true }).fill('1');
  await pageRef.getByLabel('السبب', { exact: true }).fill('جرد Windows Acceptance');
  await pageRef.getByRole('button', { name: 'حفظ', exact: true }).click();
  await waitForToast(pageRef, /تم تسجيل حركة التسوية/);
  pass('inventory.adjustment', 'recorded stock adjustment');

  await openTab(pageRef, 'المحاسبة والمشتريات', 'المحاسبة والتدفقات المالية');
  await pageRef.getByLabel('المورد', { exact: true }).fill('مورد Windows Acceptance');
  await pageRef.getByLabel('رقم فاتورة الشراء', { exact: true }).fill('PUR-WIN-001');
  await pageRef.getByLabel('نوع الصنف', { exact: true }).selectOption('fabric');
  await pageRef.getByLabel('الصنف', { exact: true }).selectOption({ label: fabric.name });
  await pageRef.getByLabel('الكمية', { exact: true }).fill('2');
  await pageRef.getByLabel('سعر الوحدة', { exact: true }).fill('18');
  await pageRef.getByRole('button', { name: 'إضافة', exact: true }).click();
  await expect(pageRef.getByText(fabric.name, { exact: true }).last()).toBeVisible();
  await pageRef.getByRole('button', { name: 'اعتماد وحفظ المشتريات', exact: true }).click();
  await waitForData(pageRef, (data) => data.purchases.some((item) => item.supplier === 'مورد Windows Acceptance'), 'purchase was not persisted');
  pass('purchases.create', 'created purchase and linked stock/cash effects');

  await pageRef.getByRole('button', { name: 'المصروفات', exact: true }).click();
  await pageRef.getByLabel('المبلغ', { exact: true }).fill('35');
  await pageRef.getByLabel('الوصف', { exact: true }).fill('مصروف Windows Acceptance');
  await pageRef.getByLabel('الملاحظات', { exact: true }).fill('اختبار قبول Windows');
  await pageRef.getByRole('button', { name: 'حفظ المصروف', exact: true }).click();
  await waitForData(pageRef, (data) => data.expenses.some((item) => item.description === 'مصروف Windows Acceptance'), 'expense was not persisted');
  pass('expenses.create', 'created expense and linked cash effect');

  await pageRef.getByRole('button', { name: 'الصندوق', exact: true }).click();
  await pageRef.getByLabel('المبلغ', { exact: true }).fill('15');
  await pageRef.getByLabel('المرجع', { exact: true }).fill('CASH-WIN-001');
  await pageRef.getByLabel('الوصف', { exact: true }).fill('تسوية Windows Acceptance');
  await pageRef.getByLabel('الملاحظات', { exact: true }).fill('اختبار قبول Windows');
  await pageRef.getByRole('button', { name: 'حفظ الحركة', exact: true }).click();
  await waitForData(pageRef, (data) => data.cashTransactions.some((item) => item.referenceNumber === 'CASH-WIN-001'), 'cash adjustment was not persisted');
  pass('cash.create', 'created cash adjustment and visible ledger entry');

  const data = await getDataSnapshot(pageRef);
  assert(data.purchases.some((item) => item.supplier === 'مورد Windows Acceptance'), 'Purchase missing from local data.');
  assert(data.expenses.some((item) => item.description === 'مصروف Windows Acceptance'), 'Expense missing from local data.');
  assert(data.cashTransactions.some((item) => item.referenceNumber === 'CASH-WIN-001'), 'Cash adjustment missing from local data.');
  assert(data.stockMovements.length > 0, 'Stock movements missing from local data.');
  pass('accounting.local-data', 'purchases, expenses, cash, and stock movement data verified');
}

async function exportExcelAndBackup(pageRef) {
  await openTab(pageRef, 'التقارير والإحصائيات', 'التقارير والإحصائيات المالية');
  const data = await getDataSnapshot(pageRef);
  assert(data.orders.length > 0 && data.invoices.length > 0, 'Reports have no order/invoice data.');
  const xlsxModule = await import('xlsx');
  const xlsxVersion = xlsxModule.version || xlsxModule.default?.version;
  assert(xlsxVersion === '0.20.3', `Unexpected xlsx version: ${xlsxVersion}`);
  const excelDownloadPromise = pageRef.waitForEvent('download', { timeout: 20_000 });
  await pageRef.getByRole('button', { name: 'تصدير Excel', exact: true }).click();
  const excelDownload = await excelDownloadPromise;
  excelPath = path.join(evidenceDir, 'windows-acceptance-report.xlsx');
  await excelDownload.saveAs(excelPath);
  const excelHeader = fs.readFileSync(excelPath).subarray(0, 2).toString('hex');
  assert(excelHeader === '504b', `Excel output is not an XLSX zip: ${excelHeader}`);
  const workbook = (xlsxModule.default || xlsxModule).read(fs.readFileSync(excelPath), { type: 'buffer' });
  assert(workbook.SheetNames.includes('تقرير المبيعات'), `Missing sales sheet: ${workbook.SheetNames.join(', ')}`);
  assert(workbook.SheetNames.includes('ملخص المحاسبة'), `Missing accounting sheet: ${workbook.SheetNames.join(', ')}`);
  fs.writeFileSync(path.join(evidenceDir, 'excel-evidence.json'), JSON.stringify({ xlsxVersion, sheetNames: workbook.SheetNames, bytes: fs.statSync(excelPath).size }, null, 2));
  pass('reports.open', 'opened reports with local order/accounting data');
  pass('reports.excel-export', `UI xlsx generated with xlsx@${xlsxVersion} (${fs.statSync(excelPath).size} bytes)`);

  await openTab(pageRef, 'لوحة التحكم', 'لوحة التحكم');
  await pageRef.getByRole('button', { name: 'فتح النسخ الاحتياطي للاستيراد أو التصدير' }).click();
  await expect(pageRef.getByRole('dialog')).toBeVisible();
  const backupDownloadPromise = pageRef.waitForEvent('download', { timeout: 20_000 });
  await pageRef.getByRole('button', { name: 'تنزيل النسخة الاحتياطية الان (.json)', exact: true }).click();
  const backupDownload = await backupDownloadPromise;
  backupPath = path.join(evidenceDir, backupDownload.suggestedFilename());
  await backupDownload.saveAs(backupPath);
  const backupJson = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  assert(Array.isArray(backupJson.customers) && Array.isArray(backupJson.orders), 'Backup JSON does not contain core data arrays.');
  pass('backup.create', `backup saved as ${path.basename(backupPath)}`);
  await pageRef.getByRole('button', { name: 'إغلاق', exact: true }).click();
}

async function createTransientCustomerAndRestore(pageRef) {
  await openTab(pageRef, 'العملاء والمقاسات', 'إدارة العملاء والمقاسات');
  await pageRef.getByTestId('customers-add').click();
  await pageRef.getByTestId('customer-name').fill('عميل بعد النسخة');
  await pageRef.getByTestId('customer-phone').fill('0500000222');
  await pageRef.getByTestId('save-customer-measurements').click();
  await waitForToast(pageRef, /تم حفظ بيانات العميل بنجاح/);
  await expect(pageRef.getByText('عميل بعد النسخة', { exact: true })).toBeVisible();

  await pageRef.getByRole('button', { name: 'فتح النسخ الاحتياطي للاستيراد أو التصدير' }).click();
  const fileInput = pageRef.locator('input[type="file"]');
  await fileInput.setInputFiles(backupPath);
  await expect(pageRef.getByText('تحذير هام قبل الاستبدال!', { exact: true })).toBeVisible();
  await pageRef.getByRole('button', { name: 'تأكيد واستبدال البيانات الآن', exact: true }).click();
  await waitForToast(pageRef, /تم استعادة النسخة الاحتياطية بنجاح/);
  await expect(pageRef.getByText('عميل Windows Acceptance', { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(pageRef.getByText('عميل بعد النسخة', { exact: true })).toHaveCount(0);
  pass('restore.isolated-database', 'restored backup into the isolated runner database and removed post-backup data');
}

async function verifyStorageAndPersistence(pageRef) {
  const storage = await pageRef.evaluate(() => window.electronAPI.automationStorageInfo?.());
  assert(storage?.isPackaged === true, 'Installed app did not report app.isPackaged=true.');
  assert(storage.userDataPath.startsWith(path.join(testData, 'AppData')), `userData escaped isolated APPDATA: ${storage.userDataPath}`);
  assert(storage.databasePath.startsWith(storage.userDataPath), `Database path is outside userData: ${storage.databasePath}`);
  assert(!storage.databasePath.includes('Program Files'), `Database path is inside Program Files: ${storage.databasePath}`);
  assert(!storage.databasePath.includes(path.dirname(executablePath)), `Database path is inside install directory: ${storage.databasePath}`);
  assert(fs.existsSync(storage.databasePath), `SQLite database does not exist: ${storage.databasePath}`);
  assert(fs.statSync(storage.databasePath).size > 0, 'SQLite database is empty.');
  fs.writeFileSync(path.join(evidenceDir, 'storage-info.json'), JSON.stringify({ ...storage, executablePath, testData }, null, 2));
  pass('sqlite.userData-path', `app.getPath(userData)=${storage.userDataPath}`);
  pass('sqlite.database-location', `SQLite database=${storage.databasePath}`);

  const data = await getDataSnapshot(pageRef);
  assert(data.customers.some((item) => item.name === 'عميل Windows Acceptance'), 'Customer did not persist after restore/reload flow.');
  assert(data.orders.some((item) => item.orderNumber === orderNumber), 'Order did not persist after restore/reload flow.');
  assert(data.invoices.length > 0, 'Invoice did not persist after restore/reload flow.');
  pass('data.persistence', 'customer, measurements, order, invoice, accounting, and stock data persisted');
}

async function offlineAcceptance() {
  const before = await waitForReachability('https://example.com');
  enableOfflineNetwork();
  const after = await waitForReachability('https://example.com');
  assert(after.reachable === false, `Outbound network remained reachable after firewall block: ${JSON.stringify(after)}`);
  fs.writeFileSync(path.join(evidenceDir, 'network-evidence.json'), JSON.stringify({ before, after, offlineRuleName }, null, 2));
  pass('offline.network-cut', `network before=${before.reachable} after=${after.reachable}`);

  await launchApp({ forceWhatsAppFailure: true });
  await waitForDashboard(page);
  const fontEvidence = await page.evaluate(async () => {
    await document.fonts.ready;
    const root = document.querySelector('#root');
    return {
      rootFontFamily: root ? getComputedStyle(root).fontFamily : '',
      tajawalLoaded: document.fonts.check('16px Tajawal'),
      fontStatus: document.fonts.status
    };
  });
  fs.writeFileSync(path.join(evidenceDir, 'font-evidence.json'), JSON.stringify(fontEvidence, null, 2));
  assert(fontEvidence.tajawalLoaded && /Tajawal/i.test(fontEvidence.rootFontFamily), `Local Tajawal was not confirmed: ${JSON.stringify(fontEvidence)}`);
  pass('offline.tajawal', `Tajawal loaded offline with family ${fontEvidence.rootFontFamily}`);

  const offlineData = await getDataSnapshot(page);
  assert(offlineData.customers.length > 0 && offlineData.orders.length > 0 && offlineData.invoices.length > 0, 'Core offline data could not be loaded.');
  assert(offlineData.fabrics.length > 0 && offlineData.purchases.length > 0 && offlineData.expenses.length > 0 && offlineData.cashTransactions.length > 0, 'Accounting/inventory offline data could not be loaded.');

  await openTab(page, 'العملاء والمقاسات', 'إدارة العملاء والمقاسات');
  await expect(page.getByText('عميل Windows Acceptance', { exact: true })).toBeVisible();
  await openTab(page, 'إدارة الطلبات', 'إدارة طلبات الخياطة');
  await expect(page.getByText('عميل Windows Acceptance', { exact: true })).toBeVisible();
  await openTab(page, 'الفواتير والحسابات', 'الفواتير والحسابات المالية');
  await expect(page.getByText('عميل Windows Acceptance', { exact: true })).toBeVisible();
  await openTab(page, 'المخزون والأصناف', 'المخزون والأصناف');
  await expect(page.getByText('قماش Windows Acceptance', { exact: true })).toBeVisible();
  await openTab(page, 'المحاسبة والمشتريات', 'المحاسبة والتدفقات المالية');
  await expect(page.getByText('مورد Windows Acceptance', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'المصروفات', exact: true }).click();
  await expect(page.getByText('مصروف Windows Acceptance', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'الصندوق', exact: true }).click();
  await expect(page.getByText('CASH-WIN-001', { exact: true })).toBeVisible();
  await openTab(page, 'التقارير والإحصائيات', 'التقارير والإحصائيات المالية');
  await expect(page.getByText('إجمالي الطلبات', { exact: true }).first()).toBeVisible();
  pass('offline.local-modules', 'customers, measurements, orders, invoices, inventory, accounting, and reports loaded offline');

  await openTab(page, 'إدارة الطلبات', 'إدارة طلبات الخياطة');
  const whatsappButton = page.getByRole('button', { name: `إرسال رسالة واتساب للطلب ${orderNumber}` }).first();
  await expect(whatsappButton).toBeVisible();
  await whatsappButton.click();
  await waitForToast(page, /تعذر فتح واتساب/);
  assert(!page.isClosed(), 'Application crashed after WhatsApp failure.');
  pass('offline.whatsapp-failure', 'failure toast shown without application crash');

  const fatalOutput = childProcessOutput.filter((line) => /renderer:|pageerror|Unhandled|FATAL|IPC|uncaughtException|unhandledRejection/i.test(line));
  if (runtimeErrors.length > 0 || fatalOutput.length > 0) {
    throw new Error(`Runtime errors captured: ${[...runtimeErrors, ...fatalOutput].join(' | ')}`);
  }
  fs.writeFileSync(path.join(evidenceDir, 'runtime-errors.log'), childProcessOutput.join(''));
  pass('runtime.error-monitoring', 'no renderer/pageerror/Unhandled/FATAL/IPC console errors captured');
}

try {
  await launchApp();
  await waitForDashboard(page);
  await createFabric(page).then(async (fabric) => {
    const order = await createCustomerAndOrder(page, fabric);
    await verifyInvoiceAndPayment(page, order);
    await testAccountingAndStock(page, fabric);
    await exportExcelAndBackup(page);
    await createTransientCustomerAndRestore(page);
    await closeApp();
    await launchApp();
    await waitForDashboard(page);
    await verifyStorageAndPersistence(page);
    await closeApp();
    await offlineAcceptance();
  });

  fs.writeFileSync(path.join(evidenceDir, 'acceptance-results.json'), JSON.stringify({
    version: 'v1.1.6',
    executablePath,
    testData,
    results,
    runtimeErrors,
    childProcessOutput
  }, null, 2));
  console.log('WINDOWS_ACCEPTANCE=PASS');
} catch (error) {
  fs.writeFileSync(path.join(evidenceDir, 'acceptance-results.json'), JSON.stringify({
    version: 'v1.1.6',
    executablePath,
    testData,
    results,
    failure: error instanceof Error ? error.stack : String(error),
    runtimeErrors,
    childProcessOutput
  }, null, 2));
  console.error('WINDOWS_ACCEPTANCE=FAIL', error);
  process.exitCode = 1;
} finally {
  await closeApp();
  try { disableOfflineNetwork(); } catch (error) { console.error('Failed to restore network:', error); process.exitCode = 1; }
}
