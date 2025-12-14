import { API_URL } from '../config';
import { AppData, INITIAL_DATA, User } from '../types';

interface ApiResponse {
  status: 'success' | 'error';
  message?: string;
  data?: any;
  user?: User;
}

// Hook de notificação injetado
let notifyFn: (msg: string, type: 'success' | 'error' | 'loading' | 'info') => void = () => {};

export const setNotificationHandler = (fn: any) => { notifyFn = fn; };

const request = async (action: string, payload: any = {}, user: User | null = null): Promise<any> => {
  if (!API_URL) {
    notifyFn("Erro Crítico: URL da API não configurada.", 'error');
    throw new Error("API URL missing");
  }

  try {
    const body = JSON.stringify({ action, payload, user });
    
    // GAS Web Apps exigem no-cors para evitar preflight complexo em alguns casos, 
    // mas POST via text/plain é o mais seguro para contornar.
    const response = await fetch(API_URL, {
      method: 'POST',
      body: body,
      mode: 'cors', // Tenta CORS padrão
    });

    // Tenta parsear JSON. Se falhar, geralmente é erro HTML do Google (404/500 escondido)
    let json: ApiResponse;
    try {
        json = await response.json();
    } catch (e) {
        throw new Error("Resposta inválida do servidor. Verifique se o Script Google está publicado corretamente.");
    }

    if (json.status === 'error') {
      throw new Error(json.message || 'Erro desconhecido no servidor');
    }

    return json;
  } catch (error: any) {
    console.error("API Error:", error);
    throw error;
  }
};

export const apiService = {
  login: async (email: string, password: string): Promise<User> => {
    notifyFn("Autenticando...", "loading");
    try {
      const res = await request('login', { email, password });
      notifyFn("Login realizado com sucesso", "success");
      return res.user;
    } catch (e: any) {
      notifyFn(e.message, "error");
      throw e;
    }
  },

  loadFullData: async (): Promise<AppData> => {
    // GET request (mapped to POST action for simplicity with GAS body handling) or actual GET
    // GAS doGet handler:
    try {
      const response = await fetch(`${API_URL}?action=get_full_data`);
      const json: ApiResponse = await response.json();
      if (json.status === 'success' && json.data) {
        return { ...INITIAL_DATA, ...json.data };
      }
      throw new Error(json.message);
    } catch (e) {
      console.error(e);
      notifyFn("Erro ao carregar dados do servidor.", "error");
      return INITIAL_DATA;
    }
  },

  saveStructure: async (data: AppData, user: User) => {
    notifyFn("Salvando estrutura...", "loading");
    try {
      await request('save_structure', {
        perspectives: data.perspectives,
        managers: data.managers,
        objectives: data.objectives
      }, user);
      notifyFn("Estrutura salva com sucesso!", "success");
    } catch (e: any) {
      notifyFn(`Erro ao salvar: ${e.message}`, "error");
    }
  },

  saveIndicators: async (indicators: any[], user: User) => {
    notifyFn("Salvando indicadores...", "loading");
    try {
      await request('save_indicators', indicators, user);
      notifyFn("Indicadores salvos!", "success");
    } catch (e: any) {
      notifyFn(`Erro: ${e.message}`, "error");
    }
  },

  saveGoals: async (goals: any[], user: User) => {
    notifyFn("Salvando metas...", "loading");
    try {
      await request('save_goals', goals, user);
      notifyFn("Metas salvas!", "success");
    } catch (e: any) {
      notifyFn(`Erro: ${e.message}`, "error");
    }
  },
  
  saveUsers: async (users: User[], user: User) => {
    notifyFn("Atualizando usuários...", "loading");
    try {
      await request('save_users', users, user);
      notifyFn("Usuários atualizados!", "success");
    } catch (e: any) {
      notifyFn(`Erro: ${e.message}`, "error");
    }
  }
};

export const excelParser = {
   parse: (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const XLSX = window.XLSX;
          if (!XLSX) throw new Error("XLSX lib not found");
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          resolve(XLSX.utils.sheet_to_json(firstSheet));
        } catch (err) { reject(err); }
      };
      reader.readAsArrayBuffer(file);
    });
  }
};