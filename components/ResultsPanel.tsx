import React, { useState, useRef, useEffect } from 'react';
import { AppData, Indicator, Goal, Manager } from '../types';
import { Button } from './ui/Button';

interface ResultsPanelProps {
  data: AppData;
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export const ResultsPanel: React.FC<ResultsPanelProps> = ({ data }) => {
  // Estado de controle do Painel
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(new Date().getMonth());
  const reportRef = useRef<HTMLDivElement>(null);

  // FILTROS
  const [filterPersp, setFilterPersp] = useState('');
  const [filterObj, setFilterObj] = useState('');
  const [filterInd, setFilterInd] = useState('');
  const [filterMgr, setFilterMgr] = useState('');

  // Ano de Referência (Detectado dinamicamente das metas)
  const [referenceYear, setReferenceYear] = useState<number>(new Date().getFullYear());

  useEffect(() => {
     // Tenta encontrar o ano mais comum nas metas, ou usa o primeiro encontrado
     const years = data.goals.map(g => g.year).filter(y => y);
     if (years.length > 0) {
        // Pega o primeiro ano disponível como referência para o relatório, 
        // assumindo que o contrato de gestão geralmente é do mesmo ano.
        // Se houver mistura de anos, pega o mais frequente (mode) ou o mais recente.
        // Simplificação: Pega o ano da primeira meta encontrada.
        setReferenceYear(years[0]);
     } else {
        setReferenceYear(new Date().getFullYear());
     }
  }, [data.goals]);

  // Helper de parse seguro
  const parseVal = (v: string | undefined): number => {
    if (!v) return 0;
    return parseFloat(v.replace(',', '.').replace(/[^0-9.-]/g, '')) || 0;
  };

  const hasValue = (v: string | undefined): boolean => {
    return v !== undefined && v !== null && v.trim() !== '';
  };

  // --- MOTOR DE CÁLCULO CENTRAL ---
  const calculatePerformance = (ind: Indicator, goal: Goal | undefined, monthIdx: number) => {
    // Valores padrão
    const result = {
      meta: 0,
      real: 0,
      pct: 0,
      color: 'bg-slate-100 text-slate-400', // Cinza (Sem dados)
      icon: 'minus',
      displayMeta: '-',
      displayReal: '-',
      displayPct: '-',
      valid: false
    };

    if (!goal) return result;

    const calcType = ind.calcType || 'isolated';
    const polarity = ind.polarity || 'maior_melhor';
    const rollingWindow = ind.rollingWindow || 3;

    // Extrair arrays numéricos
    const metas = goal.monthlyValues.map(parseVal);
    const reais = (goal.monthlyRealized || []).map(parseVal);
    const hasReais = (goal.monthlyRealized || []).map(hasValue);
    
    let calcMeta = 0;
    let calcReal = 0;
    let count = 0;

    switch (calcType) {
      case 'isolated':
        calcMeta = metas[monthIdx];
        calcReal = reais[monthIdx];
        if (!hasReais[monthIdx]) return result; // Sem dado realizado no mês
        break;

      case 'accumulated': // Soma do início até o mês
      case 'ytd': // Year To Date (Mesma lógica do acumulado simples num ano fiscal jan-dez)
        for (let i = 0; i <= monthIdx; i++) {
            if (hasReais[i]) {
                calcMeta += metas[i];
                calcReal += reais[i];
            }
        }
        if (calcReal === 0 && !hasReais.some((v, k) => k <= monthIdx && v)) return result;
        break;

      case 'average': // Média do acumulado
        for (let i = 0; i <= monthIdx; i++) {
            if (hasReais[i]) {
                calcMeta += metas[i];
                calcReal += reais[i];
                count++;
            }
        }
        if (count > 0) {
            calcMeta = calcMeta / count;
            calcReal = calcReal / count;
        } else {
            return result;
        }
        break;

      case 'rolling': // Acumulado dos últimos N meses
        // Janela: [monthIdx - rollingWindow + 1] até [monthIdx]
        const start = Math.max(0, monthIdx - rollingWindow + 1);
        for (let i = start; i <= monthIdx; i++) {
             if (hasReais[i]) {
                 calcMeta += metas[i];
                 calcReal += reais[i];
             }
        }
        if (calcReal === 0 && !hasReais.slice(start, monthIdx + 1).some(x => x)) return result;
        break;
    }

    // Cálculo do Percentual (Performance)
    let pct = 0;
    
    if (polarity === 'estavel') {
        if (calcMeta === 0) pct = 0;
        else pct = (calcReal / calcMeta) * 100;
    } else if (polarity === 'menor_melhor') {
        if (calcReal === 0) pct = 100; 
        else pct = (calcMeta / calcReal) * 100;
    } else {
        if (calcMeta === 0) pct = 0;
        else pct = (calcReal / calcMeta) * 100;
    }

    // Definição do Farol (Semaphore)
    let colorClass = 'bg-slate-100 text-slate-500';
    let icon = 'minus';
    
    if (pct >= 110) {
        colorClass = 'bg-blue-600 text-white'; // Superação
        icon = 'trophy';
    } else if (pct >= 100) {
        colorClass = 'bg-green-600 text-white'; // Meta Atingida
        icon = 'check-circle';
    } else if (pct >= 90) {
        colorClass = 'bg-yellow-400 text-yellow-900'; // Atenção
        icon = 'warning';
    } else {
        colorClass = 'bg-red-600 text-white'; // Crítico
        icon = 'warning-circle';
    }

    return {
        meta: calcMeta,
        real: calcReal,
        pct: pct,
        color: colorClass,
        icon,
        displayMeta: calcMeta.toLocaleString('pt-BR', { maximumFractionDigits: 2 }),
        displayReal: calcReal.toLocaleString('pt-BR', { maximumFractionDigits: 2 }),
        displayPct: pct.toFixed(1) + '%',
        valid: true
    };
  };

  // --- FILTRAGEM ---
  const filteredIndicators = data.indicators.filter(ind => {
      if (filterPersp && ind.perspectivaId !== filterPersp) return false;
      if (filterObj && ind.objetivoId !== filterObj) return false;
      if (filterMgr && ind.gestorId !== filterMgr) return false;
      if (filterInd && ind.id !== filterInd) return false;
      return true;
  });

  const filteredObjectives = data.objectives.filter(o => 
      filteredIndicators.some(i => i.objetivoId === o.id)
  );

  const filteredPerspectives = data.perspectives.filter(p => 
      filteredObjectives.some(o => o.perspectiveId === p.id)
  );

  // --- RENDERIZAÇÃO ESTRUTURADA (PARA TELA) ---
  const groupedData = filteredPerspectives.map(p => {
      const objectives = filteredObjectives.filter(o => o.perspectiveId === p.id).map(obj => {
          const indicators = filteredIndicators.filter(i => i.objetivoId === obj.id).map(ind => {
              const goal = data.goals.find(g => g.indicatorId === ind.id);
              const perf = calculatePerformance(ind, goal, selectedMonthIndex);
              return { ...ind, perf };
          });
          return { ...obj, indicators };
      });
      return { ...p, objectives };
  });

  // --- EXPORTAÇÃO PDF ---
  const exportPDF = async () => {
     if (!reportRef.current || !window.html2canvas || !window.jspdf) {
         alert("Bibliotecas não carregadas.");
         return;
     }
     
     const element = reportRef.current;
     try {
         const canvas = await window.html2canvas(element, { scale: 1.5, useCORS: true, backgroundColor: '#ffffff' });
         const imgData = canvas.toDataURL('image/png');
         const { jsPDF } = window.jspdf;
         const pdf = new jsPDF('p', 'mm', 'a4');
         const pdfWidth = pdf.internal.pageSize.getWidth();
         const imgProps = pdf.getImageProperties(imgData);
         const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;
         
         pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, imgHeight);
         pdf.save(`Contrato_Gestao_${MONTH_NAMES[selectedMonthIndex]}.pdf`);
     } catch(e) {
         console.error(e);
         alert("Erro ao gerar PDF.");
     }
  };

