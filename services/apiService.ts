
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
    
    // Para evitar erros de CORS (Failed to Fetch) com Google Apps Script:
    // 1. Não enviamos cabeçalhos personalizados (headers) para manter como "Simple Request"
    // 2. Usamos o modo 'cors' mas com redirecionamento explícito
    // 3. O corpo é enviado como texto puro
    const response = await fetch(API_URL, {
      method: 'POST',
      mode: 'cors',
      cache: 'no-cache',
      redirect: 'follow',
      body: body
      // Removidos os headers para garantir que o navegador não envie um Preflight OPTIONS
    });

    if (!response.ok) {
      throw new Error(`Erro no servidor: ${response.status}`);
    }

    const text = await response.text();
    
    if (!text || text.trim() === "") {
      return { status: 'success' };
    }

    try {
        const json = JSON.parse(text);
        if (json.status === 'error') {
          throw new Error(json.message || 'Erro no processamento');
        }
        return json;
    } catch (e) {
        // Se não for JSON, mas contiver sucesso, consideramos OK
        if (text.toLowerCase().includes('success') || text.toLowerCase().includes('ok')) {
             return { status: 'success' };
        }
        console.warn("Resposta não-JSON recebida:", text);
        throw new Error("Resposta inválida. Verifique se o Script está publicado como 'Anyone'.");
    }
  } catch (error: any) {
    console.error("API Connection Error:", error);
    
    // Erro específico de "Failed to Fetch"
    if (error.name === 'TypeError' || error.message.includes('fetch')) {
      const msg = "Erro de Conexão (CORS/Network). Verifique se o Script está publicado como 'Qualquer pessoa' (Anyone) e se a URL termina em /exec";
      notifyFn(msg, 'error');
      throw new Error(msg);
    }
    
    notifyFn(error.message, 'error');
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
          throw new Error("Usuário ou senha inválidos.");
      }

      if (!userData.nome && userData.name) userData.nome = userData.name;
      if (!userData.perfil) userData.perfil = 'LEITOR';

      notifyFn("Bem-vindo!", "success");
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
      // Em caso de falha de carregamento inicial, não bloqueia o app, usa os dados locais
      console.warn("Usando dados locais de fallback.");
      return INITIAL_DATA;
    }
  },

  saveVision: async (identity: any, visionLine: any[], user: User) => {
    notifyFn("Salvando Visão...", "loading");
    try {
      await request('save_vision', { identity, visionLine }, user);
      notifyFn("Dados da Visão salvos!", "success");
    } catch (e: any) {}
  },

  saveStructure: async (data: AppData, user: User) => {
    notifyFn("Atualizando estrutura...", "loading");
    try {
      await request('save_structure', {
        perspectives: data.perspectives,
        managers: data.managers,
        objectives: data.objectives,
        indicators: data.indicators
      }, user);
      notifyFn("Estrutura atualizada!", "success");
    } catch (e: any) {}
  },

  saveIndicators: async (indicators: any[], user: User) => {
    notifyFn("Gravando fichas técnicas...", "loading");
    try {
      await request('save_indicators', indicators, user);
      notifyFn("Fichas técnicas salvas!", "success");
    } catch (e: any) {}
  },

  saveGoals: async (goals: any[], user: User) => {
    notifyFn("Gravando metas...", "loading");
    try {
      await request('save_goals', goals, user);
      notifyFn("Planejamento de metas salvo!", "success");
    } catch (e: any) {}
  },
  
  saveUsers: async (users: User[], user: User) => {
    notifyFn("Sincronizando usuários...", "loading");
    try {
      await request('save_users', users, user);
      notifyFn("Usuários atualizados!", "success");
    } catch (e: any) {}
  },

  saveAdminSettings: async (settings: any, user: User) => {
    notifyFn("Configurações do sistema...", "loading");
    try {
      await request('save_admin_settings', settings, user);
      notifyFn("Configurações salvas!", "success");
    } catch (e: any) {}
  }
};

export const excelParser = {
  parse: (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const XLSX = window.XLSX;
      if (!XLSX) return reject(new Error("Biblioteca XLSX não carregada."));
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
