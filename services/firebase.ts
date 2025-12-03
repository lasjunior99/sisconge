// --- CONFIGURAÇÃO DO FIREBASE ---
// Adaptado para permitir configuração dinâmica via LocalStorage
// Isso permite que o usuário configure o banco de dados sem editar o código fonte.

import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot } from "firebase/firestore";

let db: any = null;
let app: any = null;

const LS_CONFIG_KEY = 'kpi_firebase_config';

// Tenta carregar a configuração salva no navegador
const savedConfigStr = localStorage.getItem(LS_CONFIG_KEY);

const initFirebase = (configStr: string) => {
  try {
    let cleanStr = configStr.trim();
    
    // Tenta encontrar o objeto JSON explicitamente usando Regex
    // Isso resolve casos onde o usuário cola "const config = { ... };" ou lixo ao redor
    const jsonMatch = cleanStr.match(/({[\s\S]*})/);
    if (jsonMatch) {
      cleanStr = jsonMatch[0];
    }

    // Tenta fazer o parse. Se falhar, o catch captura.
    // Usamos Function constructor como fallback seguro para objetos JS que não são JSON estrito (ex: chaves sem aspas)
    let config;
    try {
        config = JSON.parse(cleanStr);
    } catch (e) {
        // Fallback para formato JS (chaves sem aspas)
        // eslint-disable-next-line no-new-func
        config = new Function("return " + cleanStr)();
    }
    
    if (!config || !config.apiKey) {
        throw new Error("Objeto de configuração inválido");
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
  console.warn("Firebase não configurado. O sistema está rodando em modo LOCAL (Offline).");
}

export const saveFirebaseConfig = (configStr: string): boolean => {
  const success = initFirebase(configStr);
  if (success) {
    localStorage.setItem(LS_CONFIG_KEY, configStr);
    // O reload agora é responsabilidade da UI para evitar erros visuais
    return true;
  }
  return false;
};

export const clearFirebaseConfig = () => {
  localStorage.removeItem(LS_CONFIG_KEY);
  // O reload agora é responsabilidade da UI
};

export const isFirebaseConnected = () => !!db;

export { db, doc, getDoc, setDoc, updateDoc, onSnapshot };