  // --- EXPORTAÇÃO EXCEL COMPLETA ---
  const handleExportExcel = () => {
      if (!window.XLSX) return alert("Erro: Biblioteca Excel não carregada.");
      
      const XLSX = window.XLSX;
      const wb = XLSX.utils.book_new();

      // Preparando os dados
      const companyName = data.identity.companyName || "EMPRESA";
      
      // Header Row 1: Main Title + Year
      // We need to calculate width to merge properly
      // Fixed Columns: Persp, Obj, Ind, Resp = 4 columns
      // Month Columns: 12 months * 3 columns each (Meta, Real, %) = 36 columns
      // Total columns = 40
      
      const monthNamesShort = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
      
      const row1 = [
        `EMPRESA: ${companyName}`, "", "", "", 
        `ANO DE REFERÊNCIA: ${referenceYear}`
      ];
      
      const row2 = [
          "PERSPECTIVAS", 
          "OBJETIVOS ESTRATÉGICOS", 
          "INDICADORES", 
          "RESPONSÁVEL"
      ];
      // Add month names to row 2
      monthNamesShort.forEach(m => row2.push(m, "", ""));

      const row3 = [
          "", "", "", "" // Empty space under fixed cols
      ];
      // Add subheaders to row 3
      monthNamesShort.forEach(() => row3.push("META", "REAL", "% ATING"));

      // Data Rows
      const dataRows: any[] = [];

      // We must use filtered data to respect user's view
      // We'll iterate all filtered indicators flat list for excel export logic
      filteredIndicators.forEach(ind => {
          const perspName = data.perspectives.find(p => p.id === ind.perspectivaId)?.name || "";
          const objName = data.objectives.find(o => o.id === ind.objetivoId)?.name || "";
          const mgrName = data.managers.find(m => m.id === ind.gestorId)?.name || "";
          const goal = data.goals.find(g => g.indicatorId === ind.id);
          
          const row = [
              perspName,
              objName,
              ind.name,
              mgrName
          ];

          // Loop 12 months
          for(let i=0; i<12; i++) {
             const perf = calculatePerformance(ind, goal, i);
             row.push(
                 perf.valid ? perf.displayMeta : "-",
                 perf.valid ? perf.displayReal : "-",
                 perf.valid ? perf.displayPct : "-"
             );
          }
          dataRows.push(row);
      });

      // Combine all
      const wsData = [
          row1,
          row2,
          row3,
          ...dataRows
      ];

      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // --- MERGES ---
      const merges = [];
      
      // Merge Company Name (A1:D1)
      merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } });
      
      // Merge Month Headers in Row 2
      // Starts at Column E (Index 4)
      for (let i = 0; i < 12; i++) {
          const startCol = 4 + (i * 3);
          merges.push({ s: { r: 1, c: startCol }, e: { r: 1, c: startCol + 2 } });
      }

      ws['!merges'] = merges;
      
      // Styling widths
      ws['!cols'] = [
         { wch: 20 }, // Persp
         { wch: 25 }, // Obj
         { wch: 30 }, // Ind
         { wch: 15 }, // Resp
      ];

      XLSX.utils.book_append_sheet(wb, ws, "Resultados");
      XLSX.writeFile(wb, `Resultados_${referenceYear}.xlsx`);
  };

  return (
    <div className="pb-10 bg-slate-50 min-h-screen">
      
      {/* HEADER DE CONTROLE */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 mb-6 sticky top-14 z-10">
         <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-4">
            <div>
                <h2 className="text-xl font-bold text-blue-900 uppercase tracking-tight flex items-center gap-2">
                    <i className="ph ph-chart-pie-slice"></i> Painel de Resultados
                </h2>
                <p className="text-xs text-slate-500">Aferição Oficial do Contrato de Gestão</p>
            </div>

            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
                    <button onClick={() => setSelectedMonthIndex(Math.max(0, selectedMonthIndex - 1))} className="p-2 hover:bg-white rounded shadow-sm text-slate-600"><i className="ph ph-caret-left"></i></button>
                    <span className="w-32 text-center font-bold text-blue-900 text-sm uppercase">{MONTH_NAMES[selectedMonthIndex]}</span>
                    <button onClick={() => setSelectedMonthIndex(Math.min(11, selectedMonthIndex + 1))} className="p-2 hover:bg-white rounded shadow-sm text-slate-600"><i className="ph ph-caret-right"></i></button>
                </div>
                
                <div className="flex gap-2">
                    <Button variant="secondary" onClick={handleExportExcel} className="flex items-center gap-2 bg-green-50 text-green-700 hover:bg-green-100 border-green-200">
                        <i className="ph ph-microsoft-excel-logo"></i> Excel
                    </Button>
                    <Button variant="secondary" onClick={exportPDF} className="flex items-center gap-2">
                        <i className="ph ph-file-pdf"></i> PDF
                    </Button>
                </div>
            </div>
         </div>

         {/* BARRA DE FILTROS */}
         <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-4 border-t border-slate-100">
            <select className="p-2 text-xs border rounded bg-slate-50" value={filterPersp} onChange={e => { setFilterPersp(e.target.value); setFilterObj(''); }}>
               <option value="">Todas Perspectivas</option>
               {data.perspectives.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select className="p-2 text-xs border rounded bg-slate-50" value={filterObj} onChange={e => setFilterObj(e.target.value)} disabled={!filterPersp && data.objectives.length > 50}>
               <option value="">Todos Objetivos</option>
               {data.objectives.filter(o => !filterPersp || o.perspectiveId === filterPersp).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
             <select className="p-2 text-xs border rounded bg-slate-50" value={filterMgr} onChange={e => setFilterMgr(e.target.value)}>
               <option value="">Todos Gestores</option>
               {data.managers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <select className="p-2 text-xs border rounded bg-slate-50" value={filterInd} onChange={e => setFilterInd(e.target.value)}>
               <option value="">Todos Indicadores</option>
               {filteredIndicators.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
         </div>
      </div>

      {/* ÁREA DO RELATÓRIO OFICIAL */}
      <div ref={reportRef} className="bg-white shadow-xl rounded-lg overflow-hidden border border-slate-200 p-8 max-w-[1200px] mx-auto">
          
          {/* CABEÇALHO DO DOCUMENTO */}
          <div className="border-b-2 border-blue-900 pb-4 mb-6 flex justify-between items-end">
              <div>
                  <h1 className="text-2xl font-black text-slate-800 uppercase">{data.identity.companyName || 'EMPRESA'}</h1>
                  <h2 className="text-sm font-medium text-slate-500 uppercase tracking-widest">Relatório de Desempenho • {MONTH_NAMES[selectedMonthIndex]}</h2>
              </div>
              <div className="text-right">
                 <div className="text-[10px] text-slate-400 uppercase">Ano de Referência</div>
                 <div className="font-mono text-xl font-bold text-blue-900">{referenceYear}</div>
              </div>
          </div>

          {/* LEGENDA DO FAROL */}
          <div className="flex justify-end gap-4 mb-4 text-[10px] font-bold uppercase tracking-wide">
             <div className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-600 rounded-full"></span> Superação (&gt;110%)</div>
             <div className="flex items-center gap-1"><span className="w-3 h-3 bg-green-600 rounded-full"></span> Meta (100-110%)</div>
             <div className="flex items-center gap-1"><span className="w-3 h-3 bg-yellow-400 rounded-full"></span> Atenção (90-99%)</div>
             <div className="flex items-center gap-1"><span className="w-3 h-3 bg-red-600 rounded-full"></span> Crítico (&lt;90%)</div>
          </div>

          {/* TABELA ESTRATÉGICA */}
          <div className="flex flex-col gap-8">
              {groupedData.length === 0 && (
                 <div className="text-center py-10 text-slate-400">Nenhum resultado encontrado para os filtros selecionados.</div>
              )}
              {groupedData.map(persp => (
                  <div key={persp.id} className="break-inside-avoid">
                      {/* HEADER PERSPECTIVA */}
                      <div className="bg-slate-800 text-white p-3 rounded-t-lg flex items-center gap-2 shadow-md">
                          <i className="ph ph-squares-four text-lg text-blue-300"></i>
                          <span className="font-bold text-sm uppercase tracking-wider">{persp.name}</span>
                      </div>
                      
                      <div className="border-x border-b border-slate-200 bg-slate-50 p-4 rounded-b-lg space-y-4">
                          {persp.objectives.map(obj => (
                              <div key={obj.id} className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
                                  {/* HEADER OBJETIVO */}
                                  <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 flex items-center justify-between">
                                      <div className="font-bold text-slate-700 text-xs uppercase flex items-center gap-2">
                                          <i className="ph ph-target text-blue-600"></i> {obj.name}
                                      </div>
                                  </div>

                                  {/* LISTA DE INDICADORES */}
                                  <table className="w-full text-xs">
                                      <thead className="bg-slate-50 text-slate-500 font-bold border-b">
                                          <tr>
                                              <th className="p-3 text-left w-1/3">Indicador</th>
                                              <th className="p-3 text-center">Tipo Cálculo</th>
                                              <th className="p-3 text-center">Unid.</th>
                                              <th className="p-3 text-right">Meta</th>
                                              <th className="p-3 text-right">Realizado</th>
                                              <th className="p-3 text-center">Desempenho</th>
                                              <th className="p-3 text-center w-16">Farol</th>
                                          </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100">
                                          {obj.indicators.length === 0 && <tr><td colSpan={7} className="p-3 text-center text-slate-400">Sem indicadores.</td></tr>}
                                          {obj.indicators.map(ind => (
                                              <tr key={ind.id} className="hover:bg-blue-50/50 transition-colors">
                                                  <td className="p-3 font-medium text-slate-800">
                                                      {ind.name}
                                                      <div className="text-[10px] text-slate-400 font-normal truncate max-w-[200px]">{ind.description}</div>
                                                  </td>
                                                  <td className="p-3 text-center text-slate-500 uppercase font-semibold text-[10px]">
                                                      {ind.calcType === 'rolling' ? `Rolling (${ind.rollingWindow}m)` : ind.calcType || 'Isolado'}
                                                  </td>
                                                  <td className="p-3 text-center text-slate-500">{ind.unit}</td>
                                                  
                                                  <td className="p-3 text-right font-mono font-medium text-slate-700">
                                                      {ind.perf.valid ? ind.perf.displayMeta : '-'}
                                                  </td>
                                                  <td className="p-3 text-right font-mono font-bold text-blue-900">
                                                      {ind.perf.valid ? ind.perf.displayReal : '-'}
                                                  </td>
                                                  
                                                  <td className="p-3 text-center">
                                                      {ind.perf.valid ? (
                                                          <span className="font-bold">{ind.perf.displayPct}</span>
                                                      ) : <span className="text-slate-300">-</span>}
                                                  </td>
                                                  
                                                  <td className="p-3 text-center">
                                                      {ind.perf.valid ? (
                                                          <div className={`w-8 h-8 mx-auto rounded-full flex items-center justify-center shadow-sm ${ind.perf.color}`}>
                                                              <i className={`ph ph-${ind.perf.icon} text-sm`}></i>
                                                          </div>
                                                      ) : (
                                                          <div className="w-8 h-8 mx-auto rounded-full bg-slate-100 flex items-center justify-center">
                                                              <i className="ph ph-minus text-slate-300"></i>
                                                          </div>
                                                      )}
                                                  </td>
                                              </tr>
                                          ))}
                                      </tbody>
                                  </table>
                              </div>
                          ))}
                      </div>
                  </div>
              ))}
          </div>

          <div className="mt-8 pt-4 border-t border-slate-200 text-center text-[10px] text-slate-400">
              Documento gerado automaticamente pelo SISCONGE • Contrato de Gestão • Uso Interno
          </div>

      </div>
    </div>
  );
};