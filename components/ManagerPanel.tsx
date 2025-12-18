import React, { useState, useEffect } from 'react';
import { AppData, Indicator, Perspective, Objective, Manager, SemaphoreRule, SemaphoreSettings } from '../types';
import { Button } from './ui/Button';
import { Tooltip } from './ui/Tooltip';

interface ManagerPanelProps {
  data: AppData;
  onUpdate: (newData: AppData, section?: any) => void;
}

const UNIT_OPTIONS = ['R$', 'U$', 'mts', '%', 'dias', 'horas', 'num', 'outra'];
const PERIODICITY_OPTIONS = ['mensal', 'bimestral', 'trimestral', 'quadrimestral', 'semestral', 'anual'];
const POLARITY_OPTIONS = [
  { value: 'maior_melhor', label: 'Quanto Maior, Melhor' },
  { value: 'menor_melhor', label: 'Quanto Menor, Melhor' },
  { value: 'estavel', label: 'Estável (Faixa de Ouro)' },
];

const CALC_TYPE_LABELS: Record<string, string> = {
  isolated: 'ISOLADO',
  accumulated: 'ACUMULADO',
  ytd: 'YTD',
  average: 'MÉDIA',
  rolling: 'MÓVEL'
};

const CALC_TYPE_TOOLTIPS: Record<string, string> = {
  isolated: "Considera apenas o valor do período analisado.",
  accumulated: "Soma todos os valores desde o início do ano.",
  ytd: "Valor acumulado do início do ano até o período atual.",
  average: "Média dos valores registrados até o período.",
  rolling: "Cálculo com base em uma janela móvel de períodos (3, 6 ou 12 meses)."
};

type PanelMode = 'structure' | 'detail';

