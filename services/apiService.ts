import { API_URL } from '../config';
import { AppData, INITIAL_DATA, User } from '../types';

interface ApiResponse {
  status: 'success' | 'error';
  message?: string;
  data?: any;
  user?: User;
  [key: string]: any; // Permite propriedades flexíveis na resposta
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
    
    // Configuração OTIMIZADA para GAS Web Apps e CORS
    const response = await fetch(API_URL, {
      method: 'POST',
      body: body,
      mode: 'cors', 
      credentials: 'omit', // Essencial para evitar bloqueios de auth cruzada
      redirect: 'follow',
      headers: {
        'Content-Type': 'text/plain', // Previne Preflight request (OPTIONS)
      }
    });

    const text = await response.text();
    
    let json: ApiResponse;
    try {
        json = JSON.parse(text);
    } catch (e) {
        // Se a resposta não for JSON, verificamos se é um texto de sucesso simples
        // O GAS às vezes retorna apenas "Success" ou string vazia com status 200
        if (response.ok && (text.toLowerCase().includes('success') || text.toLowerCase().includes('ok') || text.trim() === '')) {
             return { status: 'success' };
        }
        
        console.error("Erro ao parsear JSON:", text);
        // Se for erro HTML (comum no Google), lança erro amigável
        if (text.trim().startsWith('<')) {
           throw new Error("O servidor retornou HTML. Verifique se o Script Google está publicado corretamente como Web App (Executar como 'Eu', Acesso 'Qualquer um').");
        }
        throw new Error("Resposta inválida do servidor.");
    }

    // Verifica status explícito de erro vindo do JSON
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
      
      // LÓGICA DE RECUPERAÇÃO ROBUSTA
      let userData: any = null;

      if (res.user && res.user.email) {
          userData = res.user;
      } else if (res.data && res.data.email) {
          userData = res.data;
      } else if (res.email) {
          userData = res;
      }

      if (!userData || !userData.email) {
          console.error("Estrutura JSON recebida (Falha):", JSON.stringify(res));
          throw new Error("Login aprovado, mas os dados do usuário vieram em formato incorreto.");
      }

      if (!userData.nome && userData.name) {
          userData.nome = userData.name;
      }
      
      if (!userData.perfil) {
          userData.perfil = 'LEITOR';
      }

      notifyFn("Login realizado com sucesso", "success");
      return userData as User;
    } catch (e: any) {
      notifyFn(e.message, "error");
      throw e;
    }
  },

  loadFullData: async (): Promise<AppData> => {
    try {
      const res = await request('get_full_data');
      
      const incoming = res.data || res;
      
      return {
        adminPassword: incoming.adminPassword || INITIAL_DATA.adminPassword,
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
      console.warn("Falha ao carregar dados:", e);
      notifyFn("Não foi possível carregar os dados. Verifique sua conexão.", "error");
      return INITIAL_DATA;
    }
  },

  saveVision: async (identity: any, visionLine: any[], user: User) => {
    notifyFn("Salvando Visão de Futuro...", "loading");
    try {
      await request('save_vision', { identity, visionLine }, user);
      notifyFn("Canvas salvo com sucesso!", "success");
    } catch (e: any) {
      notifyFn(`Erro ao salvar: ${e.message}`, "error");
    }
  },

  saveStructure: async (data: AppData, user: User) => {
    notifyFn("Salvando estrutura...", "loading");
    try {
      await request('save_structure', {
        perspectives: data.perspectives,
        managers: data.managers,
        objectives: data.objectives, // Vírgula corrigida aqui
        indicators: data.indicators
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
  },

  saveAdminSettings: async (settings: any, user: User) => {
    notifyFn("Atualizando configurações...", "loading");
    try {
      // Usa uma ação específica ou reaproveita save_users se o backend não suportar save_settings
      await request('save_admin_settings', settings, user);
      notifyFn("Configurações atualizadas!", "success");
    } catch (e: any) {
      notifyFn(`Erro: ${e.message}`, "error");
    }
  }
};

export const excelParser = {
  parse: (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const XLSX = window.XLSX;
      if (!XLSX) {
        return reject(new Error("Biblioteca XLSX não carregada. Verifique se o script CDN está incluído."));
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          // IMPORTANTE: header: 1 retorna array de arrays (matriz), permitindo que a gente encontre o cabeçalho manualmente
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          resolve(jsonData);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsArrayBuffer(file);
    });
  }
};