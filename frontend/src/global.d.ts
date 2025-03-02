declare global {
  // Utöka Window-objektet med en electron-egenskap
  interface Window {
    electron: {
      // Skicka meddelande till main-processen
      send: (channel: string, data: any) => void; 
      
      // Ta emot meddelande från main-processen
      receive: (channel: string, func: (data: any) => void) => void; 
    };
  }
}

// Exporten gör så att TypeScript behandlar denna fil som en modul
export {};