export const ManagerPanel: React.FC<ManagerPanelProps> = ({ data, onUpdate }) => {
  const [activeMode, setActiveMode] = useState<PanelMode>('structure');
  const [filterManagerId, setFilterManagerId] = useState('');
  const [filterIndicatorId, setFilterIndicatorId] = useState('');
  const [selectedIndicatorId, setSelectedIndicatorId] = useState<string | null>(null);
  
  // Structure Mode States
  const [newPerspName, setNewPerspName] = useState('');
  const [newManagerName, setNewManagerName] = useState('');
  const [newObjName, setNewObjName] = useState('');
  const [selectedPerspForObj, setSelectedPerspForObj] = useState('');
  const [newIndName, setNewIndName] = useState('');
  const [indPerspFilter, setIndPerspFilter] = useState('');
  const [indObjFilter, setIndObjFilter] = useState('');
  const [indManager, setIndManager] = useState('');
  
  const [selectedPerspIds, setSelectedPerspIds] = useState<string[]>([]);
  const [selectedMgrIds, setSelectedMgrIds] = useState<string[]>([]);
  const [selectedObjIds, setSelectedObjIds] = useState<string[]>([]);
  const [selectedIndIds, setSelectedIndIds] = useState<string[]>([]);

  // Detail Form State
  const [formData, setFormData] = useState<Partial<Indicator>>({});
  const [sem, setSem] = useState<SemaphoreSettings>(data.globalSettings?.semaphore || {
    blue: { operator: '>=', value: '110' },
    green: { operator: '>=', value: '100' },
    yellow: { operator: 'between', value: '90', value2: '99.9' },
    red: { operator: '<', value: '90' }
  });

  const generateId = (prefix: string) => `${prefix}-` + Math.random().toString(36).substr(2, 9).toUpperCase();

  useEffect(() => {
    if (selectedIndicatorId) {
      const ind = data.indicators.find(i => i.id === selectedIndicatorId);
      if (ind) {
        setFormData({
          description: ind.description,
          formula: ind.formula,
          unit: ind.unit || 'num',
          source: ind.source,
          periodicity: ind.periodicity || 'mensal',
          polarity: ind.polarity || 'maior_melhor',
          calcType: ind.calcType || 'isolated',
          rollingWindow: ind.rollingWindow || 3
        });
        
        if (ind.semaphore) {
           setSem(ind.semaphore);
        } else if (data.globalSettings?.semaphore) {
           setSem(data.globalSettings.semaphore);
        }
      }
    }
  }, [selectedIndicatorId, data.indicators, data.globalSettings]);

  const handleSaveStructure = (status: 'draft' | 'final') => {
    onUpdate(data, 'structure');
    alert(status === 'final' ? "Estrutura Salva Definitivamente!" : "Rascunho de Estrutura Salvo!");
  };

  const handleSaveDetail = (status: 'draft' | 'final') => {
    if (!selectedIndicatorId) return;
    const updatedIndicators = data.indicators.map(ind => {
      if (ind.id === selectedIndicatorId) {
        return {
          ...ind,
          ...formData,
          semaphore: sem,
          status,
          updatedAt: new Date().toISOString()
        } as Indicator;
      }
      return ind;
    });
    onUpdate({ ...data, indicators: updatedIndicators }, 'indicators');
    alert(status === 'final' ? "Indicador Finalizado!" : "Rascunho Salvo!");
  };

  const handleEdit = (type: 'persp' | 'obj' | 'mgr' | 'ind', id: string, currentName: string) => {
    const newName = prompt("Editar nome:", currentName);
    if (!newName || newName.trim() === currentName) return;
    const trimmed = newName.trim();
    let newData = { ...data };
    if (type === 'persp') newData.perspectives = data.perspectives.map(p => p.id === id ? { ...p, name: trimmed } : p);
    else if (type === 'mgr') newData.managers = data.managers.map(m => m.id === id ? { ...m, name: trimmed } : m);
    else if (type === 'obj') newData.objectives = data.objectives.map(o => o.id === id ? { ...o, name: trimmed } : o);
    else if (type === 'ind') newData.indicators = data.indicators.map(i => i.id === id ? { ...i, name: trimmed } : i);
    onUpdate(newData, 'structure');
  };

  const handleDelete = (type: 'persp' | 'obj' | 'mgr' | 'ind', id: string) => {
    if (!confirm("Tem certeza que deseja excluir este item?")) return;
    let newData = { ...data };
    if (type === 'persp') newData.perspectives = data.perspectives.filter(p => p.id !== id);
    else if (type === 'mgr') newData.managers = data.managers.filter(m => m.id !== id);
    else if (type === 'obj') newData.objectives = data.objectives.filter(o => o.id !== id);
    else if (type === 'ind') {
      newData.indicators = data.indicators.filter(i => i.id !== id);
      newData.goals = data.goals.filter(g => g.indicatorId !== id);
    }
    onUpdate(newData, 'structure');
  };

  const handleBulkDelete = (type: 'persp' | 'mgr' | 'obj' | 'ind') => {
    const ids = type === 'persp' ? selectedPerspIds : type === 'mgr' ? selectedMgrIds : type === 'obj' ? selectedObjIds : selectedIndIds;
    if (ids.length === 0) return alert("Nenhum item selecionado.");
    if (!confirm(`Deseja excluir os ${ids.length} itens selecionados?`)) return;
    let newData = { ...data };
    if (type === 'persp') { newData.perspectives = data.perspectives.filter(p => !ids.includes(p.id)); setSelectedPerspIds([]); }
    else if (type === 'mgr') { newData.managers = data.managers.filter(m => !ids.includes(m.id)); setSelectedMgrIds([]); }
    else if (type === 'obj') { newData.objectives = data.objectives.filter(o => !ids.includes(o.id)); setSelectedObjIds([]); }
    else if (type === 'ind') { newData.indicators = data.indicators.filter(i => !ids.includes(i.id)); newData.goals = data.goals.filter(g => !ids.includes(g.indicatorId)); setSelectedIndIds([]); }
    onUpdate(newData, 'structure');
  };

  const addIndicator = () => {
    if (!newIndName.trim() || !indObjFilter) return alert("Selecione um Objetivo e digite o nome.");
    const obj = data.objectives.find(o => o.id === indObjFilter);
    if (!obj) return;
    const newInd: Indicator = {
        id: generateId('IND'),
        name: newIndName.trim(),
        objetivoId: obj.id,
        perspectivaId: obj.perspectiveId,
        gestorId: indManager,
        description: '', formula: '', unit: 'num', source: '', periodicity: 'mensal', polarity: 'maior_melhor', status: 'draft', updatedAt: new Date().toISOString()
    };
    onUpdate({ ...data, indicators: [...data.indicators, newInd] }, 'structure');
    setNewIndName('');
  };

  // Fix: changed color type from keyof typeof sem to keyof SemaphoreSettings to avoid 'symbol' index errors
  const renderSemaphoreRuleInput = (color: keyof SemaphoreSettings, label: string) => {
    const rule = sem[color];
    const updateRule = (updates: Partial<SemaphoreRule>) => {
      setSem({ ...sem, [color]: { ...rule, ...updates } });
    };

    const semaphoreTooltips: Record<string, string> = {
      blue: "Faixa de superação.",
      green: "Faixa aceitável da meta atingida.",
      yellow: "Faixa de atenção.",
      red: "Crítico."
    };

    return (
      <div className="bg-white p-5 border border-slate-200 rounded-lg shadow-sm">
        <span className={`block text-[11px] font-black uppercase mb-3 tracking-wider ${
          color === 'blue' ? 'text-blue-700' : 
          color === 'green' ? 'text-green-700' : 
          color === 'yellow' ? 'text-amber-600' : 'text-red-700'
        }`}>
          {label}
          <Tooltip text={semaphoreTooltips[color as string]} />
        </span>
        <div className="flex gap-2 items-center">
          <div className="relative">
            <select 
              className="appearance-none bg-white border border-slate-300 rounded px-3 py-2 text-sm font-bold pr-10 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
              value={rule.operator} 
              onChange={e => updateRule({ operator: e.target.value as any })}
              disabled={isLocked}
            >
              <option value="=">=</option>
              <option value=">">&gt;</option>
              <option value="<">&lt;</option>
              <option value=">=">&gt;=</option>
              <option value="<=">&lt;=</option>
              <option value="between">Entre</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
              <i className="ph ph-caret-down text-xs"></i>
            </div>
          </div>
          <input 
            type="number" step="0.01"
            className="flex-1 min-w-[80px] p-2 border border-slate-300 rounded text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none" 
            value={rule.value} 
            onChange={e => updateRule({ value: e.target.value })} 
            disabled={isLocked}
          />
          {rule.operator === 'between' && (
            <>
              <span className="text-xs font-black text-slate-400">e</span>
              <input 
                type="number" step="0.01"
                className="flex-1 min-w-[80px] p-2 border border-slate-300 rounded text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none" 
                value={rule.value2} 
                onChange={e => updateRule({ value2: e.target.value })} 
                disabled={isLocked}
              />
            </>
          )}
        </div>
      </div>
    );
  };

  const filteredIndicators = data.indicators.filter(ind => {
    const matchManager = filterManagerId ? ind.gestorId === filterManagerId : true;
    const matchIndicator = filterIndicatorId ? ind.id === filterIndicatorId : true;
    return matchManager && matchIndicator;
  });

  const activeIndicator = data.indicators.find(i => i.id === selectedIndicatorId);
  const isLocked = activeIndicator?.status === 'final';

  return (
    <div className="pb-10">
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <h2 className="text-2xl font-bold text-blue-900 flex items-center gap-2">
          <i className="ph ph-file-text"></i> Fichas Técnicas
        </h2>
        {activeMode === 'structure' && (
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => handleSaveStructure('draft')} className="flex items-center gap-2">
              <i className="ph ph-floppy-disk"></i> Salvar Rascunho
            </Button>
            <Button variant="success" size="sm" onClick={() => { if(confirm("Deseja salvar definitivamente esta estrutura?")) handleSaveStructure('final'); }} className="flex items-center gap-2">
              <i className="ph ph-check-circle"></i> Salvar Definitivo
            </Button>
          </div>
        )}
      </div>

      <div className="flex gap-2 border-b border-slate-200 mb-6 overflow-x-auto">
        <button className={`px-6 py-2 text-sm font-bold whitespace-nowrap ${activeMode === 'structure' ? 'text-blue-700 border-b-2 border-blue-700' : 'text-slate-500'}`} onClick={() => setActiveMode('structure')}>1. Estrutura (Manual)</button>
        <button className={`px-6 py-2 text-sm font-bold whitespace-nowrap ${activeMode === 'detail' ? 'text-blue-700 border-b-2 border-blue-700' : 'text-slate-500'}`} onClick={() => setActiveMode('detail')}>2. Detalhamento do Indicador</button>
      </div>

      {activeMode === 'structure' && (
        <div className="space-y-8 animate-fade-in">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white p-4 border rounded shadow-sm">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="font-bold flex items-center gap-2"><i className="ph ph-squares-four"></i> Perspectivas</h3>
                        <button onClick={() => handleBulkDelete('persp')} className="text-xs text-red-600 font-bold hover:underline">Excluir Marcados</button>
                    </div>
                    <div className="flex gap-2 mb-3"><input className="flex-1 border p-2 rounded text-sm" value={newPerspName} onChange={e => setNewPerspName(e.target.value)} /><Button size="sm" onClick={() => { if(newPerspName.trim()) { onUpdate({ ...data, perspectives: [...data.perspectives, { id: generateId('PERSP'), name: newPerspName.trim() }] }, 'structure'); setNewPerspName(''); } }}>+</Button></div>
                    <ul className="divide-y max-h-40 overflow-auto">
                        {data.perspectives.map(p => (
                            <li key={p.id} className="p-2 text-sm flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <input type="checkbox" checked={selectedPerspIds.includes(p.id)} onChange={e => setSelectedPerspIds(e.target.checked ? [...selectedPerspIds, p.id] : selectedPerspIds.filter(id => id !== p.id))} />
                                    {p.name}
                                </div>
                                <div className="flex gap-2"><button onClick={() => handleEdit('persp', p.id, p.name)} className="text-blue-600"><i className="ph ph-pencil"></i></button><button onClick={() => handleDelete('persp', p.id)} className="text-red-600"><i className="ph ph-trash"></i></button></div>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="bg-white p-4 border rounded shadow-sm">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="font-bold flex items-center gap-2"><i className="ph ph-users"></i> Gestores</h3>
                        <button onClick={() => handleBulkDelete('mgr')} className="text-xs text-red-600 font-bold hover:underline">Excluir Marcados</button>
                    </div>
                    <div className="flex gap-2 mb-3"><input className="flex-1 border p-2 rounded text-sm" value={newManagerName} onChange={e => setNewManagerName(e.target.value)} /><Button size="sm" onClick={() => { if(newManagerName.trim()) { onUpdate({ ...data, managers: [...data.managers, { id: generateId('MGR'), name: newManagerName.trim() }] }, 'structure'); setNewManagerName(''); } }}>+</Button></div>
                    <ul className="divide-y max-h-40 overflow-auto">
                        {data.managers.map(m => (
                            <li key={m.id} className="p-2 text-sm flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <input type="checkbox" checked={selectedMgrIds.includes(m.id)} onChange={e => setSelectedMgrIds(e.target.checked ? [...selectedMgrIds, m.id] : selectedMgrIds.filter(id => id !== m.id))} />
                                    {m.name}
                                </div>
                                <div className="flex gap-2"><button onClick={() => handleEdit('mgr', m.id, m.name)} className="text-blue-600"><i className="ph ph-pencil"></i></button><button onClick={() => handleDelete('mgr', m.id)} className="text-red-600"><i className="ph ph-trash"></i></button></div>
                            </li>
                        ))}
                    </ul>
                </div>
           </div>
           <div className="bg-white p-4 border rounded shadow-sm">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="font-bold flex items-center gap-2"><i className="ph ph-target"></i> Objetivos Estratégicos</h3>
                    <button onClick={() => handleBulkDelete('obj')} className="text-xs text-red-600 font-bold hover:underline">Excluir Marcados</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
                    <select className="border p-2 rounded text-sm" value={selectedPerspForObj} onChange={e => setSelectedPerspForObj(e.target.value)}><option value="">Perspectiva...</option>{data.perspectives.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                    <input className="border p-2 rounded text-sm" placeholder="Nome do Objetivo" value={newObjName} onChange={e => setNewObjName(e.target.value)} /><Button onClick={() => { if(newObjName.trim() && selectedPerspForObj) { onUpdate({ ...data, objectives: [...data.objectives, { id: generateId('OBJ'), name: newObjName.trim(), perspectiveId: selectedPerspForObj, gestorId: '' }] }, 'structure'); setNewObjName(''); } }}>Adicionar</Button>
                </div>
                <ul className="divide-y max-h-60 overflow-auto">
                    {data.objectives.map(o => (
                        <li key={o.id} className="p-2 text-sm flex justify-between">
                            <div className="flex items-center gap-2">
                                <input type="checkbox" checked={selectedObjIds.includes(o.id)} onChange={e => setSelectedObjIds(e.target.checked ? [...selectedObjIds, o.id] : selectedObjIds.filter(id => id !== o.id))} />
                                <div><span className="font-bold">{o.name}</span><br/><span className="text-xs text-slate-400">{data.perspectives.find(p => p.id === o.perspectiveId)?.name}</span></div>
                            </div>
                            <div className="flex gap-2"><button onClick={() => handleEdit('obj', o.id, o.name)} className="text-blue-600"><i className="ph ph-pencil"></i></button><button onClick={() => handleDelete('obj', o.id)} className="text-red-600"><i className="ph ph-trash"></i></button></div>
                        </li>
                    ))}
                </ul>
           </div>
           <div className="bg-white p-4 border rounded shadow-sm">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="font-bold flex items-center gap-2"><i className="ph ph-chart-line-up"></i> Indicadores (Lista Mestres)</h3>
                    <button onClick={() => handleBulkDelete('ind')} className="text-xs text-red-600 font-bold hover:underline">Excluir Marcados</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-3">
                    <select className="border p-2 rounded text-sm" value={indPerspFilter} onChange={e => { setIndPerspFilter(e.target.value); setIndObjFilter(''); }}><option value="">Perspectiva...</option>{data.perspectives.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                    <select className="border p-2 rounded text-sm" value={indObjFilter} onChange={e => setIndObjFilter(e.target.value)} disabled={!indPerspFilter}><option value="">Objetivo...</option>{data.objectives.filter(o => o.perspectiveId === indPerspFilter).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
                    <input className="border p-2 rounded text-sm md:col-span-1" placeholder="Nome Indicador" value={newIndName} onChange={e => setNewIndName(e.target.value)} />
                    <select className="border p-2 rounded text-sm" value={indManager} onChange={e => setIndManager(e.target.value)}><option value="">Gestor...</option>{data.managers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
                    <Button onClick={addIndicator} className="md:col-start-4">Adicionar Indicador</Button>
                </div>
                <ul className="divide-y max-h-80 overflow-auto border-t">
                    {data.indicators.map(ind => (
                        <li key={ind.id} className="p-3 text-sm flex justify-between items-center hover:bg-slate-50">
                            <div className="flex items-center gap-3">
                                <input type="checkbox" checked={selectedIndIds.includes(ind.id)} onChange={e => setSelectedIndIds(e.target.checked ? [...selectedIndIds, ind.id] : selectedIndIds.filter(id => id !== ind.id))} />
                                <div><div className="font-bold">{ind.name}</div><div className="text-[10px] text-slate-400">{data.managers.find(m => m.id === ind.gestorId)?.name || 'Sem Gestor'}</div></div>
                            </div>
                            <div className="flex gap-2"><button onClick={() => handleEdit('ind', ind.id, ind.name)} className="text-blue-600"><i className="ph ph-pencil"></i></button><button onClick={() => handleDelete('ind', ind.id)} className="text-red-600"><i className="ph ph-trash"></i></button></div>
                        </li>
                    ))}
                </ul>
           </div>
        </div>
      )}

      {activeMode === 'detail' && (
        <div className="animate-fade-in">
          <div className="mb-6 p-4 bg-white border border-slate-200 rounded shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
               <label className="text-xs font-bold text-slate-500 uppercase">Gestor Responsável</label>
               <select className="w-full p-2 border border-slate-200 rounded text-sm mt-1 focus:ring-2 focus:ring-blue-500 outline-none" value={filterManagerId} onChange={e => { setFilterManagerId(e.target.value); setFilterIndicatorId(''); setSelectedIndicatorId(null); }}>
                   <option value="">Todos os Gestores</option>
                   {data.managers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
               </select>
            </div>
            <div>
               <label className="text-xs font-bold text-slate-500 uppercase">Selecionar Indicador para Detalhamento</label>
               <select className="w-full p-2 border border-slate-200 rounded text-sm mt-1 focus:ring-2 focus:ring-blue-500 outline-none" value={filterIndicatorId} onChange={e => { setFilterIndicatorId(e.target.value); setSelectedIndicatorId(e.target.value); }}>
                   <option value="">Selecione...</option>
                   {data.indicators.filter(i => !filterManagerId || i.gestorId === filterManagerId).map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
               </select>
            </div>
          </div>

          {selectedIndicatorId && activeIndicator ? (
            <div className="bg-white p-8 rounded shadow-lg border border-slate-100 space-y-8">
              <div className="border-b pb-4 flex justify-between items-start">
                <div>
                   <h3 className="text-3xl font-black text-blue-900 uppercase tracking-tight">
                     {activeIndicator.name}
                     <Tooltip text="Nome claro e objetivo do indicador. Evite siglas sem definição." />
                   </h3>
                   <div className="flex gap-4 text-xs mt-2 text-slate-400 font-black uppercase tracking-widest">
                       <span>Responsável: {data.managers.find(m => m.id === activeIndicator.gestorId)?.name || 'NÃO ATRIBUÍDO'} <Tooltip text="Responsável pelo acompanhamento e pela qualidade das informações do indicador." /></span>
                       <span>|</span>
                       <span className={activeIndicator.status === 'final' ? 'text-green-600' : 'text-amber-500'}>Status: {activeIndicator.status === 'final' ? 'FINALIZADO' : 'EM RASCUNHO'}</span>
                   </div>
                </div>
                {isLocked && <Button variant="secondary" size="sm" onClick={() => { if(confirm("Liberar para edição?")) handleSaveDetail('draft'); }} className="flex items-center gap-2">
                  <i className="ph ph-lock-open"></i> Desbloquear Edição
                </Button>}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl shadow-inner">
                    <label className="block text-[10px] font-black text-slate-400 mb-4 uppercase tracking-widest">Configuração Base</label>
                    <div className="space-y-5">
                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase mb-1 block">Unidade de Medida <Tooltip text="Define o formato do indicador (%, R$, número, índice, pontos)." /></label>
                        <select disabled={isLocked} className="w-full p-2 border border-slate-300 rounded text-sm bg-white font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500" value={formData.unit || 'num'} onChange={e => setFormData({...formData, unit: e.target.value})}>
                          {UNIT_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase mb-1 block">Periodicidade de Coleta <Tooltip text="Frequência de apuração do indicador (mensal, trimestral, anual, etc.)." /></label>
                        <select disabled={isLocked} className="w-full p-2 border border-slate-300 rounded text-sm bg-white font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500" value={formData.periodicity || 'mensal'} onChange={e => setFormData({...formData, periodicity: e.target.value})}>
                          {PERIODICITY_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase mb-1 block">Polaridade do Indicador</label>
                        <select disabled={isLocked} className="w-full p-2 border border-slate-300 rounded text-sm bg-white font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500" value={formData.polarity || 'maior_melhor'} onChange={e => setFormData({...formData, polarity: e.target.value})}>
                          {POLARITY_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                        <div className="mt-1 text-[9px] text-slate-400 italic">
                          {formData.polarity === 'maior_melhor' ? "O desempenho melhora quando o valor aumenta." : formData.polarity === 'menor_melhor' ? "O desempenho melhora quando o valor diminui." : "Busca atingir uma faixa específica."}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="lg:col-span-2 p-5 bg-slate-50 border border-slate-200 rounded-xl shadow-inner space-y-5">
                    <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">Lógica e Dados</label>
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-tighter block mb-2">Tipo de Cálculo <Tooltip text="Define como o valor será tratado nas análises." /></label>
                      <div className="flex flex-wrap gap-4">
                        {['isolated', 'accumulated', 'ytd', 'average', 'rolling'].map(t => (
                          <label key={t} className="flex items-center gap-2 text-[10px] font-black cursor-pointer group">
                            <input 
                              disabled={isLocked} 
                              type="radio" 
                              name="calcType" 
                              className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-slate-400"
                              checked={formData.calcType === t} 
                              onChange={() => setFormData({...formData, calcType: t as any})} 
                            /> 
                            <span className="text-slate-500 group-hover:text-blue-700 transition-colors uppercase flex items-center gap-1">
                              {CALC_TYPE_LABELS[t]}
                              <Tooltip text={CALC_TYPE_TOOLTIPS[t]} />
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div><label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Descrição / Conceito <Tooltip text="Explica o que o indicador mede e sua relevância estratégica. Não pode deixar dúvidas para que acessa o planejamento estratégico." /></label><textarea disabled={isLocked} className="w-full p-3 border border-slate-300 rounded text-sm h-16 focus:ring-2 focus:ring-blue-500 outline-none font-medium" value={formData.description || ''} onChange={e => setFormData({...formData, description: e.target.value})} /></div>
                    <div><label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Fórmula de Cálculo <Tooltip text="Descreve claramente como o indicador é calculado. Não pode deixar dúvidas sobre a forma de cálculo." /></label><textarea disabled={isLocked} className="w-full p-3 border border-slate-300 rounded text-sm h-12 focus:ring-2 focus:ring-blue-500 outline-none font-mono" value={formData.formula || ''} onChange={e => setFormData({...formData, formula: e.target.value})} /></div>
                    <div><label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Fonte dos Dados (Origem) <Tooltip text="Origem oficial das informações utilizadas no indicador." /></label><input disabled={isLocked} className="w-full p-3 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium" value={formData.source || ''} onChange={e => setFormData({...formData, source: e.target.value})} /></div>
                  </div>
              </div>

              <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl shadow-inner">
                <label className="block text-[10px] font-black text-slate-400 mb-5 uppercase tracking-widest">Farol de Desempenho Personalizado</label>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                   {renderSemaphoreRuleInput('blue', 'Azul (Superação)')}
                   {renderSemaphoreRuleInput('green', 'Verde (Meta)')}
                   {renderSemaphoreRuleInput('yellow', 'Amarelo (Atenção)')}
                   {renderSemaphoreRuleInput('red', 'Vermelho (Crítico)')}
                </div>
              </div>

              {!isLocked && (
                <div className="flex justify-end gap-3 pt-8 border-t">
                  <Button variant="secondary" className="px-10 py-3 flex items-center gap-2 shadow-sm" onClick={() => handleSaveDetail('draft')}>
                    <i className="ph ph-floppy-disk text-lg"></i> Salvar Rascunho
                    <Tooltip text="Salva o preenchimento parcial. O indicador ainda não entra nas análises." />
                  </Button>
                  <Button variant="success" className="px-10 py-3 flex items-center gap-2 shadow-sm" onClick={() => { if(confirm("Deseja finalizar esta ficha técnica? Isso bloqueará a edição.")) handleSaveDetail('final'); }}>
                    <i className="ph ph-check-circle text-lg"></i> Salvar Definitivo
                    <Tooltip text="Conclui a ficha técnica e habilita o indicador para uso pleno no sistema." />
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 bg-white border border-dashed rounded-lg shadow-inner">
              <i className="ph ph-cursor-click text-5xl mb-3 opacity-20"></i>
              <p className="font-bold uppercase tracking-widest text-xs">Selecione um indicador acima para detalhar a ficha técnica.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};