import React, { useState, useRef, useEffect } from 'react';
import { AppData } from '../types';
import { Button } from './ui/Button';
import { excelParser } from '../services/apiService';

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
    validated: false
  });
  
  const reportRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Persistence in local session
  useEffect(() => {
    const saved = localStorage.getItem('sisconge_maturity_survey');
    if (saved) {
      const parsed = JSON.parse(saved);
      setResult(parsed.result);
      setReportData(parsed.reportData);
    }
  }, []);

  const saveToLocal = (res: MaturityResult, report: any) => {
    localStorage.setItem('sisconge_maturity_survey', JSON.stringify({ result: res, reportData: report }));
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
      let questionCount = 0;

      // Identify relevant columns
      const dimColumns = header.map((h, idx) => {
        const found = DIMENSIONS.find(d => h.toUpperCase().startsWith(d.prefix));
        if (found) {
            questionCount++;
            return { idx, prefix: found.prefix };
        }
        return null;
      }).filter(c => c !== null);

      const commentIdx = header.findIndex(h => h.toLowerCase().includes('comentário') || h.toLowerCase().includes('percepção'));

      dataRows.forEach((row: any[]) => {
        dimColumns.forEach(col => {
          const val = parseFloat(String(row[col!.idx] || ''));
          if (!isNaN(val) && val >= 1 && val <= 5) {
            scoresByDim[col!.prefix].push(val);
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
        questionCount: questionCount / dataRows.length, // approximation of questions per form
        dimensionScores,
        scoreGeral: scoreFinal,
        level,
        comments
      };

      setResult(newResult);
      setReportData({ ...reportData, validated: false });
      saveToLocal(newResult, { ...reportData, validated: false });
      
    } catch (err: any) {
      alert(`Erro na importação: ${err.message}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleGenerateAI = async () => {
    if (!result || !import.meta.env.VITE_GEMINI_API_KEY) return alert("Dados ou API Key ausentes.");
    setAiLoading(true);
    
    const prompt = `Você é um especialista em estratégia corporativa. Analise os resultados desta pesquisa de maturidade estratégica (escala 0-100):
      Score Geral: ${result.scoreGeral.toFixed(1)} (${result.level})
      Scores por Dimensão: ${result.dimensionScores.map(d => `${d.name}: ${(d.average/5*100).toFixed(1)}`).join(', ')}
      Comentários dos respondentes: ${result.comments.slice(0, 10).join(' | ')}

      Gere uma análise executiva estruturada exatamente nestes 5 blocos, separando-os por [BREAK]:
      1. Diagnóstico Geral Interpretativo.
      2. Análise Crítica por Dimensão (foco em pontos fortes e fracos).
      3. Recomendações Prioritárias para evolução.
      4. Alertas de Risco Estratégico.
      5. Comentários Agregadores finais.`;

try {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${import.meta.env.VITE_GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }]
          }
        ]
      })
    }
  );

  const data = await response.json();

  const text =
    data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

  const parts = text.split('[BREAK]');

  const updatedReport = {
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
    pdf.addImage(imgData, 'PNG', 0, 0, w, h);
    pdf.save(`Relatorio_Maturidade_${data.identity.companyName || 'Empresa'}.pdf`);
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
            const x = center + (radius + 20) * Math.cos(angle);
            const y = center + (radius + 20) * Math.sin(angle);
            return (
                <text key={i} x={x} y={y} textAnchor="middle" className="text-[10px] fill-slate-500 font-bold" style={{fontSize: '8px'}}>
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
        <h3 className="font-bold text-lg text-blue-900 mb-4 flex items-center gap-2">
            <i className="ph ph-upload-simple"></i> 1. Importação da Pesquisa (Forms)
        </h3>
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
                    <div className="flex justify-between"><span>Maturidade:</span> <strong className="text-blue-700">{result.level}</strong></div>
                </div>
            )}
        </div>
      </div>

      {/* SECTION 2 & 3: PROCESSING & AI */}
      {result && (
        <>
          <div className="bg-white p-6 rounded shadow border">
            <h3 className="font-bold text-lg text-blue-900 mb-4">2. Processamento e Enquadramento</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div className="space-y-3">
                    {result.dimensionScores.map(d => (
                        <div key={d.key}>
                            <div className="flex justify-between text-xs font-bold text-slate-600 mb-1">
                                <span>{d.name}</span>
                                <span>{(d.average / 5 * 100).toFixed(0)}%</span>
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
             <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg text-blue-900">3. Revisão e Análise Qualitativa</h3>
                <Button onClick={handleGenerateAI} disabled={aiLoading} className="bg-purple-700">
                    {aiLoading ? "Consultando IA..." : "✨ Gerar Análise IA"}
                </Button>
             </div>
             <div className="space-y-4">
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Diagnóstico Geral</label>
                    <textarea className="w-full p-3 border rounded text-sm h-32" value={reportData.diagnostico} onChange={e => setReportData({...reportData, diagnostico: e.target.value})} />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Análise Crítica por Dimensão</label>
                    <textarea className="w-full p-3 border rounded text-sm h-32" value={reportData.analiseDimensoes} onChange={e => setReportData({...reportData, analiseDimensoes: e.target.value})} />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Recomendações Prioritárias</label>
                    <textarea className="w-full p-3 border rounded text-sm h-32" value={reportData.recomendacoes} onChange={e => setReportData({...reportData, recomendacoes: e.target.value})} />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Alertas de Risco</label>
                    <textarea className="w-full p-3 border rounded text-sm h-24" value={reportData.riscos} onChange={e => setReportData({...reportData, riscos: e.target.value})} />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Comentários Agregadores</label>
                    <textarea className="w-full p-3 border rounded text-sm h-24" value={reportData.comentariosFinais} onChange={e => setReportData({...reportData, comentariosFinais: e.target.value})} />
                </div>
             </div>

             <div className="mt-6 flex items-center gap-3 p-4 bg-slate-50 rounded border">
                <input type="checkbox" id="v_check" checked={reportData.validated} onChange={e => setReportData({...reportData, validated: e.target.checked})} />
                <label htmlFor="v_check" className="text-sm font-bold text-slate-700 cursor-pointer">Confirmo a validação das informações para emissão do relatório</label>
                <Button disabled={!reportData.validated} className="ml-auto" onClick={exportPDF}>
                    <i className="ph ph-file-pdf"></i> Gerar Relatório PDF
                </Button>
             </div>
          </div>

          {/* HIDDEN PRINT VIEW */}
          <div style={{position: 'absolute', left: '-9999px'}}>
              <div ref={reportRef} className="bg-white p-12 w-[800px] text-slate-900">
                  <div className="border-b-4 border-blue-900 pb-4 mb-8 flex justify-between items-end">
                      <div>
                        <h1 className="text-2xl font-black uppercase text-blue-900">Relatório de Maturidade Estratégica</h1>
                        <p className="text-sm text-slate-500">{data.identity.companyName}</p>
                      </div>
                      <div className="text-right">
                          <div className="text-[40px] font-black text-blue-900">{result.scoreGeral.toFixed(0)}</div>
                          <div className="text-xs font-bold text-slate-400 uppercase">Score Geral</div>
                      </div>
                  </div>

                  <div className="grid grid-cols-2 gap-8 mb-8">
                      <div>
                          <h4 className="font-bold text-lg border-b mb-3">Nível: {result.level}</h4>
                          <div className="space-y-4">
                              {result.dimensionScores.map(d => (
                                  <div key={d.key}>
                                      <div className="flex justify-between text-xs font-bold"><span>{d.name}</span><span>{(d.average/5*100).toFixed(0)}%</span></div>
                                      <div className="w-full h-2 bg-slate-100 rounded-full mt-1"><div className="h-full bg-blue-600" style={{width: `${(d.average/5*100)}%`}}></div></div>
                                  </div>
                              ))}
                          </div>
                      </div>
                      <div className="flex items-center justify-center">
                          {renderRadarChart()}
                      </div>
                  </div>

                  <div className="space-y-6 text-sm leading-relaxed">
                      <div className="bg-slate-50 p-4 rounded">
                        <h5 className="font-bold uppercase text-blue-900 mb-2">Diagnóstico Geral</h5>
                        <p>{reportData.diagnostico}</p>
                      </div>
                      <div>
                        <h5 className="font-bold uppercase text-blue-900 mb-2">Análise das Dimensões</h5>
                        <p className="whitespace-pre-wrap">{reportData.analiseDimensoes}</p>
                      </div>
                      <div className="bg-blue-50 p-4 border border-blue-100 rounded">
                        <h5 className="font-bold uppercase text-blue-900 mb-2">Recomendações Prioritárias</h5>
                        <p className="whitespace-pre-wrap">{reportData.recomendacoes}</p>
                      </div>
                      <div className="bg-red-50 p-4 border border-red-100 rounded text-red-900">
                        <h5 className="font-bold uppercase text-red-900 mb-2">Alertas de Risco</h5>
                        <p className="whitespace-pre-wrap">{reportData.riscos}</p>
                      </div>
                      <div className="pt-8 text-center text-[10px] text-slate-400 border-t">
                          Relatório validado em {new Date().toLocaleDateString()} • SISCONGE Strategic Performance
                      </div>
                  </div>
              </div>
          </div>
        </>
      )}
    </div>
  );
};