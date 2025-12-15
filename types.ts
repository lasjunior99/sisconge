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
  monthlyValues: string[];
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
// -----------------------

export interface AppData {
  identity: StrategicIdentity; 
  visionLine: VisionMilestone[];
  perspectives: Perspective[];
  managers: Manager[];
  objectives: Objective[];
  indicators: Indicator[];
  goals: Goal[];
  users: User[];
}

export const INITIAL_DATA: AppData = {
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
  users: []
};

// Declaração global para bibliotecas carregadas via CDN
declare global {
  interface Window {
    XLSX: any;
  }
}