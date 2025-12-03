import { AppData, INITIAL_DATA } from '../types';
import { db, doc, setDoc, onSnapshot, isFirebaseConnected } from './firebase';

const STORAGE_KEY = 'kpi_manager_v3_db';
const DOC_ID = 'company_data'; // ID único para a empresa na coleção

export const storageService = {
  // Subscribe to real-time updates (Cloud) or Load Once (Local)
  subscribe: (onData: (data: AppData) => void) => {
    // Check connection status
    if (isFirebaseConnected() && db) {
      console.log("StorageService: Conectando via Nuvem...");
      // Cloud Mode
      const unsub = onSnapshot(doc(db, "kpi_system", DOC_ID), (docSnap: any) => {
        if (docSnap.exists()) {
          onData({ ...INITIAL_DATA, ...docSnap.data() });
        } else {
          // If doc doesn't exist in cloud, init it
          onData(INITIAL_DATA);
        }
      });
      return unsub;
    } else {
      console.log("StorageService: Conectando via LocalStorage...");
      // Local Mode
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        onData({ ...INITIAL_DATA, ...JSON.parse(raw) });
      } else {
        onData(INITIAL_DATA);
      }
      return () => {};
    }
  },

  save: async (data: AppData) => {
    if (isFirebaseConnected() && db) {
      // Save to Cloud
      try {
        await setDoc(doc(db, "kpi_system", DOC_ID), data);
      } catch (e) {
        console.error("Erro ao salvar no Firebase", e);
        alert("Erro ao salvar online. Verifique sua conexão e permissões.");
      }
    } else {
      // Save to Local
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch (e) {
        console.error('Failed to save data locally', e);
      }
    }
  },

  exportData: (data: AppData) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "kpi_database_backup.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  },

  // Helper to parse Excel/CSV for bulk import
  parseExcel: (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          if (!e.target || !e.target.result) {
            reject(new Error("Falha na leitura do arquivo"));
            return;
          }

          // Use Uint8Array to handle binary data correctly
          const data = new Uint8Array(e.target.result as ArrayBuffer);
          
          const XLSX = window.XLSX;
          
          if (!XLSX) {
            reject(new Error("Biblioteca XLSX não carregada. Verifique sua conexão com a internet."));
            return;
          }

          // Force read as array to prevent binary string corruption
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const firstSheet = workbook.Sheets[firstSheetName];
          
          // Convert to JSON
          const jsonData = XLSX.utils.sheet_to_json(firstSheet);
          resolve(jsonData);
        } catch (err) {
          reject(err);
        }
      };
      
      reader.onerror = (error) => reject(error);
      
      // Essential: Read as ArrayBuffer for binary files (.xlsx)
      reader.readAsArrayBuffer(file);
    });
  }
};