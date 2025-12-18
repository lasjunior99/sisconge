import React, { useState, useRef, useEffect } from 'react';
import { AppData, Indicator, Goal, Manager } from '../types';
import { Button } from './ui/Button';
import { Tooltip } from './ui/Tooltip';

interface PerformanceResult {
  meta: number;
  real: number;
  pct: number;
  color: string;
  icon: string;
  displayMeta: string;
  displayReal: string;
  displayPct: string;
  valid: boolean;
}

interface ResultsPanelProps {
  data: AppData;
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export const ResultsPanel: React.FC<ResultsPanelProps> = ({ data }) => {
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(new Date().getMonth());
  const reportRef = useRef<HTMLDivElement>(null);

  const [filterPersp, setFilterPersp] = useState('');
  const [filterObj, setFilterObj] = useState('');
  const [filterInd, setFilterInd] = useState('');
  const [filterMgr, setFilterMgr] = useState('');

  // Use the identity reference year
  const referenceYear = data.identity.referenceYear || new Date().getFullYear();

  const parseVal = (v: string | undefined): number => {
    if (!v) return 0;
    return parseFloat(v.replace(',', '.').replace(/[^0-9.-]/g, '')) || 0;
  };

  const hasValue = (v: string | undefined): boolean => {
    return v !== undefined && v !== null && v.trim() !== '';
  };

  const calculatePerformance = (ind: Indicator, goal: Goal | undefined, monthIdx: number): PerformanceResult => {
    const defaultResult: PerformanceResult = {
      meta: 0,
      real: 0,
      pct: 0,
      color: 'bg-slate-100 text-slate-400',
      icon: 'minus',
      displayMeta: '-',
      displayReal: '-',
      displayPct: '-',
      valid: false
    };

    if (!goal) return defaultResult;

    const calcType = ind.calcType || 'isolated';
    const polarity = ind.polarity || 'maior_melhor';
    const rollingWindow = ind.rollingWindow || 3;

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
        if (!hasReais[monthIdx]) return defaultResult;
        break;
      case 'accumulated':
      case 'ytd':
        for (let i = 0; i <= monthIdx; i++) {
            if (hasReais[i]) {
                calcMeta += metas[i];
                calcReal += reais[i];
            }
        }
        if (calcReal === 0 && !hasReais.some((v, k) => k <= monthIdx && v)) return defaultResult;
        break;
      case 'average':
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
            return defaultResult;
        }
        break;
      case 'rolling':
        const start = Math.max(0, monthIdx - rollingWindow + 1);
        for (let i = start; i <= monthIdx; i++) {
             if (hasReais[i]) {
                 calcMeta += metas[i];
                 calcReal += reais[i];
             }
        }
        if (calcReal === 0 && !hasReais.slice(start, monthIdx + 1).some(x => x)) return defaultResult;
        break;
    }

    let pct = 0;
    if (polarity === 'estavel') {
        pct = calcMeta === 0 ? 0 : (calcReal / calcMeta) * 100;
    } else if (polarity === 'menor_melhor') {
        pct = calcReal === 0 ? 100 : (calcMeta / calcReal) * 100;
    } else {
        pct = calcMeta === 0 ? 0 : (calcReal / calcMeta) * 100;
    }

    let colorClass = 'bg-slate-100 text-slate-500';
    let icon = 'minus';
    
    if (pct >= 110) {
        colorClass = 'bg-blue-600 text-white';
        icon = 'trophy';
    } else if (pct >= 100) {
        colorClass = 'bg-green-600 text-white';
        icon = 'check-circle';
    } else if (pct >= 90) {
        colorClass = 'bg-yellow-400 text-yellow-900';
        icon = 'warning';
    } else {
        colorClass = 'bg-red-600 text-white';
        icon = 'warning-circle';
    }

