
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

export interface TextStyle {
  font: string;
  size: number;
  color: string;
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
  calcType?: 'isolated' | 'accumulated' | 'average' | 'rolling' | 'ytd';
  rollingWindow?: number;
  semaphore?: SemaphoreSettings;
}

export interface Goal {
  id: string;
  indicatorId: string;
  year: number;
  history: { year: number; value: string }[];
  monthlyValues: string[];
  monthlyRealized?: string[];
  locked?: boolean;
}

export interface User {
  email: string;
  nome: string;
  perfil: 'ADMIN' | 'EDITOR' | 'LEITOR';
  ativo: boolean;
  senha?: string;
}

export interface StrategicIdentity {
  companyName: string;
  logoUrl: string;
  purpose: string;
  business: string;
  mission: string;
  vision: string;
  values: string;
  horizonStart?: number;
  horizonEnd?: number;
  referenceYear: number;
  styles?: {
    purpose?: TextStyle;
    business?: TextStyle;
    mission?: TextStyle;
    vision?: TextStyle;
    values?: TextStyle;
  };
}

export interface VisionMilestone {
  id: string;
  year: number;
  description: string;
  style?: TextStyle;
}

export interface SemaphoreRule {
  operator: '=' | '>' | '<' | '>=' | '<=' | 'between';
  value: string; // Used for single value
  value2?: string; // Used for "between"
}

export interface SemaphoreSettings {
  blue: SemaphoreRule;
  green: SemaphoreRule;
  yellow: SemaphoreRule;
  red: SemaphoreRule;
}

export interface GlobalSettings {
  semaphore: SemaphoreSettings;
}

export interface AppData {
  adminPassword?: string;
  identity: StrategicIdentity; 
  visionLine: VisionMilestone[];
  perspectives: Perspective[];
  managers: Manager[];
  objectives: Objective[];
  indicators: Indicator[];
  goals: Goal[];
  users: User[];
  globalSettings?: GlobalSettings;
}

const DEFAULT_TEXT_STYLE: TextStyle = { font: 'sans-serif', size: 14, color: '#334155' };

export const INITIAL_DATA: AppData = {
  adminPassword: '123456',
  identity: {
    companyName: '',
    logoUrl: '',
    purpose: '',
    business: '',
    mission: '',
    vision: '',
    values: '',
    horizonStart: new Date().getFullYear(),
    horizonEnd: new Date().getFullYear() + 4,
    referenceYear: new Date().getFullYear(),
    styles: {
      purpose: { ...DEFAULT_TEXT_STYLE },
      business: { ...DEFAULT_TEXT_STYLE },
      mission: { ...DEFAULT_TEXT_STYLE },
      vision: { ...DEFAULT_TEXT_STYLE, size: 16 },
      values: { ...DEFAULT_TEXT_STYLE }
    }
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
      blue: { operator: '>=', value: '110.00' },
      green: { operator: '>=', value: '100.00' },
      yellow: { operator: 'between', value: '90.00', value2: '99.99' },
      red: { operator: '<', value: '90.00' }
    }
  }
};

declare global {
  interface Window {
    XLSX: any;
    html2canvas: any;
    jspdf: any;
  }
}
