import React, { useState } from 'react';
import { AppData } from '../types';
import { Button } from './ui/Button';

interface ResultsPanelProps {
  data: AppData;
}

export const ResultsPanel: React.FC<ResultsPanelProps> = ({ data }) => {
  const [filterPersp, setFilterPersp] = useState('');
  const [filterManager, setFilterManager] = useState('');

  const filtered = data.indicators.filter(ind => {
    const matchPersp = filterPersp ? ind.perspectivaId === filterPersp : true;
    const matchManager = filterManager ? ind.gestorId === filterManager : true;
    return matchPersp && matchManager;
  });

  const exportExcel = (mode: 'summary' | 'detailed') => {
    const XLSX = window.XLSX;
    if (!XLSX) {
        alert("Erro: Biblioteca de exportação não carregada. Verifique sua conexão.");
        return;
    }

    // Prepare data
    const rows = filtered.map(ind => {
        const persp = data.perspectives.find(p => p.id === ind.perspectivaId)?.name || '';
        const obj = data.objectives.find(o => o.id === ind.objetivoId)?.name || '';
        const manager = data.managers.find(m => m.id === ind.gestorId)?.name || '';
        
        const base = {
            'Perspectiva': persp,
            'Objetivo Estratégico': obj,
            'Indicador': ind.name,
            'Gestor': manager,
            'Status': ind.status === 'final' ? 'Definitivo' : 'Rascunho'
        };

        if (mode === 'detailed') {
            const goal = data.goals.find(g => g.indicatorId === ind.id);
            return {
                ...base,
                'Descrição': ind.description,
                'Fórmula': ind.formula,
                'Unidade': ind.unit,
                'Fonte': ind.source,
                'Periodicidade': ind.periodicity,
                'Polaridade': ind.polarity,
                'Tipo Cálculo': ind.calcType || '-',
                'Meta Jan': goal?.monthlyValues[0] || '',
                'Meta Fev': goal?.monthlyValues[1] || '',
                'Meta Mar': goal?.monthlyValues[2] || '',
                'Meta Abr': goal?.monthlyValues[3] || '',
                'Meta Mai': goal?.monthlyValues[4] || '',
                'Meta Jun': goal?.monthlyValues[5] || '',
                'Meta Jul': goal?.monthlyValues[6] || '',
                'Meta Ago': goal?.monthlyValues[7] || '',
                'Meta Set': goal?.monthlyValues[8] || '',
                'Meta Out': goal?.monthlyValues[9] || '',
                'Meta Nov': goal?.monthlyValues[10] || '',
                'Meta Dez': goal?.monthlyValues[11] || '',
            };
        }
        
        return base;
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Indicadores");
    XLSX.writeFile(wb, mode === 'detailed' ? "Relatorio_Detalhado.xlsx" : "Relatorio_Resumido.xlsx");
  };

  return (
    <div className="pb-10">
      <div className="flex justify-between items-end mb-6">
        <h2 className="text-2xl font-bold text-blue-900">Resultados Consolidados</h2>
        <div className="flex gap-2">
            <Button onClick={() => exportExcel('summary')} variant="secondary" size="sm">
                📊 Relatório Resumido (Excel)
            </Button>
            <Button onClick={() => exportExcel('detailed')} variant="primary" size="sm">
                📑 Relatório Detalhado (Excel)
            </Button>
        </div>
      </div>

      <div className="bg-white p-4 rounded shadow border mb-6 flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs font-bold text-slate-500">Filtrar por Perspectiva</label>
          <select 
            className="w-full p-2 border rounded text-sm mt-1"
            value={filterPersp}
            onChange={e => setFilterPersp(e.target.value)}
          >
            <option value="">Todas</option>
            {data.perspectives.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs font-bold text-slate-500">Filtrar por Gestor</label>
          <select 
            className="w-full p-2 border rounded text-sm mt-1"
            value={filterManager}
            onChange={e => setFilterManager(e.target.value)}
          >
            <option value="">Todos</option>
            {data.managers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto bg-white rounded shadow border">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-100 text-slate-700 uppercase font-bold">
            <tr>
              <th className="px-4 py-3 border-b">Perspectiva</th>
              <th className="px-4 py-3 border-b">Objetivo</th>
              <th className="px-4 py-3 border-b">Indicador</th>
              <th className="px-4 py-3 border-b">Fórmula</th>
              <th className="px-4 py-3 border-b">Gestor</th>
              <th className="px-4 py-3 border-b">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  Nenhum registro encontrado.
                </td>
              </tr>
            )}
            {filtered.map(ind => (
              <tr key={ind.id} className="hover:bg-slate-50 group">
                <td className="px-4 py-3 align-top text-slate-500 font-medium text-xs">
                  {data.perspectives.find(p => p.id === ind.perspectivaId)?.name}
                </td>
                <td className="px-4 py-3 align-top text-slate-600 text-xs">
                  {data.objectives.find(o => o.id === ind.objetivoId)?.name}
                </td>
                <td className="px-4 py-3 align-top font-bold text-slate-800">
                  {ind.name}
                  <div className="font-normal text-xs text-slate-500 mt-1 line-clamp-2" title={ind.description}>{ind.description}</div>
                </td>
                <td className="px-4 py-3 align-top text-xs text-slate-500 font-mono bg-slate-50 p-1 rounded max-w-[200px] truncate" title={ind.formula}>
                  {ind.formula || '-'}
                </td>
                <td className="px-4 py-3 align-top text-slate-600 text-xs">
                  {data.managers.find(m => m.id === ind.gestorId)?.name}
                </td>
                <td className="px-4 py-3 align-top">
                  <span className={`inline-block px-2 py-0.5 text-[10px] rounded uppercase font-bold ${ind.status === 'final' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    {ind.status === 'final' ? 'OK' : 'Pendente'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};