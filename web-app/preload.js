const { contextBridge, ipcRenderer } = require('electron');

// Exponera endast de funktioner som behöver vara tillgängliga för renderer-procesen
contextBridge.exposeInMainWorld("electron", {
  // Funktion för att hämta data från backend (via main-processen)
  getData: () => ipcRenderer.invoke("get-data"),

  // Funktion för att skicka en meddelande till main-processen
  sendMessage: (message) => ipcRenderer.send("send-message", message),

  // Exempel på en funktion som kan lyssna på main-processen
  onMessageReceived: (callback) => ipcRenderer.on("message-received", callback),

  // Hantera autentisering eller annan specifik funktionalitet
  authenticate: (credentials) => ipcRenderer.invoke("authenticate", credentials),
});
