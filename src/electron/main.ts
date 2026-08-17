import { app, BrowserWindow } from 'electron';
import path from 'path';
import { SahwaDatabaseManager } from './db';
import { registerIpcHandlers } from './ipcHandlers';

let mainWindow: BrowserWindow | null = null;
let dbManager: SahwaDatabaseManager | null = null;
let isClosing = false;

async function closeResourcesOnce(): Promise<void> {
  if (isClosing) return;
  isClosing = true;
  if (dbManager) {
    try {
      await dbManager.close();
    } catch (error) {
      console.error('Error during database close:', error);
    }
  }
}

function createWindow() {
  app.setAppUserModelId('com.sahwa.tailoring');
  const userDataDir = app.getPath('userData');
  const databaseDir = path.join(userDataDir, 'database');
  const backupDir = path.join(userDataDir, 'backups');
  const legacyDataDir = path.join(process.cwd(), 'data');

  dbManager = new SahwaDatabaseManager(databaseDir, legacyDataDir, backupDir);
  const initResult = dbManager.initDatabase();

  if (!initResult.success) {
    throw new Error(initResult.error || 'تعذر تهيئة قاعدة بيانات صهوة');
  }
  if (initResult.corruptedRecoveryMessage) {
    console.warn('DB Recovery Notice:', initResult.corruptedRecoveryMessage);
  }

  registerIpcHandlers(dbManager);

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    title: 'صهوة للخياطة الرجالية - إدارة المحل والمأخوذات',
    icon: path.join(__dirname, '../build/icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', async () => {
  await closeResourcesOnce();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async (event) => {
  if (isClosing) return;
  event.preventDefault();
  await closeResourcesOnce();
  app.exit(0);
});
