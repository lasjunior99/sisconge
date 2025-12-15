import React, { useState, useEffect } from 'react';
import { AppData, Indicator } from '../types';
import { Button } from './ui/Button';

interface ManagerPanelProps {
  data: AppData;
  onUpdate: (newData: AppData) => void;
}

const UNIT_OPTIONS = ['R$', 'U$', 'mts', '%', 'dias', 'horas', 'num', 'outra'];
const PERIODICITY_OPTIONS = ['mensal', 'bimestral', 'trimestral', 'quadrimestral', 'semestral', 'anual'];
const POLARITY_OPTIONS = [
  { value: 'maior_melhor', label: 'Quanto Maior, Melhor' },
  { value: 'menor_melhor', label: 'Quanto Menor, Melhor' },
  { value: 'estavel', label: 'Estável' },
];

export const ManagerPanel: React.FC<ManagerPanelProps> = ({ data, onUpdate }) => {
  const [filterManagerId, setFilterManagerId] = useState('');
  const [filterIndicatorId, setFilterIndicatorId] = useState('');
  const [selectedIndicatorId, setSelectedIndicatorId] = useState<string | null>(null);
  
  // Form State
  const [formData, setFormData] = useState<Partial<Indicator>>({});
  
  // Semaphore Local State (to handle nested object)
  const [sem, setSem] = useState({ blue: '', green: '', yellow: '', red: '' });

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
          calcType: ind.calcType || 'isolated'
        });
        
        // Verifica se o indicador tem semáforo preenchido. Se não tiver nenhum valor, usa o global.
        const indSem = ind.semaphore || { blue: '', green: '', yellow: '', red: '' };
        const hasSpecificValues = indSem.blue || indSem.green || indSem.yellow || indSem.red;
        
        if (hasSpecificValues) {
           setSem(indSem);
        } else if (data.globalSettings?.semaphore) {
           setSem(data.globalSettings.semaphore);
        } else {
           setSem({ blue: '', green: '', yellow: '', red: '' });
        }

      }
    } else {
      setFormData({});
      setSem({ blue: '', green: '', yellow: '', red: '' });
    }
  }, [selectedIndicatorId, data.indicators, data.globalSettings]);

  const handleSave = (status: 'draft' | 'final') => {
    if (!selectedIndicatorId) return;

    const updatedIndicators = data.indicators.map(ind => {
      if (ind.id === selectedIndicatorId) {
        return {
          ...ind,
          ...formData,
          semaphore: sem, // Include semaphore in save
          status,
          updatedAt: new Date().toISOString()
        } as Indicator;
      }
      return ind;
    });

    onUpdate({ ...data, indicators: updatedIndicators });
    // Se estiver apenas salvando rascunho, não precisa limpar a seleção. 
    // Se for finalizar, talvez queira manter na tela para ver o status mudar.
    // setSelectedIndicatorId(null); // Comentado para melhorar UX
  };

  const handleUnlock = () => {
    if(!confirm("Deseja desbloquear este indicador para edição?")) return;
    // Salva imediatamente como Rascunho para liberar os campos
    handleSave('draft');
  };

  const handleDeleteDetails = () => {
    if (!confirm("Limpar detalhes deste indicador?")) return;
    setFormData({ 
      description: '', 
      formula: '', 
      unit: 'num', 
      source: '', 
      periodicity: 'mensal', 
      polarity: 'maior_melhor',
      calcType: 'isolated'
    });
    // Reseta para o padrão global ao limpar
    setSem(data.globalSettings?.semaphore || { blue: '', green: '', yellow: '', red: '' });
  };

  const handleInputChange = (field: keyof Indicator, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
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
      <h2 className="text-2xl font-bold text-blue-900 mb-6">Ficha Técnica do Indicador</h2>
      
      <div className="mb-6 p-4 bg-white border border-slate-200 rounded shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
           <label className="text-xs font-bold text-slate-500">Filtrar por Gestor</label>
           <select className="w-full p-2 border rounded text-sm mt-1" value={filterManagerId} onChange={e => setFilterManagerId(e.target.value)}>
               <option value="">Todos</option>
               {data.managers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
           </select>
        </div>
        <div>
           <label className="text-xs font-bold text-slate-500">Filtrar por Indicador</label>
           <select className="w-full p-2 border rounded text-sm mt-1" value={filterIndicatorId} onChange={e => setFilterIndicatorId(e.target.value)}>
               <option value="">Todos</option>
               {data.indicators.filter(i => !filterManagerId || i.gestorId === filterManagerId).map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
           </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-white border rounded shadow-sm overflow-hidden flex flex-col h-[600px]">
          <div className="bg-slate-100 p-3 border-b font-semibold text-slate-700 text-sm">Lista de Indicadores</div>
          <ul className="divide-y overflow-y-auto flex-1">
            {filteredIndicators.map(ind => (
                <li key={ind.id} onClick={() => setSelectedIndicatorId(ind.id)} className={`p-3 cursor-pointer hover:bg-blue-50 ${selectedIndicatorId === ind.id ? 'bg-blue-100 border-l-4 border-blue-600' : ''}`}>
                    <div className="font-bold text-sm text-slate-800">{ind.name}</div>
                    <div className="text-xs text-slate-600">👤 {data.managers.find(m => m.id === ind.gestorId)?.name || 'Sem Gestor'}</div>
                    <div className="mt-1 flex justify-between"><span className="text-[10px] text-slate-400">{data.objectives.find(o => o.id === ind.objetivoId)?.name}</span><span className={`text-[10px] px-2 rounded font-bold ${ind.status === 'final' ? 'bg-green-200 text-green-800' : 'bg-yellow-200 text-yellow-800'}`}>{ind.status === 'final' ? 'Final' : 'Rascunho'}</span></div>
                </li>
            ))}
          </ul>
        </div>

        <div className="lg:col-span-2">
          {selectedIndicatorId && activeIndicator ? (
            <div className="bg-white p-6 rounded shadow border space-y-4">
              <div className="border-b pb-4">
                <h3 className="text-xl font-bold text-slate-800">{activeIndicator.name}</h3>
                <div className="flex gap-4 text-xs mt-2 text-slate-500">
                    <span>Gestor: <strong>{data.managers.find(m => m.id === activeIndicator.gestorId)?.name}</strong></span>
                </div>
              </div>
              
              {isLocked && (
                <div className="p-3 bg-green-50 text-green-800 rounded text-sm border border-green-200 flex justify-between items-center">
                   <span className="flex items-center gap-2"><i className="ph ph-lock-key text-lg"></i> Indicador Finalizado. Contate o admin para editar.</span>
                   <Button size="sm" variant="secondary" onClick={handleUnlock} className="bg-white border hover:bg-slate-50 text-slate-700">
                      <i className="ph ph-lock-open"></i> Liberar Edição
                   </Button>
                </div>
              )}

              {/* SEMÁFORO - INSERIDO NO TOPO */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                <label className="block text-sm font-bold text-slate-700 mb-3 border-b pb-1">Farol de Desempenho (Semáforo)</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div>
                      <span className="block text-xs text-blue-600 font-bold mb-1">Azul (Superação)</span>
                      <input disabled={isLocked} className="w-full border p-2 rounded text-sm" placeholder="Ex: > 110%" value={sem.blue} onChange={e => setSem({...sem, blue: e.target.value})} />
                   </div>
                   <div>
                      <span className="block text-xs text-green-600 font-bold mb-1">Verde (Meta)</span>
                      <input disabled={isLocked} className="w-full border p-2 rounded text-sm" placeholder="Ex: 100%" value={sem.green} onChange={e => setSem({...sem, green: e.target.value})} />
                   </div>
                   <div>
                      <span className="block text-xs text-yellow-600 font-bold mb-1">Amarelo (Atenção)</span>
                      <input disabled={isLocked} className="w-full border p-2 rounded text-sm" placeholder="Ex: 90-99%" value={sem.yellow} onChange={e => setSem({...sem, yellow: e.target.value})} />
                   </div>
                   <div>
                      <span className="block text-xs text-red-600 font-bold mb-1">Vermelho (Crítico)</span>
                      <input disabled={isLocked} className="w-full border p-2 rounded text-sm" placeholder="Ex: < 90%" value={sem.red} onChange={e => setSem({...sem, red: e.target.value})} />
                   </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* UNIDADE (Select) */}
                  <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1">Unidade</label>
                    <select 
                      disabled={isLocked} 
                      className="w-full p-2 border rounded bg-white" 
                      value={formData.unit || 'num'} 
                      onChange={e => handleInputChange('unit', e.target.value)}
                    >
                      {UNIT_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>

                  {/* PERIODICIDADE (Select) */}
                  <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1">Periodicidade</label>
                    <select 
                      disabled={isLocked} 
                      className="w-full p-2 border rounded bg-white" 
                      value={formData.periodicity || 'mensal'} 
                      onChange={e => handleInputChange('periodicity', e.target.value)}
                    >
                      {PERIODICITY_OPTIONS.map(opt => <option key={opt} value={opt}>{opt.charAt(0).toUpperCase() + opt.slice(1)}</option>)}
                    </select>
                  </div>

                  {/* POLARIDADE (Select) */}
                  <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1">Polaridade</label>
                    <select 
                      disabled={isLocked} 
                      className="w-full p-2 border rounded bg-white" 
                      value={formData.polarity || 'maior_melhor'} 
                      onChange={e => handleInputChange('polarity', e.target.value)}
                    >
                      {POLARITY_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                  </div>
              </div>

              <div><label className="text-xs font-bold text-slate-500">Descrição</label><textarea disabled={isLocked} className="w-full p-2 border rounded h-20" value={formData.description || ''} onChange={e => handleInputChange('description', e.target.value)} /></div>
              <div><label className="text-xs font-bold text-slate-500">Fórmula de Cálculo</label><textarea disabled={isLocked} className="w-full p-2 border rounded h-16" value={formData.formula || ''} onChange={e => handleInputChange('formula', e.target.value)} /></div>
              <div><label className="text-xs font-bold text-slate-500">Fonte de Dados</label><input disabled={isLocked} className="w-full p-2 border rounded" value={formData.source || ''} onChange={e => handleInputChange('source', e.target.value)} /></div>
              
              {/* TIPO DE CÁLCULO - INSERIDO NA BASE */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                <label className="block text-sm font-bold text-slate-700 mb-2">Configuração do Indicador</label>
                <div className="flex flex-col md:flex-row gap-4">
                  <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                    <input disabled={isLocked} type="radio" name="calcTypeMgr" checked={formData.calcType === 'isolated'} onChange={() => handleInputChange('calcType', 'isolated')} />
                    Isolado (Valor do Mês)
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                    <input disabled={isLocked} type="radio" name="calcTypeMgr" checked={formData.calcType === 'accumulated'} onChange={() => handleInputChange('calcType', 'accumulated')} />
                    Acumulado (Soma até a data)
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                    <input disabled={isLocked} type="radio" name="calcTypeMgr" checked={formData.calcType === 'average'} onChange={() => handleInputChange('calcType', 'average')} />
                    Média (Média do acumulado)
                  </label>
                </div>
              </div>

              {!isLocked && (
                  <div className="pt-4 flex gap-2 border-t mt-4">
                      <Button variant="secondary" onClick={() => handleSave('draft')}>Salvar Rascunho</Button>
                      <Button variant="success" onClick={() => handleSave('final')}>Finalizar</Button>
                      <button onClick={handleDeleteDetails} className="ml-auto text-red-600 text-xs hover:underline">Limpar</button>
                  </div>
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400 bg-slate-50 border border-dashed rounded">Selecione um indicador.</div>
          )}
        </div>
      </div>
    </div>
  );
};