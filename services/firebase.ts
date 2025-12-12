// --- CONFIGURAÇÃO DO FIREBASE ---
// Adaptado para permitir configuração dinâmica via LocalStorage e Links Mágicos Compactados

import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot } from "firebase/firestore";

let db: any = null;
let app: any = null;

const LS_CONFIG_KEY = 'kpi_firebase_config';

// Tenta carregar a configuração salva no navegador
const savedConfigStr = localStorage.getItem(LS_CONFIG_KEY);

// --- UTILITÁRIOS DE COMPRESSÃO ---

// Ordem estrita dos campos para compressão (Array posicional)
const CONFIG_KEYS = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];

export const compressConfig = (configStr: string): string => {
  try {
    // 1. Parse o JSON original
    let cleanStr = configStr.trim();
    // Limpeza básica se o usuário colou "const config = ..."
    const jsonMatch = cleanStr.match(/({[\s\S]*})/);
    if (jsonMatch) cleanStr = jsonMatch[0];

    // Tenta parsear
    let config;
    try {
        config = JSON.parse(cleanStr);
    } catch (e) {
        // Fallback para JS object notation
        // eslint-disable-next-line no-new-func
        config = new Function("return " + cleanStr)();
    }

    if (!config || !config.apiKey) throw new Error("Config inválida");

    // 2. Extrai apenas os valores na ordem definida
    const values = CONFIG_KEYS.map(key => config[key] || '');
    
    // 3. Junta com um separador pouco comum ($)
    const joined = values.join('$');

    // 4. Base64 Encode
    return btoa(joined);
  } catch (e) {
    console.error("Erro ao comprimir config", e);
    return "";
  }
};

export const decompressConfig = (compressedStr: string): any => {
  try {
    // 1. Decode Base64
    const decoded = atob(compressedStr);
    
    // Verifica se é um JSON antigo (retrocompatibilidade com a versão anterior)
    if (decoded.trim().startsWith('{')) {
        return JSON.parse(decoded);
    }

    // 2. Split pelo separador
    const values = decoded.split('$');
    
    // 3. Reconstrói o objeto
    const config: any = {};
    CONFIG_KEYS.forEach((key, index) => {
        if (values[index]) config[key] = values[index];
    });

    return config;
  } catch (e) {
    console.error("Erro ao descomprimir config", e);
    return null;
  }
};

// --- INICIALIZAÇÃO ---

const initFirebase = (configInput: string | object) => {
  try {
    let config;
    
    if (typeof configInput === 'string') {
        // Tenta detectar se é JSON string ou Objeto JS string
        let cleanStr = configInput.trim();
        const jsonMatch = cleanStr.match(/({[\s\S]*})/);
        if (jsonMatch) cleanStr = jsonMatch[0];

        try {
            config = JSON.parse(cleanStr);
        } catch (e) {
            // eslint-disable-next-line no-new-func
            config = new Function("return " + cleanStr)();
        }
    } else {
        config = configInput;
    }
    
    if (!config || !config.apiKey) {
        // Silencioso se for vazio, erro se for inválido
        return false;
    }

    app = initializeApp(config);
    db = getFirestore(app);
    console.log("🔥 Firebase conectado com sucesso!");
    return true;
  } catch (e) {
    console.error("Erro ao conectar Firebase:", e);
    return false;
  }
};

if (savedConfigStr) {
  initFirebase(savedConfigStr);
} else {
  console.warn("Modo Offline (Local).");
}

export const saveFirebaseConfig = (configStr: string): boolean => {
  // Verifica se é um JSON puro ou se precisa descomprimir (caso o usuário cole o token)
  let finalConfigStr = configStr;
  
  // Se não parece JSON (não começa com {), tenta descomprimir
  if (!configStr.trim().startsWith('{') && !configStr.includes('apiKey')) {
      const decompressed = decompressConfig(configStr);
      if (decompressed) {
          finalConfigStr = JSON.stringify(decompressed);
      }
  }

  const success = initFirebase(finalConfigStr);
  if (success) {
    localStorage.setItem(LS_CONFIG_KEY, finalConfigStr);
    return true;
  }
  return false;
};

export const clearFirebaseConfig = () => {
  localStorage.removeItem(LS_CONFIG_KEY);
};

export const isFirebaseConnected = () => !!db;

// --- AUTO-CONFIGURAÇÃO VIA URL ---
export const checkForUrlConfig = (): boolean => {
  if (typeof window === 'undefined') return false;

  const params = new URLSearchParams(window.location.search);
  const encodedConfig = params.get('config');

  if (encodedConfig) {
    try {
      console.log("🔗 Configuração via Link detectada...");
      
      // Tenta descomprimir (novo formato curto) ou parsear (formato antigo)
      const configObj = decompressConfig(encodedConfig);
      
      if (configObj && configObj.apiKey) {
         const jsonStr = JSON.stringify(configObj);
         localStorage.setItem(LS_CONFIG_KEY, jsonStr);
         
         // Limpa a URL imediatamente
         const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
         window.history.replaceState({path: newUrl}, "", newUrl);
         
         return true;
      } else {
          alert("O link de configuração parece inválido.");
      }
    } catch (e) {
      console.error("Falha ao processar link", e);
      alert("Erro ao processar o link de acesso.");
    }
  }
  return false;
};

export { db, doc, getDoc, setDoc, updateDoc, onSnapshot };