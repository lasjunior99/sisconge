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
  // New fields linked to Goal Logic
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
  history: { year: number; value: string }[]; // Last 3 years
  monthlyValues: string[]; // 12 months array (strings to handle empty inputs)
}

export interface AppData {
  adminPassword: string;
  perspectives: Perspective[];
  managers: Manager[];
  objectives: Objective[];
  indicators: Indicator[];
  goals: Goal[];
}

export const INITIAL_DATA: AppData = {
  adminPassword: 'admin123',
  perspectives: [],
  managers: [],
  objectives: [],
  indicators: [],
  goals: []
};

// Declaração global para bibliotecas carregadas via CDN
declare global {
  interface Window {
    XLSX: any;
  }
}