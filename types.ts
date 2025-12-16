
export interface Perspective {
  id: string;
  name: string;
}

export interface Manager {
  id: string;
  name: string;
}

export interface Objective {
  id: string;
  perspectiveId: string;
  gestorId: string;
  name: string;
}

export interface Indicator {
  id: string;
  perspectivaId: string;
  objetivoId: string;
  gestorId: string;
  name: string;
  description: string;
  formula: string;
  unit: string;
  source: string;
  periodicity: string;
  polarity: string;
  status: 'draft' | 'final';
  updatedAt: string;
  calcType?: 'isolated' | 'accumulated' | 'average';
  semaphore?: {
    blue: string;
    green: string;
    yellow: string;
    red: string;
  };
}

export interface Goal {
  id: string;
  indicatorId: string;
  year: number;
  history: { year: number; value: string }[];
  monthlyValues: string[];     // Metas Planejadas
  monthlyRealized?: string[];  // Valores Realizados
  locked?: boolean;            // Controle de Edição
}

export interface User {
  email: string;
  nome: string;
  perfil: 'ADMIN' | 'EDITOR' | 'LEITOR';
  ativo: boolean;
  senha?: string; // Usado apenas na edição, nunca exposto em logs
}

// --- NOVAS INTERFACES ---
export interface StrategicIdentity {
  companyName: string;
  logoUrl: string;
  purpose: string;
  business: string;
  mission: string;
  vision: string;
  values: string;
  horizonStart?: number; // Novo campo
  horizonEnd?: number;   // Novo campo
}

export interface VisionMilestone {
  id: string;
  year: number;
  description: string;
}

export interface GlobalSettings {
  semaphore: {
    blue: string;
    green: string;
    yellow: string;
    red: string;
  };
}
// -----------------------

export interface AppData {
  adminPassword?: string; // Senha global do admin
  identity: StrategicIdentity; 
  visionLine: VisionMilestone[];
  perspectives: Perspective[];
  managers: Manager[];
  objectives: Objective[];
  indicators: Indicator[];
  goals: Goal[];
  users: User[];
  globalSettings?: GlobalSettings; // Configurações Globais
}

export const INITIAL_DATA: AppData = {
  adminPassword: '123456', // Senha provisória padrão definida explicitamente
  identity: {
    companyName: '',
    logoUrl: '',
    purpose: '',
    business: '',
    mission: '',
    vision: '',
    values: '',
    horizonStart: new Date().getFullYear(),
    horizonEnd: new Date().getFullYear() + 4
  },
  visionLine: [],
  perspectives: [],
  managers: [],
  objectives: [],
  indicators: [],
  goals: [],
  users: [],
  globalSettings: {
    semaphore: {
      blue: 'Acima de 110%',
      green: 'De 100% a 110%',
      yellow: 'De 90% a 99%',
      red: 'Abaixo de 90%'
    }
  }
};

// Declaração global para bibliotecas carregadas via CDN
declare global {
  interface Window {
    XLSX: any;
  }
}
