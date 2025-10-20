// main.js
// Імпортуємо модулі 'app' (керує життєвим циклом)
// та 'BrowserWindow' (створює вікна)
const { app, BrowserWindow } = require('electron');
const path = require('path');

// Функція для створення вікна
const createWindow = () => {
  // Створюємо нове вікно браузера
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js') // якщо потрібно
    }
  });

  // Завантажуємо файл index.html у це вікно
  win.loadFile('index.html');
};

// Викликаємо функцію createWindow(), коли Electron готовий
app.whenReady().then(() => {
  createWindow();

  // Для macOS: відкриваємо нове вікно, якщо немає відкритих
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Закриваємо додаток, коли всі вікна закриті
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
