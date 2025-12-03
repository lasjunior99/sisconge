import React, { useState, useEffect } from 'react';
import { AppData, Indicator } from '../types';
import { Button } from './ui/Button';

interface ManagerPanelProps {
  data: AppData;
  onUpdate: (newData: AppData) => void;
}

export const ManagerPanel: React.FC<ManagerPanelProps> = ({ data, onUpdate }) => {
  // Filtros de Pesquisa (Dropdowns)
  const [filterManagerId, setFilterManagerId] = useState('');
  const [filterIndicatorId, setFilterIndicatorId] = useState('');

  const [selectedIndicatorId, setSelectedIndicatorId] = useState<string | null>(null);
  
  // Form State
  const [formData, setFormData] = useState<Partial<Indicator>>({});

  useEffect(() => {
    if (selectedIndicatorId) {
      const ind = data.indicators.find(i => i.id === selectedIndicatorId);
      if (ind) {
        setFormData({
          description: ind.description,
          formula: ind.formula,
          unit: ind.unit,
          source: ind.source,
          periodicity: ind.periodicity,
          polarity: ind.polarity
        });
      }
    } else {
      setFormData({});
    }
  }, [selectedIndicatorId, data.indicators]);

  const handleSave = (status: 'draft' | 'final') => {
    if (!selectedIndicatorId) return;

    const updatedIndicators = data.indicators.map(ind => {
      if (ind.id === selectedIndicatorId) {
        return {
          ...ind,
          ...formData,
          status,
          updatedAt: new Date().toISOString()
        } as Indicator;
      }
      return ind;
    });

    onUpdate({ ...data, indicators: updatedIndicators });
    
    if (status === 'final') {
      alert('Indicador finalizado e bloqueado com sucesso! Somente o Administrador poderá reabrí-lo.');
      setSelectedIndicatorId(null);
    } else {
      alert('Rascunho salvo com sucesso. Você pode continuar editando.');
    }
  };

  const handleDeleteDetails = () => {
    if (!window.confirm("Tem certeza? Isso apagará os textos preenchidos neste formulário (Descrição, Fórmula, etc), mantendo apenas o nome do indicador.")) {
      return;
    }
    setFormData({
      description: '',
      formula: '',
      unit: '',
      source: '',
      periodicity: '',
      polarity: ''
    });
  };

  const handleInputChange = (field: keyof Indicator, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const clearFilters = () => {
    setFilterManagerId('');
    setFilterIndicatorId('');
  };

  // Lógica de Filtragem Cruzada
  // 1. Opções para o dropdown de Indicadores (Se um gestor estiver selecionado, mostra só os dele)
  const indicatorOptions = data.indicators.filter(ind => 
    !filterManagerId || ind.gestorId === filterManagerId
  );

  // 2. Lista lateral filtrada final
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

      <div className="mb-6 p-4 bg-white border border-slate-200 rounded shadow-sm">
        <div className="flex justify-between items-center mb-3">
             <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                🔍 Pesquisar Ficha Técnica
             </h4>
             {(filterManagerId || filterIndicatorId) && (
                <button onClick={clearFilters} className="text-xs text-blue-600 hover:underline">
                    Limpar Filtros
                </button>
             )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Dropdown Gestor */}
            <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Filtrar por Gestor</label>
                <select 
                    className="w-full p-2 border rounded text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-200 transition-all outline-none"
                    value={filterManagerId}
                    onChange={(e) => {
                        setFilterManagerId(e.target.value);
                        setFilterIndicatorId(''); // Limpa indicador ao trocar gestor para evitar inconsistencia
                    }}
                >
                    <option value="">Todos os Gestores</option>
                    {data.managers.map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                </select>
            </div>

            {/* Dropdown Indicador */}
            <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Filtrar por Indicador</label>
                <select 
                    className="w-full p-2 border rounded text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-200 transition-all outline-none"
                    value={filterIndicatorId}
                    onChange={(e) => setFilterIndicatorId(e.target.value)}
                    disabled={indicatorOptions.length === 0}
                >
                    <option value="">Todos os Indicadores</option>
                    {indicatorOptions.map(ind => (
                        <option key={ind.id} value={ind.id}>{ind.name}</option>
                    ))}
                </select>
            </div>
            
            <div className="flex items-end text-xs text-slate-400 pb-2">
                Exibindo {filteredIndicators.length} registro(s).
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sidebar List */}
        <div className="lg:col-span-1 bg-white border rounded shadow-sm overflow-hidden flex flex-col h-[600px]">
          <div className="bg-slate-100 p-3 border-b font-semibold text-slate-700 text-sm">
            Lista de Indicadores
          </div>
          <ul className="divide-y overflow-y-auto flex-1">
            {filteredIndicators.length === 0 && (
              <li className="p-4 text-slate-500 text-sm text-center">Nenhum indicador encontrado com os filtros atuais.</li>
            )}
            {filteredIndicators.map(ind => {
                const managerName = data.managers.find(m => m.id === ind.gestorId)?.name || 'Sem Gestor';
                return (
                    <li 
                    key={ind.id}
                    onClick={() => setSelectedIndicatorId(ind.id)}
                    className={`p-3 cursor-pointer hover:bg-blue-50 transition-colors ${selectedIndicatorId === ind.id ? 'bg-blue-100 border-l-4 border-blue-600' : ''}`}
                    >
                        <div className="font-bold text-sm text-slate-800">{ind.name}</div>
                        <div className="text-xs text-slate-600 mt-1 flex items-center gap-1">
                            👤 {managerName}
                        </div>
                        <div className="mt-2 flex justify-between items-center">
                            <span className="text-[10px] text-slate-400 truncate max-w-[120px]" title={data.objectives.find(o => o.id === ind.objetivoId)?.name}>
                                {data.objectives.find(o => o.id === ind.objetivoId)?.name}
                            </span>
                            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${ind.status === 'final' ? 'bg-green-200 text-green-800' : 'bg-yellow-200 text-yellow-800'}`}>
                                {ind.status === 'final' ? 'Final' : 'Rascunho'}
                            </span>
                        </div>
                    </li>
                );
            })}
          </ul>
        </div>

        {/* Form Area */}
        <div className="lg:col-span-2">
          {selectedIndicatorId && activeIndicator ? (
            <div className="bg-white p-6 rounded shadow border">
              <div className="mb-6 border-b pb-4">
                <h3 className="text-xl font-bold text-slate-800">{activeIndicator.name}</h3>
                <div className="flex flex-col md:flex-row md:items-center gap-2 mt-2">
                     <span className="text-xs font-bold bg-slate-100 px-2 py-1 rounded text-slate-600">
                        Gestor: {data.managers.find(m => m.id === activeIndicator.gestorId)?.name}
                     </span>
                     <span className="text-slate-400 text-xs hidden md:inline">|</span>
                     <span className="text-slate-500 text-xs">
                        Objetivo: {data.objectives.find(o => o.id === activeIndicator.objetivoId)?.name}
                     </span>
                </div>
              </div>

              {isLocked && (
                <div className="mb-4 p-4 bg-green-50 text-green-800 text-sm rounded border border-green-200 flex items-start gap-2">
                  <span className="text-xl">🔒</span>
                  <div>
                    <strong>Indicador Finalizado.</strong><br/>
                    Os dados foram salvos definitivamente. Para realizar alterações, solicite ao Administrador para "Liberar Edição" na aba Admin.
                  </div>
                </div>
              )}

              <form className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Unidade de Medida</label>
                    <input 
                      disabled={isLocked}
                      className="w-full p-2 border rounded bg-slate-50 focus:bg-white disabled:bg-slate-100 disabled:text-slate-500"
                      placeholder="Ex: %, R$, Unidade"
                      value={formData.unit || ''}
                      onChange={e => handleInputChange('unit', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Periodicidade</label>
                    <input 
                      disabled={isLocked}
                      className="w-full p-2 border rounded bg-slate-50 focus:bg-white disabled:bg-slate-100 disabled:text-slate-500"
                      placeholder="Ex: Mensal, Trimestral"
                      value={formData.periodicity || ''}
                      onChange={e => handleInputChange('periodicity', e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Descrição Operacional</label>
                  <textarea 
                    disabled={isLocked}
                    className="w-full p-2 border rounded bg-slate-50 focus:bg-white disabled:bg-slate-100 disabled:text-slate-500 h-24"
                    placeholder="O que este indicador mede exatamente?"
                    value={formData.description || ''}
                    onChange={e => handleInputChange('description', e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Fórmula de Cálculo</label>
                  <textarea 
                    disabled={isLocked}
                    className="w-full p-2 border rounded bg-slate-50 focus:bg-white disabled:bg-slate-100 disabled:text-slate-500 h-20"
                    placeholder="Como é calculado? (Ex: Numerador / Denominador)"
                    value={formData.formula || ''}
                    onChange={e => handleInputChange('formula', e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Fonte de Dados</label>
                    <input 
                      disabled={isLocked}
                      className="w-full p-2 border rounded bg-slate-50 focus:bg-white disabled:bg-slate-100 disabled:text-slate-500"
                      value={formData.source || ''}
                      onChange={e => handleInputChange('source', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Polaridade</label>
                    <input 
                      disabled={isLocked}
                      className="w-full p-2 border rounded bg-slate-50 focus:bg-white disabled:bg-slate-100 disabled:text-slate-500"
                      placeholder="Maior é melhor?"
                      value={formData.polarity || ''}
                      onChange={e => handleInputChange('polarity', e.target.value)}
                    />
                  </div>
                </div>

                {!isLocked && (
                  <div className="pt-4 flex flex-wrap gap-3 border-t mt-6 items-center">
                    <Button type="button" variant="secondary" onClick={() => handleSave('draft')}>
                      💾 Salvar Rascunho
                    </Button>
                    <Button type="button" variant="success" onClick={() => handleSave('final')}>
                      ✅ Salvar Definitivamente
                    </Button>
                    <div className="flex-1"></div>
                    <button 
                      type="button" 
                      onClick={handleDeleteDetails} 
                      className="text-red-600 hover:text-red-800 text-xs font-bold underline"
                    >
                      Limpar Detalhes
                    </button>
                  </div>
                )}
              </form>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400 bg-slate-50 rounded border border-dashed p-10 text-center">
              <div>
                <div className="text-4xl mb-4">👈</div>
                Utilize os filtros acima e selecione um indicador na lista para ver e editar os detalhes da Ficha Técnica.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};