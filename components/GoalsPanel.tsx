import React, { useState, useEffect, useRef } from 'react';
import { AppData, Goal, Indicator } from '../types';
import { Button } from './ui/Button';
import { excelParser } from '../services/apiService';
import { Tooltip } from './ui/Tooltip';

interface GoalsPanelProps {
  data: AppData;
  onUpdate: (newData: AppData) => void;
}

export const GoalsPanel: React.FC<GoalsPanelProps> = ({ data, onUpdate }) => {
  const [selPersp, setSelPersp] = useState('');
  const [selObj, setSelObj] = useState('');
  const [selInd, setSelInd] = useState('');
  const [currentGoal, setCurrentGoal] = useState<Goal | null>(null);
  const [currentInd, setCurrentInd] = useState<Indicator | null>(null);

  const referenceYear = data.identity.referenceYear || new Date().getFullYear();

  const parseVal = (v: string) => {
    if (!v) return 0;
    return parseFloat(v.replace(',', '.').replace(/[^0-9.-]/g, '')) || 0;
  };

  useEffect(() => {
    if (selInd) {
      const ind = data.indicators.find(i => i.id === selInd);
      setCurrentInd(ind || null);
      if (ind) {
        const existingGoal = data.goals.find(g => g.indicatorId === ind.id && g.year === referenceYear);
        if (existingGoal) {
          setCurrentGoal({
            ...existingGoal,
            history: existingGoal.history || [],
            monthlyValues: existingGoal.monthlyValues || Array(12).fill(''),
            monthlyRealized: existingGoal.monthlyRealized || Array(12).fill(''),
            locked: existingGoal.locked || false
          });
        } else {
          setCurrentGoal({
            id: 'GOAL-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
            indicatorId: ind.id,
            year: referenceYear,
            history: [],
            monthlyValues: Array(12).fill(''),
            monthlyRealized: Array(12).fill(''),
            locked: false
          });
        }
      }
    } else {
      setCurrentGoal(null);
      setCurrentInd(null);
    }
  }, [selInd, data.indicators, data.goals, referenceYear]);

  const handleSave = () => {
    if (!currentGoal || !currentInd) return;
    const otherGoals = data.goals.filter(g => !(g.indicatorId === currentInd.id && g.year === referenceYear));
    onUpdate({ ...data, goals: [...otherGoals, currentGoal] });
  };

  const handleFinalizeGoals = () => {
    if (!currentGoal) return;
    if (currentGoal.monthlyValues.some(v => v === '')) return alert("Preencha todas as metas.");
    if(confirm("Deseja travar o planejamento para este ano?")) {
       const updatedGoal = { ...currentGoal, locked: true };
       setCurrentGoal(updatedGoal);
       const otherGoals = data.goals.filter(g => !(g.indicatorId === currentInd!.id && g.year === referenceYear));
       onUpdate({ ...data, goals: [...otherGoals, updatedGoal] });
    }
  };

  const updateMonthlyValue = (idx: number, val: string) => {
    if (!currentGoal) return;
    const newM = [...currentGoal.monthlyValues];
    newM[idx] = val;
    setCurrentGoal({ ...currentGoal, monthlyValues: newM });
  };

  const updateMonthlyRealized = (idx: number, val: string) => {
    if (!currentGoal) return;
    const newR = [...(currentGoal.monthlyRealized || Array(12).fill(''))];
    newR[idx] = val;
    setCurrentGoal({ ...currentGoal, monthlyRealized: newR });
  };

  const filteredObjectives = data.objectives.filter(o => !selPersp || o.perspectiveId === selPersp);
  const filteredIndicators = data.indicators.filter(i => (!selObj || i.objetivoId === selObj) && (!selPersp || i.perspectivaId === selPersp));

  return (
    <div className="pb-10">
      <div className="flex justify-between items-center mb-6"><h2 className="text-2xl font-bold text-blue-900">Cadastro de Metas ({referenceYear})</h2></div>
      <div className="bg-white p-4 rounded shadow border mb-6 grid grid-cols-3 gap-4">
        <div className="flex flex-col">
          <label className="text-[10px] font-bold text-slate-500 uppercase mb-1">Perspectiva <Tooltip text="Eixo estratégico ao qual o indicador está vinculado (financeiro, clientes, processos, pessoas, etc.)." /></label>
          <select className="p-2 border rounded text-sm" value={selPersp} onChange={e => {setSelPersp(e.target.value); setSelObj(''); setSelInd('');}}><option value="">Selecione...</option>{data.perspectives.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        </div>
        <div className="flex flex-col">
          <label className="text-[10px] font-bold text-slate-500 uppercase mb-1">Objetivo <Tooltip text="Objetivo que orienta o indicador e o planejamento de metas." /></label>
          <select className="p-2 border rounded text-sm" value={selObj} onChange={e => {setSelObj(e.target.value); setSelInd('');}} disabled={!selPersp}><option value="">Selecione...</option>{filteredObjectives.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
        </div>
        <div className="flex flex-col">
          <label className="text-[10px] font-bold text-slate-500 uppercase mb-1">Indicador <Tooltip text="Indicador que receberá as metas do ano selecionado." /></label>
          <select className="p-2 border rounded text-sm" value={selInd} onChange={e => setSelInd(e.target.value)} disabled={!selObj}><option value="">Selecione...</option>{filteredIndicators.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</select>
        </div>
      </div>
      {currentGoal && currentInd ? (
        <div className="bg-white rounded shadow-lg border p-6 animate-fade-in">
          <div className="mb-4 font-bold text-slate-800 uppercase border-b pb-2">
            {currentInd.name}
            <Tooltip text="As metas devem refletir sazonalidade, capacidade operacional e estratégia do indicador." />
          </div>
          <div className="grid grid-cols-6 gap-4 mb-4">
             {['Jan','Fev','Mar','Abr','Mai','Jun'].map((m, i) => (
                <div key={m}><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 text-center">{m}</label>
                <input placeholder="Meta" disabled={currentGoal.locked} className="w-full p-2 border rounded text-center text-sm" value={currentGoal.monthlyValues[i]} onChange={e => updateMonthlyValue(i, e.target.value)} title="Meta Mensal: Valor planejado para o período." />
                <input placeholder="Real" disabled={!currentGoal.locked} className="w-full p-2 border rounded text-center text-sm mt-1 bg-slate-50" value={currentGoal.monthlyRealized?.[i] || ''} onChange={e => updateMonthlyRealized(i, e.target.value)} title="Real Mensal: Valor efetivamente alcançado no período." /></div>
             ))}
          </div>
          <div className="grid grid-cols-6 gap-4 mb-6">
             {['Jul','Ago','Set','Out','Nov','Dez'].map((m, i) => (
                <div key={m}><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 text-center">{m}</label>
                <input placeholder="Meta" disabled={currentGoal.locked} className="w-full p-2 border rounded text-center text-sm" value={currentGoal.monthlyValues[i+6]} onChange={e => updateMonthlyValue(i+6, e.target.value)} title="Meta Mensal: Valor planejado para o período." />
                <input placeholder="Real" disabled={!currentGoal.locked} className="w-full p-2 border rounded text-center text-sm mt-1 bg-slate-50" value={currentGoal.monthlyRealized?.[i+6] || ''} onChange={e => updateMonthlyRealized(i+6, e.target.value)} title="Real Mensal: Valor efetivamente alcançado no período." /></div>
             ))}
          </div>
          <div className="flex justify-between border-t pt-4">
             <div className="text-xs text-slate-500 font-bold flex items-center gap-1">
               {currentGoal.locked ? "🔒 Metas Travadas" : "✏️ Planejamento Aberto"}
               <Tooltip text={currentGoal.locked ? "As metas foram consolidadas para o ano." : "Indica que as metas ainda podem ser ajustadas antes da consolidação."} />
             </div>
             <div className="flex gap-2">
                {!currentGoal.locked && <Button variant="success" onClick={handleFinalizeGoals} className="flex items-center gap-1">
                  Finalizar Planejamento
                  <Tooltip text="Consolida as metas como referência oficial do ano. Alterações posteriores devem ser excepcionais." />
                </Button>}
                <Button variant="primary" onClick={handleSave} className="flex items-center gap-1">
                  Salvar Alterações
                  <Tooltip text="Salva ajustes realizados sem encerrar o planejamento." />
                </Button>
             </div>
          </div>
        </div>
      ) : <div className="text-center p-12 bg-white border border-dashed rounded text-slate-400">Selecione o indicador acima.</div>}
    </div>
  );
};
