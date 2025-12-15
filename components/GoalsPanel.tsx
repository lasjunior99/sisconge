import React, { useState, useEffect, useRef } from 'react';
import { AppData, Goal, Indicator } from '../types';
import { Button } from './ui/Button';
import { excelParser } from '../services/apiService';

interface GoalsPanelProps {
  data: AppData;
  onUpdate: (newData: AppData) => void;
}

export const GoalsPanel: React.FC<GoalsPanelProps> = ({ data, onUpdate }) => {
  // Filters
  const [selPersp, setSelPersp] = useState('');
  const [selObj, setSelObj] = useState('');
  const [selInd, setSelInd] = useState('');
  
  // Current Editing State
  const [currentGoal, setCurrentGoal] = useState<Goal | null>(null);
  const [currentInd, setCurrentInd] = useState<Indicator | null>(null);
  const [managerName, setManagerName] = useState('');
  
  // Semaphore & Calc Type (stored in Indicator)
  const [semBlue, setSemBlue] = useState('');
  const [semGreen, setSemGreen] = useState('');
  const [semYellow, setSemYellow] = useState('');
  const [semRed, setSemRed] = useState('');
  const [calcType, setCalcType] = useState<'isolated'|'accumulated'|'average'>('isolated');

  // Import Ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selInd) {
      const ind = data.indicators.find(i => i.id === selInd);
      setCurrentInd(ind || null);
      if (ind) {
        // Find Manager
        const mgr = data.managers.find(m => m.id === ind.gestorId);
        setManagerName(mgr ? mgr.name : 'Gestor não atribuído');

        // Load Semaphore & Calc
        setSemBlue(ind.semaphore?.blue || '');
        setSemGreen(ind.semaphore?.green || '');
        setSemYellow(ind.semaphore?.yellow || '');
        setSemRed(ind.semaphore?.red || '');
        setCalcType(ind.calcType || 'isolated');

        // Load Goal
        const existingGoal = data.goals.find(g => g.indicatorId === ind.id);
        const thisYear = new Date().getFullYear();
        
        if (existingGoal) {
          // Safety check: ensure arrays exist (legacy data protection)
          setCurrentGoal({
            ...existingGoal,
            history: existingGoal.history || [
              { year: thisYear - 3, value: '' },
              { year: thisYear - 2, value: '' },
              { year: thisYear - 1, value: '' },
            ],
            monthlyValues: existingGoal.monthlyValues || Array(12).fill('')
          });
        } else {
          // Init empty goal
          setCurrentGoal({
            id: 'GOAL-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
            indicatorId: ind.id,
            year: thisYear,
            history: [
              { year: thisYear - 3, value: '' },
              { year: thisYear - 2, value: '' },
              { year: thisYear - 1, value: '' },
            ],
            monthlyValues: Array(12).fill('')
          });
        }
      }
    } else {
      setCurrentGoal(null);
      setCurrentInd(null);
      setManagerName('');
    }
  }, [selInd, data.indicators, data.goals, data.managers]);

  const handleSave = () => {
    if (!currentGoal || !currentInd) return;

    // Update Goal List
    const otherGoals = data.goals.filter(g => g.indicatorId !== currentInd.id);
    const updatedGoals = [...otherGoals, currentGoal];

    // Update Indicator with Meta Config
    const updatedIndicators = data.indicators.map(i => {
      if (i.id === currentInd.id) {
        return {
          ...i,
          calcType,
          semaphore: { blue: semBlue, green: semGreen, yellow: semYellow, red: semRed }
        };
      }
      return i;
    });

    onUpdate({
      ...data,
      goals: updatedGoals,
      indicators: updatedIndicators
    });
    // Removed native alert. Feedback is handled via onUpdate calling apiService
  };

  const handleDeleteGoal = () => {
    if (!currentInd || !currentGoal) return;
    if (!confirm(`Tem certeza que deseja excluir todas as metas de "${currentInd.name}"?`)) return;

    const filteredGoals = data.goals.filter(g => g.indicatorId !== currentInd.id);
    onUpdate({ ...data, goals: filteredGoals });
    
    // Reset local state (as if new)
    const thisYear = new Date().getFullYear();
    setCurrentGoal({
        id: 'GOAL-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
        indicatorId: currentInd.id,
        year: thisYear,
        history: [{ year: thisYear - 3, value: '' }, { year: thisYear - 2, value: '' }, { year: thisYear - 1, value: '' }],
        monthlyValues: Array(12).fill('')
    });
    
    // Removed native alert. Feedback is handled via onUpdate calling apiService
  };

  const updateMonthly = (idx: number, val: string) => {
    if (!currentGoal) return;
    const newM = [...currentGoal.monthlyValues];
    newM[idx] = val;
    setCurrentGoal({ ...currentGoal, monthlyValues: newM });
  };

  const updateHistory = (idx: number, val: string) => {
    if (!currentGoal) return;
    const newH = [...currentGoal.history];
    newH[idx].value = val;
    setCurrentGoal({ ...currentGoal, history: newH });
  };

  const clearFilters = () => {
    setSelPersp('');
    setSelObj('');
    setSelInd('');
  };

  // --- IMPORT EXCEL ---
  const handleImportGoals = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const rows = await excelParser.parse(file);
      if (!rows || rows.length < 2) return alert("Planilha vazia ou sem dados.");

      // Identify Columns
      const header = rows[0].map((c: string) => String(c || '').trim().toLowerCase());
      const idxInd = header.findIndex((h: string) => h.includes('indicador') || h.includes('nome'));
      
      if (idxInd === -1) {
        return alert("Não foi encontrada a coluna 'Indicador'. Verifique o modelo.");
      }

      // Finds columns for Jan..Dec
      const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
      const idxMonths = months.map(m => header.findIndex((h: string) => h.includes(m)));

      let updatedGoals = [...data.goals];
      let count = 0;

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const indName = row[idxInd];
        if (!indName) continue;

        const ind = data.indicators.find(ii => ii.name.trim().toLowerCase() === String(indName).trim().toLowerCase());
        if (!ind) continue; // Indicator not found

        // Create or Update Goal
        const thisYear = new Date().getFullYear();
        let goal = updatedGoals.find(g => g.indicatorId === ind.id);
        
        // Extract Monthly Values
        const newMonthly = idxMonths.map(idx => (idx !== -1 && row[idx] !== undefined) ? String(row[idx]) : '');

        if (goal) {
           goal = { ...goal, monthlyValues: newMonthly }; // Update existing
           updatedGoals = updatedGoals.map(g => g.id === goal!.id ? goal! : g);
        } else {
           goal = {
             id: 'GOAL-' + Math.random().toString(36).substr(2, 9),
             indicatorId: ind.id,
             year: thisYear,
             history: [],
             monthlyValues: newMonthly
           };
           updatedGoals.push(goal);
        }
        count++;
      }

      onUpdate({ ...data, goals: updatedGoals });
      // Removed alert, feedback handled by API toast

    } catch (err: any) {
      alert("Erro na importação: " + err.message);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // --- EXPORT EXCEL ---
  const handleExportGoals = () => {
    const XLSX = window.XLSX;
    if (!XLSX) return alert("Biblioteca XLSX não carregada.");

    const rows = data.indicators.map(ind => {
      const goal = data.goals.find(g => g.indicatorId === ind.id);
      const row: any = {
        'Indicador': ind.name,
        'Ano': new Date().getFullYear()
      };
      
      const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      months.forEach((m, idx) => {
        row[m] = goal?.monthlyValues[idx] || '';
      });

      return row;
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Metas");
    XLSX.writeFile(wb, "Cadastro_Metas.xlsx");
  };

  // Derived lists for selects
  const filteredObjectives = data.objectives.filter(o => !selPersp || o.perspectiveId === selPersp);
  const filteredIndicators = data.indicators.filter(i => (!selObj || i.objetivoId === selObj) && (!selPersp || i.perspectivaId === selPersp));

  // Empty state check
  const hasStructure = data.perspectives.length > 0 && data.objectives.length > 0 && data.indicators.length > 0;

  return (
    <div className="pb-10">
      <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-blue-900">Cadastro de Metas</h2>
          <div className="flex gap-2">
              <input ref={fileInputRef} type="file" accept=".xlsx" className="hidden" onChange={handleImportGoals} />
              <Button size="sm" variant="secondary" onClick={() => fileInputRef.current?.click()}>
                 <i className="ph ph-upload-simple"></i> Importar Excel
              </Button>
              <Button size="sm" variant="secondary" onClick={handleExportGoals}>
                 <i className="ph ph-download-simple"></i> Exportar Excel
              </Button>
          </div>
      </div>
      
      {!hasStructure && (
        <div className="p-4 bg-yellow-50 text-yellow-800 border border-yellow-200 rounded mb-6">
          <strong>Atenção:</strong> Ainda não há indicadores cadastrados. Vá para a aba <strong>ADMIN</strong> e importe a planilha ou cadastre manualmente.
        </div>
      )}

      {/* Selection Area */}
      <div className="bg-white p-4 rounded shadow border mb-6 relative">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">1. Perspectiva</label>
            <select 
              className="w-full p-2 border rounded text-sm bg-white" 
              value={selPersp} 
              onChange={e => {setSelPersp(e.target.value); setSelObj(''); setSelInd('');}}
            >
              <option value="">Selecione...</option>
              {data.perspectives.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">2. Objetivo</label>
            <select 
              className="w-full p-2 border rounded text-sm bg-white disabled:bg-slate-100" 
              value={selObj} 
              onChange={e => {setSelObj(e.target.value); setSelInd('');}} 
              disabled={!filteredObjectives.length}
            >
              <option value="">Selecione...</option>
              {filteredObjectives.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">3. Indicador</label>
            <select 
              className="w-full p-2 border rounded text-sm bg-white disabled:bg-slate-100" 
              value={selInd} 
              onChange={e => setSelInd(e.target.value)} 
              disabled={!filteredIndicators.length}
            >
              <option value="">Selecione...</option>
              {filteredIndicators.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
             <Button variant="secondary" size="sm" onClick={clearFilters}>Limpar Filtros</Button>
        </div>
      </div>

      {currentGoal ? (
        <div className="space-y-6">
          
          {/* Manager Display */}
          <div className="bg-blue-50 border border-blue-200 p-4 rounded flex items-center gap-3">
             <div className="bg-blue-200 text-blue-800 rounded-full w-10 h-10 flex items-center justify-center font-bold text-xl">
                 👤
             </div>
             <div>
                 <div className="text-xs text-blue-600 uppercase font-bold tracking-wide">Gestor Responsável</div>
                 <div className="text-lg font-bold text-blue-900">{managerName}</div>
             </div>
          </div>

          {/* Configuração Técnica */}
          <div className="bg-white p-6 rounded shadow border">
            <h3 className="font-bold text-lg text-slate-800 border-b pb-2 mb-4">Configuração do Indicador</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Tipo de Cálculo</label>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    <input type="radio" name="calcType" checked={calcType === 'isolated'} onChange={() => setCalcType('isolated')} />
                    Isolado (Valor do Mês)
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    <input type="radio" name="calcType" checked={calcType === 'accumulated'} onChange={() => setCalcType('accumulated')} />
                    Acumulado (Soma até a data)
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    <input type="radio" name="calcType" checked={calcType === 'average'} onChange={() => setCalcType('average')} />
                    Média (Média do acumulado)
                  </label>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Farol de Desempenho (Semáforo)</label>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="block text-xs text-blue-600 font-bold mb-1">Azul (Superação)</span>
                    <input className="w-full border p-1 rounded" placeholder="Ex: > 110%" value={semBlue} onChange={e => setSemBlue(e.target.value)} />
                  </div>
                  <div>
                    <span className="block text-xs text-green-600 font-bold mb-1">Verde (Meta)</span>
                    <input className="w-full border p-1 rounded" placeholder="Ex: 100%" value={semGreen} onChange={e => setSemGreen(e.target.value)} />
                  </div>
                  <div>
                    <span className="block text-xs text-yellow-600 font-bold mb-1">Amarelo (Atenção)</span>
                    <input className="w-full border p-1 rounded" placeholder="Ex: 90-99%" value={semYellow} onChange={e => setSemYellow(e.target.value)} />
                  </div>
                  <div>
                    <span className="block text-xs text-red-600 font-bold mb-1">Vermelho (Crítico)</span>
                    <input className="w-full border p-1 rounded" placeholder="Ex: < 90%" value={semRed} onChange={e => setSemRed(e.target.value)} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Dados Numéricos */}
          <div className="bg-white p-6 rounded shadow border">
            <h3 className="font-bold text-lg text-slate-800 border-b pb-2 mb-4">Dados e Metas</h3>
            
            <div className="mb-6">
              <label className="block text-sm font-bold text-slate-700 mb-2">Histórico (3 Anos Anteriores)</label>
              <div className="flex gap-4">
                {(currentGoal.history || []).map((h, idx) => (
                  <div key={idx} className="flex-1">
                    <div className="text-center text-xs font-bold text-slate-500 mb-1">{h.year}</div>
                    <input 
                      type="number" 
                      className="w-full border p-2 rounded text-center" 
                      value={h.value} 
                      onChange={e => updateHistory(idx, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Metas para {currentGoal.year}</label>
              
              {/* Jan-Jun */}
              <div className="grid grid-cols-6 gap-2 mb-4">
                {['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'].map((m, i) => (
                  <div key={m}>
                    <div className="text-center text-xs text-slate-500 mb-1">{m}</div>
                    <input type="number" className="w-full border p-2 rounded text-center text-sm" value={currentGoal.monthlyValues ? currentGoal.monthlyValues[i] : ''} onChange={e => updateMonthly(i, e.target.value)} />
                  </div>
                ))}
              </div>

              {/* Jul-Dez */}
              <div className="grid grid-cols-6 gap-2">
                {['Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'].map((m, i) => (
                  <div key={m}>
                    <div className="text-center text-xs text-slate-500 mb-1">{m}</div>
                    <input type="number" className="w-full border p-2 rounded text-center text-sm" value={currentGoal.monthlyValues ? currentGoal.monthlyValues[i+6] : ''} onChange={e => updateMonthly(i+6, e.target.value)} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-between border-t pt-4">
            <Button size="md" variant="danger" onClick={handleDeleteGoal} className="bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 hover:text-red-700">
               <i className="ph ph-trash"></i> Excluir Metas
            </Button>
            <Button size="md" onClick={handleSave} className="flex items-center gap-2">
               <i className="ph ph-floppy-disk"></i> Salvar Metas e Configurações
            </Button>
          </div>

        </div>
      ) : (
        selInd ? null : (
          <div className="text-center p-10 text-slate-400 bg-white border border-dashed rounded">
            Selecione uma Perspectiva, Objetivo e Indicador acima para definir as metas.
          </div>
        )
      )}
    </div>
  );
}