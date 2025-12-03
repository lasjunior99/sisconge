import React, { useState, useEffect } from 'react';
import { AppData, Goal, Indicator } from '../types';
import { Button } from './ui/Button';

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
    
    alert('Metas e Configurações salvas!');
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

  // Derived lists for selects
  const filteredObjectives = data.objectives.filter(o => !selPersp || o.perspectiveId === selPersp);
  const filteredIndicators = data.indicators.filter(i => (!selObj || i.objetivoId === selObj) && (!selPersp || i.perspectivaId === selPersp));

  // Empty state check
  const hasStructure = data.perspectives.length > 0 && data.objectives.length > 0 && data.indicators.length > 0;

  return (
    <div className="pb-10">
      <h2 className="text-2xl font-bold text-blue-900 mb-6">Cadastro de Metas</h2>
      
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

          <div className="flex justify-end">
            <Button size="md" onClick={handleSave}>Salvar Metas</Button>
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