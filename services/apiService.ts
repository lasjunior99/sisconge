
import { API_URL } from '../config';
import { AppData, INITIAL_DATA, User } from '../types';

interface ApiResponse {
  status: 'success' | 'error';
  message?: string;
  data?: any;
  user?: User;
  [key: string]: any;
}

let notifyFn: (msg: string, type: 'success' | 'error' | 'loading' | 'info') => void = () => {};

export const setNotificationHandler = (fn: any) => { notifyFn = fn; };

const request = async (action: string, payload: any = {}, user: User | null = null): Promise<any> => {
  if (!API_URL) {
    notifyFn("Erro Crítico: URL da API não configurada.", 'error');
    throw new Error("API URL missing");
  }

  try {
    const body = JSON.stringify({ action, payload, user });
    
    const response = await fetch(API_URL, {
      method: 'POST',
      body: body,
      mode: 'cors', 
      redirect: 'follow',
      headers: {
        'Content-Type': 'text/plain', // Essencial para evitar preflight OPTIONS no Google Apps Script
      }
    });

    if (!response.ok) {
      throw new Error(`Erro no servidor: ${response.status} ${response.statusText}`);
    }

    const text = await response.text();
    
    if (!text || text.trim() === "") {
      return { status: 'success' };
    }

    try {
        const json = JSON.parse(text);
        if (json.status === 'error') {
          throw new Error(json.message || 'Erro desconhecido no servidor');
        }
        return json;
    } catch (e) {
        if (text.toLowerCase().includes('success') || text.toLowerCase().includes('ok')) {
             return { status: 'success' };
        }
        console.error("Erro ao parsear JSON:", text);
        throw new Error("Resposta inválida do servidor. Verifique se o Script está publicado como 'Qualquer pessoa'.");
    }
  } catch (error: any) {
    console.error("API Connection Error:", error);
    if (error.name === 'TypeError' || error.message.includes('fetch')) {
      notifyFn("Erro de Conexão: O servidor não respondeu (Failed to Fetch). Verifique sua internet ou se o Script foi desativado.", 'error');
    } else {
      notifyFn(error.message, 'error');
    }
    throw error;
  }
};

export const apiService = {
  login: async (email: string, password: string): Promise<User> => {
    notifyFn("Autenticando...", "loading");
    try {
      const res = await request('login', { email, password });
      let userData = res.user || res.data || (res.email ? res : null);

      if (!userData || !userData.email) {
          throw new Error("Dados de usuário não recebidos do servidor.");
      }

      if (!userData.nome && userData.name) userData.nome = userData.name;
      if (!userData.perfil) userData.perfil = 'LEITOR';

      notifyFn("Login realizado!", "success");
      return userData as User;
    } catch (e: any) {
      throw e;
    }
  },

  loadFullData: async (): Promise<AppData> => {
    try {
      const res = await request('get_full_data');
      const incoming = res.data || res;
      
      let rawPass = incoming.adminPassword;
      let finalPass = INITIAL_DATA.adminPassword;

      if (rawPass !== undefined && rawPass !== null && String(rawPass).trim() !== '') {
          finalPass = String(rawPass).trim();
      }

      return {
        adminPassword: finalPass,
        identity: incoming.identity || INITIAL_DATA.identity,
        visionLine: incoming.visionLine || INITIAL_DATA.visionLine,
        perspectives: incoming.perspectives || INITIAL_DATA.perspectives,
        managers: incoming.managers || INITIAL_DATA.managers,
        objectives: incoming.objectives || INITIAL_DATA.objectives,
        indicators: incoming.indicators || INITIAL_DATA.indicators,
        goals: incoming.goals || INITIAL_DATA.goals,
        users: incoming.users || INITIAL_DATA.users,
        globalSettings: incoming.globalSettings || INITIAL_DATA.globalSettings,
      };
    } catch (e: any) {
      return INITIAL_DATA;
    }
  },

  saveVision: async (identity: any, visionLine: any[], user: User) => {
    notifyFn("Salvando Visão...", "loading");
    try {
      await request('save_vision', { identity, visionLine }, user);
      notifyFn("Salvo com sucesso!", "success");
    } catch (e: any) {}
  },

  saveStructure: async (data: AppData, user: User) => {
    notifyFn("Salvando estrutura...", "loading");
    try {
      await request('save_structure', {
        perspectives: data.perspectives,
        managers: data.managers,
        objectives: data.objectives,
        indicators: data.indicators
      }, user);
      notifyFn("Estrutura salva!", "success");
    } catch (e: any) {}
  },

  saveIndicators: async (indicators: any[], user: User) => {
    notifyFn("Salvando fichas...", "loading");
    try {
      await request('save_indicators', indicators, user);
      notifyFn("Salvo!", "success");
    } catch (e: any) {}
  },

  saveGoals: async (goals: any[], user: User) => {
    notifyFn("Salvando metas...", "loading");
    try {
      await request('save_goals', goals, user);
      notifyFn("Metas salvas!", "success");
    } catch (e: any) {}
  },
  
  saveUsers: async (users: User[], user: User) => {
    notifyFn("Atualizando usuários...", "loading");
    try {
      await request('save_users', users, user);
      notifyFn("Usuários atualizados!", "success");
    } catch (e: any) {}
  },

  saveAdminSettings: async (settings: any, user: User) => {
    notifyFn("Atualizando configurações...", "loading");
    try {
      await request('save_admin_settings', settings, user);
      notifyFn("Configurações atualizadas!", "success");
    } catch (e: any) {}
  }
};

export const excelParser = {
  parse: (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const XLSX = window.XLSX;
      if (!XLSX) return reject(new Error("XLSX não disponível."));
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          resolve(jsonData);
        } catch (err) { reject(err); }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsArrayBuffer(file);
    });
  }
};