    return {
        meta: calcMeta,
        real: calcReal,
        pct: pct,
        color: colorClass,
        icon,
        displayMeta: calcMeta.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        displayReal: calcReal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        displayPct: pct.toFixed(2) + '%',
        valid: true
    };
  };

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

  const groupedData = filteredPerspectives.map(p => {
      const objectives = filteredObjectives.filter(o => o.perspectiveId === p.id).map(obj => {
          const indicators = filteredIndicators.filter(i => i.objetivoId === obj.id).map(ind => {
              const goal = data.goals.find(g => g.indicatorId === ind.id && g.year === referenceYear);
              const perf = calculatePerformance(ind, goal, selectedMonthIndex);
              return { ...ind, perf };
          });
          return { ...obj, indicators };
      });
      return { ...p, objectives };
  });

  const exportPDF = async () => {
     if (!reportRef.current || !window.html2canvas || !window.jspdf) return;
     const canvas = await window.html2canvas(reportRef.current, { scale: 1.5, useCORS: true, backgroundColor: '#ffffff' });
     const imgData = canvas.toDataURL('image/png');
     const pdf = new window.jspdf.jsPDF('p', 'mm', 'a4');
     const pdfWidth = pdf.internal.pageSize.getWidth();
     const h = (canvas.height * pdfWidth) / canvas.width;
     pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, h);
     pdf.save(`Contrato_Gestao_${referenceYear}.pdf`);
  };

  const handleExportExcel = () => {
      if (!window.XLSX) return;
      const XLSX = window.XLSX;
      const wb = XLSX.utils.book_new();
      const monthNamesShort = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
      
      const row1 = [`EMPRESA: ${data.identity.companyName}`, "", "", "", `ANO DE REFERÊNCIA: ${referenceYear}`];
      const row2 = ["PERSPECTIVAS", "OBJETIVOS ESTRATÉGICOS", "INDICADORES", "RESPONSÁVEL"];
      monthNamesShort.forEach(m => row2.push(m, "", ""));

      const row3 = ["", "", "", ""];
      monthNamesShort.forEach(() => row3.push("META", "REAL", "% ATING"));

      const dataRows: any[] = [];
      filteredIndicators.forEach(ind => {
          const perspName = data.perspectives.find(p => p.id === ind.perspectivaId)?.name || "";
          const objName = data.objectives.find(o => o.id === ind.objetivoId)?.name || "";
          const mgrName = data.managers.find(m => m.id === ind.gestorId)?.name || "";
          const goal = data.goals.find(g => g.indicatorId === ind.id && g.year === referenceYear);
          const row = [perspName, objName, ind.name, mgrName];
          for(let i=0; i<12; i++) {
             const perf = calculatePerformance(ind, goal, i);
             row.push(perf.valid ? perf.displayMeta : "-", perf.valid ? perf.displayReal : "-", perf.valid ? perf.displayPct : "-");
          }
          dataRows.push(row);
      });

      const wsData = [row1, row2, row3, ...dataRows];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const merges = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }];
      for (let i = 0; i < 12; i++) {
          const startCol = 4 + (i * 3);
          merges.push({ s: { r: 1, c: startCol }, e: { r: 1, c: startCol + 2 } });
      }
      ws['!merges'] = merges;
      ws['!cols'] = [{ wch: 20 }, { wch: 25 }, { wch: 30 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(wb, ws, "Resultados");
      XLSX.writeFile(wb, `Resultados_${referenceYear}.xlsx`);
  };

  return (
    <div className="pb-10 bg-slate-50 min-h-screen">
      <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 mb-6 sticky top-14 z-10">
         <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-4">
            <div>
              <h2 className="text-xl font-bold text-blue-900 uppercase"> Painel de Resultados</h2>
              <p className="text-xs text-slate-500">Ano: {referenceYear}</p>
            </div>
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
                    <button onClick={() => setSelectedMonthIndex(Math.max(0, selectedMonthIndex - 1))} className="p-2 hover:bg-white rounded"><i className="ph ph-caret-left"></i></button>
                    <span className="w-32 text-center font-bold text-blue-900 text-sm uppercase flex items-center justify-center gap-1">
                      {MONTH_NAMES[selectedMonthIndex]}
                      <Tooltip text="Período ao qual o resultado informado se refere." />
                    </span>
                    <button onClick={() => setSelectedMonthIndex(Math.min(11, selectedMonthIndex + 1))} className="p-2 hover:bg-white rounded"><i className="ph ph-caret-right"></i></button>
                </div>
                <div className="flex gap-2">
                    <Button variant="secondary" onClick={handleExportExcel} className="bg-green-50 text-green-700">Excel</Button>
                    <Button variant="secondary" onClick={exportPDF}>PDF</Button>
                </div>
            </div>
         </div>
      </div>
      <div ref={reportRef} className="bg-white shadow-xl rounded-lg border p-8 max-w-[1200px] mx-auto">
          <div className="border-b-2 border-blue-900 pb-4 mb-6 flex justify-between items-end">
              <div><h1 className="text-2xl font-black text-slate-800 uppercase">{data.identity.companyName}</h1><h2 className="text-sm font-medium text-slate-500 uppercase">Desempenho • {MONTH_NAMES[selectedMonthIndex]}</h2></div>
              <div className="text-right"><div className="text-[10px] text-slate-400">Ano Referência</div><div className="font-mono text-xl font-bold text-blue-900">{referenceYear}</div></div>
          </div>
          <div className="flex flex-col gap-8">
              {groupedData.map(persp => (
                  <div key={persp.id} className="break-inside-avoid">
                      <div className="bg-slate-800 text-white p-3 rounded-t-lg font-bold text-xs uppercase flex items-center gap-1">
                        {persp.name}
                        <Tooltip text="Eixo estratégico ao qual o indicador pertence." />
                      </div>
                      <div className="border-x border-b p-4 space-y-4 bg-slate-50">
                          {persp.objectives.map(obj => (
                              <div key={obj.id} className="bg-white border rounded shadow-sm">
                                  <div className="bg-slate-100 px-4 py-1 border-b font-bold text-[10px] uppercase text-slate-700 flex items-center gap-1">
                                    {obj.name}
                                    <Tooltip text="Objetivo estratégico associado ao indicador monitorado." />
                                  </div>
                                  <table className="w-full text-[11px]">
                                      <thead className="bg-slate-50 border-b text-[10px] text-slate-400 uppercase">
                                          <tr>
                                            <th className="p-2 text-left w-1/3 flex items-center gap-1">Indicador <Tooltip text="Indicador que receberá o valor realizado no período." /></th>
                                            <th className="p-2 text-right">Meta</th>
                                            <th className="p-2 text-right flex items-center justify-end gap-1">Real <Tooltip text="Resultado efetivamente alcançado no período, conforme a ficha técnica do indicador." /></th>
                                            <th className="p-2 text-center">%</th>
                                            <th className="p-2 text-center w-12 flex items-center justify-center gap-1">F <Tooltip text="Classificação automática do desempenho (Semáforo)." /></th>
                                          </tr>
                                      </thead>
                                      <tbody>
                                          {obj.indicators.map(ind => (
                                              <tr key={ind.id} className="border-b last:border-0">
                                                  <td className="p-2 font-medium">
                                                    <div className="flex items-center gap-1">
                                                      {ind.name}
                                                      <Tooltip text={`Regra: ${ind.calcType === 'isolated' ? 'ISOLADO' : ind.calcType?.toUpperCase()}. ${ind.description || ''}`} />
                                                    </div>
                                                  </td>
                                                  <td className="p-2 text-right">{ind.perf.displayMeta}</td>
                                                  <td className="p-2 text-right font-bold text-blue-900">{ind.perf.displayReal}</td>
                                                  <td className="p-2 text-center font-bold">{ind.perf.displayPct}</td>
                                                  <td className="p-2 text-center"><div className={`w-6 h-6 mx-auto rounded-full flex items-center justify-center text-white ${ind.perf.color}`}><i className={`ph ph-${ind.perf.icon} text-[10px]`}></i></div></td>
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
      </div>
    </div>
  );
};
