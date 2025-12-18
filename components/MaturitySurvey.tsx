
import React, { useState, useRef, useEffect } from 'react';
import { AppData } from '../types';
import { Button } from './ui/Button';
import { excelParser } from '../services/apiService';
import { GoogleGenAI } from "@google/genai";

interface DimensionScore {
  name: string;
  key: string;
  average: number;
}

interface MaturityResult {
  respondentsCount: number;
  questionCount: number;
  dimensionScores: DimensionScore[];
  scoreGeral: number; // 0-100
  level: string;
  comments: string[];
}

const MATURITY_LEVELS = [
  { range: [0, 20], label: 'Inicial' },
  { range: [21, 40], label: 'Emergente' },
  { range: [41, 60], label: 'Estruturado' },
  { range: [61, 80], label: 'Integrado' },
  { range: [81, 100], label: 'Avançado' }
];

const DIMENSIONS = [
  { prefix: 'D1_', name: 'Direcionamento Estratégico' },
  { prefix: 'D2_', name: 'Governança e Decisão' },
  { prefix: 'D3_', name: 'Execução da Estratégia' },
  { prefix: 'D4_', name: 'Monitoramento e Indicadores' },
  { prefix: 'D5_', name: 'Aprendizado e Cultura' }
];

export const MaturitySurvey: React.FC<{ data: AppData }> = ({ data }) => {
  const [result, setResult] = useState<MaturityResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [reportData, setReportData] = useState({
    diagnostico: '',
    analiseDimensoes: '',
    recomendacoes: '',
    riscos: '',
    comentariosFinais: '',
    validated: false,
    reportDate: new Date().toISOString().split('T')[0],
    surveyPeriod: ''
  });
  
  const reportRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('sisconge_maturity_survey');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setResult(parsed.result);
        setReportData(parsed.reportData);
      } catch (e) {
        console.error("Erro ao carregar do localStorage", e);
      }
    }
  }, []);

  const saveToLocal = (res: MaturityResult | null, report: any) => {
    localStorage.setItem('sisconge_maturity_survey', JSON.stringify({ result: res, reportData: report }));
  };

  const clearData = () => {
    if (confirm("Deseja apagar os dados desta pesquisa de maturidade?")) {
      setResult(null);
      setReportData({
        diagnostico: '',
        analiseDimensoes: '',
        recomendacoes: '',
        riscos: '',
        comentariosFinais: '',
        validated: false,
        reportDate: new Date().toISOString().split('T')[0],
        surveyPeriod: ''
      });
      localStorage.removeItem('sisconge_maturity_survey');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const rows = await excelParser.parse(file);
      if (!rows || rows.length < 2) throw new Error("Arquivo vazio ou sem dados.");

      const header = (rows[0] as string[]).map(h => String(h || ''));
      const dataRows = rows.slice(1);

      const scoresByDim: Record<string, number[]> = { 'D1_': [], 'D2_': [], 'D3_': [], 'D4_': [], 'D5_': [] };
      const comments: string[] = [];
      let totalQuestions = 0;

      const dimColumns = header.map((h, idx) => {
        const found = DIMENSIONS.find(d => h.toUpperCase().startsWith(d.prefix));
        if (found) {
            totalQuestions++;
            return { idx, prefix: found.prefix };
        }
        return null;
      }).filter(c => c !== null);

      const commentIdx = header.findIndex(h => h.toLowerCase().includes('comentário') || h.toLowerCase().includes('percepção'));

      dataRows.forEach((row: any[]) => {
        dimColumns.forEach(col => {
          if (!col) return;
          const val = parseFloat(String(row[col.idx] || ''));
          if (!isNaN(val) && val >= 1 && val <= 5) {
            scoresByDim[col.prefix].push(val);
          }
        });
        if (commentIdx !== -1 && row[commentIdx]) {
          comments.push(String(row[commentIdx]));
        }
      });

      const dimensionScores = DIMENSIONS.map(d => {
        const s = scoresByDim[d.prefix];
        const avg = s.length > 0 ? s.reduce((a, b) => a + b, 0) / s.length : 0;
        return { name: d.name, key: d.prefix, average: avg };
      });

      const scoreGeralAvg = dimensionScores.reduce((a, b) => a + b.average, 0) / 5;
      const scoreFinal = (scoreGeralAvg / 5) * 100;
      const level = MATURITY_LEVELS.find(l => scoreFinal >= l.range[0] && scoreFinal <= l.range[1])?.label || 'N/A';

      const newResult: MaturityResult = {
        respondentsCount: dataRows.length,
        questionCount: dimColumns.length, 
        dimensionScores,
        scoreGeral: scoreFinal,
        level,
        comments
      };

      setResult(newResult);
      const newReportData = {
        ...reportData,
        diagnostico: '',
        analiseDimensoes: '',
        recomendacoes: '',
        riscos: '',
        comentariosFinais: '',
        validated: false
      };
      setReportData(newReportData);
      saveToLocal(newResult, newReportData);
      
    } catch (err: any) {
      alert(`Erro na importação: ${err.message}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleGenerateAI = async () => {
    if (!result || !process.env.API_KEY) return alert("Dados ou API Key ausentes.");
    setAiLoading(true);
    
    const scoresText = result.dimensionScores.map(d => `${d.name}: ${(d.average/5*100).toFixed(1)}%`).join(', ');
    const commentsSummary = result.comments.slice(0, 5).join('; ');

    const promptText = `Você é um especialista em estratégia corporativa executivo. Analise os resultados desta pesquisa de maturidade estratégica:
      Score Geral: ${result.scoreGeral.toFixed(1)}% (${result.level})
      Scores por Dimensão: ${scoresText}
      Comentários dos respondentes: ${commentsSummary}

      Gere uma análise executiva estruturada exatamente nestes 5 blocos, separando-os pela string "[BREAK]":
      1. Diagnóstico Geral Interpretativo.
      2. Análise Crítica por Dimensão.
      3. Recomendações Prioritárias para evolução.
      4. Alertas de Risco Estratégico.
      5. Comentários Agregadores finais.`;

    try {
      // Create a new GoogleGenAI instance right before making an API call
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      // Fix: adherent call using simple string contents and property access for .text
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: promptText
      });

      const text = response.text || "";
      const parts = text.split('[BREAK]');

      const updatedReport = {
        ...reportData,
        diagnostico: parts[0]?.trim() || '',
        analiseDimensoes: parts[1]?.trim() || '',
        recomendacoes: parts[2]?.trim() || '',
        riscos: parts[3]?.trim() || '',
        comentariosFinais: parts[4]?.trim() || '',
        validated: false
      };

      setReportData(updatedReport);
      saveToLocal(result, updatedReport);

    } catch (err) {
      console.error(err);
      alert("Erro ao consultar a IA.");
    } finally {
      setAiLoading(false);
    }
  };

  const exportPDF = async () => {
    if (!reportRef.current || !window.html2canvas || !window.jspdf) return;
    const canvas = await window.html2canvas(reportRef.current, { scale: 2 });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new window.jspdf.jsPDF('p', 'mm', 'a4');
    const w = pdf.internal.pageSize.getWidth();
    const h = (canvas.height * w) / canvas.width;
    
    const pageHeight = pdf.internal.pageSize.getHeight();
    let heightLeft = h;
    let position = 0;

    // First page
    pdf.addImage(imgData, 'PNG', 0, position, w, h);
    heightLeft -= pageHeight;

    // Remaining pages
    while (heightLeft > 0) {
      position = heightLeft - h;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, w, h);
      heightLeft -= pageHeight;
    }

    pdf.save(`Relatorio_Maturidade_${data.identity.companyName || 'Empresa'}.pdf`);
  };

  const exportWord = () => {
    if (!result) return;
    const content = `
      <html>
        <head><meta charset="UTF-8"></head>
        <body style="font-family: Arial, sans-serif;">
          <h1 style="color: #1e3a8a;">Relatório de Maturidade Estratégica - ${data.identity.companyName}</h1>
          <p><b>Data do Relatório:</b> ${reportData.reportDate}</p>
          <p><b>Período da Pesquisa:</b> ${reportData.surveyPeriod || 'Não informado'}</p>
          <p><b>Score Geral:</b> ${result.scoreGeral.toFixed(1)}% (${result.level})</p>
          
          <h2 style="color: #1e3a8a; border-bottom: 1px solid #e2e8f0;">Médias por Dimensão</h2>
          <ul>
            ${result.dimensionScores.map(d => `<li><b>${d.name}:</b> ${(d.average/5*100).toFixed(1)}%</li>`).join('')}
          </ul>
          
          <h2 style="color: #1e3a8a; border-bottom: 1px solid #e2e8f0;">1. Diagnóstico Geral</h2>
          <p style="white-space: pre-wrap;">${reportData.diagnostico}</p>
          
          <h2 style="color: #1e3a8a; border-bottom: 1px solid #e2e8f0;">2. Análise Crítica das Dimensões</h2>
          <p style="white-space: pre-wrap;">${reportData.analiseDimensoes}</p>
          
          <h2 style="color: #1e3a8a; border-bottom: 1px solid #e2e8f0;">3. Recomendações Prioritárias</h2>
          <p style="white-space: pre-wrap;">${reportData.recomendacoes}</p>
          
          <h2 style="color: #1e3a8a; border-bottom: 1px solid #e2e8f0;">4. Alertas de Risco Estratégico</h2>
          <p style="white-space: pre-wrap;">${reportData.riscos}</p>
          
          <h2 style="color: #1e3a8a; border-bottom: 1px solid #e2e8f0;">5. Comentários Agregadores</h2>
          <p style="white-space: pre-wrap;">${reportData.comentariosFinais}</p>

          <hr style="margin-top: 50px; border: 0; border-top: 1px solid #ccc;"/>
          <p style="font-size: 10px; text-align: center; color: #94a3b8;">Gerado automaticamente pelo SISCONGE Strategic Performance em ${new Date().toLocaleDateString()}</p>
        </body>
      </html>
    `;
    const blob = new Blob(['\ufeff', content], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Relatorio_Maturidade_${data.identity.companyName}.doc`;
    link.click();
  };

  const renderRadarChart = () => {
    if (!result) return null;
    const size = 300;
    const center = size / 2;
    const radius = size * 0.4;
    const points = result.dimensionScores.map((d, i) => {
      const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
      const r = radius * (d.average / 5);
      const x = center + r * Math.cos(angle);
      const y = center + r * Math.sin(angle);
      return `${x},${y}`;
    }).join(' ');

    const webPoints = [0.2, 0.4, 0.6, 0.8, 1].map(scale => {
        return result.dimensionScores.map((_, i) => {
            const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
            const r = radius * scale;
            const x = center + r * Math.cos(angle);
            const y = center + r * Math.sin(angle);
            return `${x},${y}`;
        }).join(' ');
    });

    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mx-auto">
        {webPoints.map((p, i) => (
            <polygon key={i} points={p} fill="none" stroke="#e2e8f0" strokeWidth="1" />
        ))}
        {result.dimensionScores.map((_, i) => {
             const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
             const x2 = center + radius * Math.cos(angle);
             const y2 = center + radius * Math.sin(angle);
             return <line key={i} x1={center} y1={center} x2={x2} y2={y2} stroke="#e2e8f0" strokeWidth="1" />;
        })}
        <polygon points={points} fill="rgba(30, 58, 138, 0.2)" stroke="#1e3a8a" strokeWidth="2" />
        {result.dimensionScores.map((d, i) => {
            const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
            const x = center + (radius + 25) * Math.cos(angle);
            const y = center + (radius + 25) * Math.sin(angle);
            return (
                <text key={i} x={x} y={y} textAnchor="middle" className="text-[9px] fill-slate-500 font-black uppercase" style={{fontSize: '9px'}}>
                    {d.name.split(' ')[0]}
                </text>
            );
        })}
      </svg>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* SECTION 1: IMPORT */}
      <div className="bg-white p-6 rounded shadow border">
        <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg text-blue-900 flex items-center gap-2">
                <i className="ph ph-upload-simple"></i> 1. Importação da Pesquisa (Forms)
            </h3>
            {result && <Button variant="danger" size="sm" onClick={clearData}>Nova Pesquisa</Button>}
        </div>
        <div className="flex flex-col md:flex-row gap-6 items-center">
            <div 
              className="flex-1 border-2 border-dashed border-slate-200 p-8 rounded-lg text-center cursor-pointer hover:bg-slate-50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
                <input ref={fileInputRef} type="file" className="hidden" accept=".xlsx" onChange={handleFileUpload} />
                <i className="ph ph-microsoft-excel-logo text-4xl text-green-600 mb-2"></i>
                <p className="text-sm font-bold text-slate-700">Carregar Planilha do Google Forms (.xlsx)</p>
                <p className="text-xs text-slate-400 mt-1">Deve conter os prefixos D1_ a D5_ nas perguntas.</p>
            </div>
            {result && (
                <div className="bg-blue-50 p-4 rounded border border-blue-100 text-sm space-y-2 min-w-[250px]">
                    <div className="flex justify-between"><span>Respondentes:</span> <strong>{result.respondentsCount}</strong></div>
                    <div className="flex justify-between"><span>Score Geral:</span> <strong>{result.scoreGeral.toFixed(1)} / 100</strong></div>
                    <div className="flex justify-between"><span>Maturidade:</span> <strong className="text-blue-700 uppercase">{result.level}</strong></div>
                </div>
            )}
        </div>
      </div>

      {result && (
        <>
          <div className="bg-white p-6 rounded shadow border">
            <h3 className="font-bold text-lg text-blue-900 mb-4">2. Processamento e Enquadramento</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div className="space-y-3">
                    {result.dimensionScores.map(d => (
                        <div key={d.key}>
                            <div className="flex justify-between text-xs font-bold text-slate-600 mb-1 uppercase">
                                <span>{d.name}</span>
                                <span>{(d.average / 5 * 100).toFixed(1)}%</span>
                            </div>
                            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-600 transition-all" style={{width: `${(d.average/5*100)}%`}}></div>
                            </div>
                        </div>
                    ))}
                </div>
                <div>
                    {renderRadarChart()}
                </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded shadow border">
             <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-lg text-blue-900">3. Revisão Administrativa e Análise</h3>
                <Button onClick={handleGenerateAI} disabled={aiLoading} className="bg-purple-700">
                    {aiLoading ? "Consultando IA..." : "✨ Gerar Análise IA"}
                </Button>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Data de Emissão</label>
                    <input type="date" className="w-full p-2 border rounded text-sm" value={reportData.reportDate} onChange={e => setReportData({...reportData, reportDate: e.target.value})} />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Período Avaliado</label>
                    <input type="text" placeholder="Ex: Primeiro Semestre de 2025" className="w-full p-2 border rounded text-sm" value={reportData.surveyPeriod} onChange={e => setReportData({...reportData, surveyPeriod: e.target.value})} />
                </div>
             </div>

             <div className="space-y-6">
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Diagnóstico Geral</label>
                    <textarea className="w-full p-3 border rounded text-sm h-32 leading-relaxed" value={reportData.diagnostico} onChange={e => setReportData({...reportData, diagnostico: e.target.value})} />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Análise das Dimensões</label>
                    <textarea className="w-full p-3 border rounded text-sm h-32 leading-relaxed" value={reportData.analiseDimensoes} onChange={e => setReportData({...reportData, analiseDimensoes: e.target.value})} />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Recomendações Prioritárias</label>
                    <textarea className="w-full p-3 border rounded text-sm h-32 leading-relaxed" value={reportData.recomendacoes} onChange={e => setReportData({...reportData, recomendacoes: e.target.value})} />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider text-red-600">Alertas de Risco Estratégico</label>
                    <textarea className="w-full p-3 border border-red-100 rounded text-sm h-24 leading-relaxed bg-red-50/20" value={reportData.riscos} onChange={e => setReportData({...reportData, riscos: e.target.value})} />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Comentários Finais Agregadores</label>
                    <textarea className="w-full p-3 border rounded text-sm h-24 leading-relaxed" value={reportData.comentariosFinais} onChange={e => setReportData({...reportData, comentariosFinais: e.target.value})} />
                </div>
             </div>

             <div className="mt-8 flex flex-wrap items-center gap-4 p-4 bg-slate-50 rounded border">
                <div className="flex items-center gap-2">
                    <input type="checkbox" id="v_check" checked={reportData.validated} onChange={e => setReportData({...reportData, validated: e.target.checked})} />
                    <label htmlFor="v_check" className="text-sm font-bold text-slate-700 cursor-pointer">Confirmo a validação administrativa para emissão</label>
                </div>
                <div className="flex gap-2 ml-auto">
                    <Button disabled={!reportData.validated} onClick={exportWord} variant="secondary">
                        <i className="ph ph-file-doc"></i> Word Editável
                    </Button>
                    <Button disabled={!reportData.validated} onClick={exportPDF}>
                        <i className="ph ph-file-pdf"></i> PDF Oficial
                    </Button>
                </div>
             </div>
          </div>

          {/* HIDDEN PRINT VIEW */}
          <div style={{position: 'absolute', left: '-9999px'}}>
              <div ref={reportRef} className="bg-white p-16 w-[900px] text-slate-900 flex flex-col gap-8">
                  <div className="border-b-4 border-blue-900 pb-6 flex justify-between items-end">
                      <div>
                        <h1 className="text-3xl font-black uppercase text-blue-900">Relatório de Maturidade Estratégica</h1>
                        <p className="text-lg text-slate-500 font-bold">{data.identity.companyName}</p>
                        <p className="text-xs text-slate-400 mt-2 uppercase tracking-widest font-medium">Avaliação: {reportData.surveyPeriod || 'Ciclo Vigente'} | Emissão: {reportData.reportDate}</p>
                      </div>
                      <div className="text-right">
                          <div className="text-5xl font-black text-blue-900">{result.scoreGeral.toFixed(0)}</div>
                          <div className="text-xs font-black text-slate-400 uppercase tracking-tighter">Score Geral (0-100)</div>
                      </div>
                  </div>

                  <div className="grid grid-cols-2 gap-12 items-center border-b pb-8">
                      <div className="space-y-6">
                          <h4 className="font-black text-xl uppercase text-slate-800">Nível: <span className="text-blue-700">{result.level}</span></h4>
                          <div className="space-y-4">
                              {result.dimensionScores.map(d => (
                                  <div key={d.key}>
                                      <div className="flex justify-between text-xs font-bold uppercase mb-1"><span>{d.name}</span><span>{(d.average/5*100).toFixed(1)}%</span></div>
                                      <div className="w-full h-3 bg-slate-100 rounded-full"><div className="h-full bg-blue-600 rounded-full" style={{width: `${(d.average/5*100)}%`}}></div></div>
                                  </div>
                              ))}
                          </div>
                      </div>
                      <div className="flex items-center justify-center p-4 bg-slate-50 rounded-2xl">
                          {renderRadarChart()}
                      </div>
                  </div>

                  <div className="space-y-10 text-sm leading-relaxed">
                      <div className="bg-slate-50 p-6 rounded-xl border border-slate-100">
                        <h5 className="font-black uppercase text-blue-900 mb-3 tracking-widest border-l-4 border-blue-900 pl-4">1. Diagnóstico Geral Interpretativo</h5>
                        <p className="text-slate-700">{reportData.diagnostico}</p>
                      </div>
                      <div className="px-4">
                        <h5 className="font-black uppercase text-blue-900 mb-3 tracking-widest border-l-4 border-blue-900 pl-4">2. Análise Crítica por Dimensão</h5>
                        <p className="whitespace-pre-wrap text-slate-700">{reportData.analiseDimensoes}</p>
                      </div>
                      <div className="bg-blue-50/40 p-6 border border-blue-100 rounded-xl">
                        <h5 className="font-black uppercase text-blue-900 mb-3 tracking-widest border-l-4 border-blue-900 pl-4">3. Plano de Evolução e Recomendações</h5>
                        <p className="whitespace-pre-wrap text-slate-700 font-medium">{reportData.recomendacoes}</p>
                      </div>
                      <div className="bg-red-50/40 p-6 border border-red-100 rounded-xl">
                        <h5 className="font-black uppercase text-red-700 mb-3 tracking-widest border-l-4 border-red-600 pl-4">4. Alertas de Risco Estratégico</h5>
                        <p className="whitespace-pre-wrap text-red-900">{reportData.riscos}</p>
                      </div>
                      <div className="p-6 rounded-xl border border-slate-200">
                        <h5 className="font-black uppercase text-slate-700 mb-3 tracking-widest border-l-4 border-slate-400 pl-4">5. Comentários Agregadores</h5>
                        <p className="whitespace-pre-wrap text-slate-600 italic">{reportData.comentariosFinais}</p>
                      </div>
                      <div className="pt-12 text-center text-[10px] text-slate-400 border-t uppercase font-bold tracking-widest">
                          Documento Gerado Eletronicamente via SISCONGE Strategic Performance • Validado Administrativamente
                      </div>
                  </div>
              </div>
          </div>
        </>
      )}
    </div>
  );
};
