import fs from 'node:fs';
import path from 'node:path';

const port = process.env.CDP_PORT || '9333';
const outputDir = process.env.DESKTOP_VISUAL_OUTPUT_DIR || path.join(process.cwd(), 'acceptance-results', 'visual', 'desktop-viewport');
const viewportCases = [
  { name: '1360x800', width: 1360, height: 800 },
  { name: '1600x950', width: 1600, height: 950 },
  { name: '1920x1080', width: 1920, height: 1080 }
];

fs.mkdirSync(outputDir, { recursive: true });

async function waitForTarget() {
  const deadline = Date.now() + 30_000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      const targets = await response.json();
      const target = targets.find((item) => item.type === 'page' && item.url !== 'about:blank');
      if (target?.webSocketDebuggerUrl) return target;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`لم يتم العثور على نافذة Electron عبر CDP على المنفذ ${port}: ${lastError?.message || 'انتهت المهلة'}`);
}

const target = await waitForTarget();
const browserInfo = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();

function createConnection(url) {
  const socket = new WebSocket(url);
  let nextId = 0;
  const pending = new Map();
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    const resolver = pending.get(message.id);
    if (resolver) {
      pending.delete(message.id);
      resolver(message);
    }
  });
  const ready = new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  const command = async (method, params = {}) => {
    await ready;
    return new Promise((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, resolve);
      socket.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (pending.delete(id)) reject(new Error(`انتهت مهلة CDP: ${method}`));
      }, 10_000);
    });
  };
  return { socket, command };
}

const pageConnection = createConnection(target.webSocketDebuggerUrl);
const browserConnection = createConnection(browserInfo.webSocketDebuggerUrl);
const command = pageConnection.command;
const browserCommand = browserConnection.command;

async function evaluate(expression) {
  const response = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails));
  return response.result?.result?.value;
}

await command('Runtime.enable');
await command('Page.enable');

const readyDeadline = Date.now() + 30_000;
while (Date.now() < readyDeadline) {
  const ready = await evaluate(`Boolean(document.getElementById('root')?.textContent?.trim())`);
  if (ready) break;
  await new Promise((resolve) => setTimeout(resolve, 500));
}

await evaluate(`(() => {
  const button = Array.from(document.querySelectorAll('button')).find((element) => element.innerText.trim() === 'التقارير والإحصائيات');
  if (button) button.click();
  return Boolean(button);
})()`);
await new Promise((resolve) => setTimeout(resolve, 500));

let resizeMode = 'native-window';
let windowId;
try {
  const windowInfo = await browserCommand('Browser.getWindowForTarget', { targetId: target.id });
  if (windowInfo.error || !windowInfo.result?.windowId) throw new Error(windowInfo.error?.message || JSON.stringify(windowInfo));
  windowId = windowInfo.result.windowId;
} catch {
  resizeMode = 'emulated-viewport';
}

const results = [];
for (const viewport of viewportCases) {
  if (resizeMode === 'native-window') {
    await browserCommand('Browser.setWindowBounds', {
      windowId,
      bounds: { windowState: 'normal', width: viewport.width, height: viewport.height }
    });
  } else {
    await command('Emulation.setDeviceMetricsOverride', {
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: 1,
      mobile: false,
      screenWidth: viewport.width,
      screenHeight: viewport.height
    });
  }
  await new Promise((resolve) => setTimeout(resolve, 700));

  const snapshot = await evaluate(`(() => {
    const root = document.getElementById('root');
    const emptyStates = Array.from(document.querySelectorAll('.sahwa-empty-state')).map((element) => ({
      compact: element.classList.contains('sahwa-empty-state--compact'),
      title: element.querySelector('.sahwa-empty-state-title')?.textContent?.trim() || ''
    }));
    return {
      expected: ${JSON.stringify(viewport)},
      outer: { width: window.outerWidth, height: window.outerHeight },
      inner: { width: window.innerWidth, height: window.innerHeight },
      devicePixelRatio: window.devicePixelRatio,
      title: document.title,
      hasRoot: Boolean(root),
      visible: Boolean(root && root.getBoundingClientRect().width > 0 && root.getBoundingClientRect().height > 0),
      hasReportHeading: document.body.innerText.includes('التقارير والإحصائيات المالية'),
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      cardCount: document.querySelectorAll('.sahwa-card, .ui-card').length,
      tableCount: document.querySelectorAll('table').length,
      emptyStates,
      bodyText: document.body.innerText.slice(0, 1200)
    };
  })()`);

  const screenshot = await command('Page.captureScreenshot', { format: 'png', fromSurface: true });
  fs.writeFileSync(path.join(outputDir, `${viewport.name}.png`), Buffer.from(screenshot.result.data, 'base64'));
  fs.writeFileSync(path.join(outputDir, `${viewport.name}.json`), JSON.stringify(snapshot, null, 2));

  const passed = snapshot.hasRoot && snapshot.visible && snapshot.hasReportHeading && !snapshot.horizontalOverflow;
  results.push({
    name: viewport.name,
    expected: viewport,
    actual: snapshot.inner,
    outer: snapshot.outer,
    mode: resizeMode,
    passed,
    horizontalOverflow: snapshot.horizontalOverflow,
    cardCount: snapshot.cardCount,
    tableCount: snapshot.tableCount,
    emptyStates: snapshot.emptyStates
  });
  if (!passed) throw new Error(`فشل الفحص البصري لحجم ${viewport.name}: ${JSON.stringify(results.at(-1))}`);
}
if (resizeMode === 'emulated-viewport') await command('Emulation.clearDeviceMetricsOverride');

const summary = {
  generatedAt: new Date().toISOString(),
  target: { url: target.url, type: target.type },
  resizeMode,
  cases: results,
  passed: results.every((result) => result.passed),
  count: { total: results.length, passed: results.filter((result) => result.passed).length, failed: results.filter((result) => !result.passed).length }
};
fs.writeFileSync(path.join(outputDir, 'summary.json'), JSON.stringify(summary, null, 2));
pageConnection.socket.close();
browserConnection.socket.close();
console.log(JSON.stringify(summary, null, 2));
