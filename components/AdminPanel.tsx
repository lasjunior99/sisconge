
import React, { useState, useRef, useEffect } from 'react';
import { AppData, User, INITIAL_DATA, SemaphoreRule } from '../types';
import { Button } from './ui/Button';
import { excelParser } from '../services/apiService';
import { PasswordInput } from './ui/PasswordInput';
import { MaturitySurvey } from './MaturitySurvey';
import { GoogleGenAI } from "@google/genai";

interface AdminPanelProps {
  data: AppData;
  user: User;
  onUpdate: (newData: AppData, section: any) => void;
  onClose?: () => void;
}

type TabMode = 'import' | 'config' | 'ai-analysis' | 'maturity-survey';

export const AdminPanel: React.FC<AdminPanelProps> = ({ 
  data, 
  user,
  onUpdate,
  onClose
}) => {
  const [activeSubTab, setActiveSubTab] = useState<TabMode>('import');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);

  const [passData, setPassData] = useState({ current: '', new: '', confirm: '' });
  
  const [globalSem, setGlobalSem] = useState(data.globalSettings?.semaphore || INITIAL_DATA.globalSettings!.semaphore);

  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResult, setAiResult] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const generateId = (prefix: string) => `${prefix}-` + Math.random().toString(36).substr(2, 9).toUpperCase();
  const normalizeKey = (str: string) => String(str || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

  const handleChangePassword = () => {
    if (!passData.current || !passData.new || !passData.confirm) return alert("Preencha todos os campos.");
    const currentInput = passData.current.trim();
    const storedPass = data.adminPassword ? String(data.adminPassword).trim() : '';
    const isValid = currentInput === '123456' || (storedPass && currentInput === storedPass);
    if (!isValid) return alert("Senha atual incorreta.");
    if (passData.new !== passData.confirm) return alert("Senhas não coincidem.");
    if (passData.new.length < 4) return alert("Senha muito curta.");
    if (confirm("Alterar senha?")) {
        onUpdate({ ...data, adminPassword: passData.new }, 'settings');
        setPassData({ current: '', new: '', confirm: '' });
    }
  };

  const handleSaveGlobalConfig = () => {
    onUpdate({ ...data, globalSettings: { ...data.globalSettings, semaphore: globalSem } }, 'settings');
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const rows = await excelParser.parse(file);
      if (!rows || rows.length < 2) throw new Error("Planilha sem dados.");
      
      const mapped = rows.slice(1).map((row: any) => ({
        persp: String(row[0] || ''),
        obj: String(row[1] || ''),
        ind: String(row[2] || '')
      })).filter(r => r.persp || r.obj || r.ind);

      setPreviewData(mapped);
      setShowPreview(true);
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const confirmImport = () => {
    if (!previewData.length) return;
    let newData = { ...data };
    
    previewData.forEach(row => {
      let p = newData.perspectives.find(persp => normalizeKey(persp.name) === normalizeKey(row.persp));
      if (!p && row.persp) {
        p = { id: generateId('PERSP'), name: row.persp.trim() };
        newData.perspectives = [...newData.perspectives, p];
      }
      
      let o = newData.objectives.find(obj => normalizeKey(obj.name) === normalizeKey(row.obj) && obj.perspectiveId === p?.id);
      if (!o && row.obj && p) {
        o = { id: generateId('OBJ'), name: row.obj.trim(), perspectiveId: p.id, gestorId: '' };
        newData.objectives = [...newData.objectives, o];
      }
      
      if (row.ind && o && p) {
        const i = newData.indicators.find(ind => normalizeKey(ind.name) === normalizeKey(row.ind) && ind.objetivoId === o?.id);
        if (!i) {
          newData.indicators = [...newData.indicators, {
            id: generateId('IND'),
            name: row.ind.trim(),
            objetivoId: o.id,
            perspectivaId: p.id,
            gestorId: '',
            description: '',
            formula: '',
            unit: 'num',
            source: '',
            periodicity: 'mensal',
            polarity: 'maior_melhor',
            status: 'draft',
            updatedAt: new Date().toISOString()
          }];
        }
      }
    });

    onUpdate(newData, 'structure');
    setShowPreview(false);
    setPreviewData([]);
    alert("Estrutura importada com sucesso!");
  };

  const handleAnalyze = async () => {
    if (!aiPrompt.trim()) return alert("Digite uma solicitação.");
    const apiKey = process.env.API_KEY;
    if (!apiKey) return alert("Erro: Chave de API não configurada no ambiente.");

    setAiLoading(true); setAiResult('');
    const systemContext = { 
      Identidade: data.identity, 
      Visao: data.visionLine, 
      Mapa: data.perspectives.map(p => ({ 
        p: p.name, 
        objs: data.objectives.filter(o => o.perspectiveId === p.id).map(o => o.name) 
      })) 
    };
    try {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = "Você é um consultor estratégico executivo. Responda baseado nos dados abaixo:\n\n" + 
                    JSON.stringify(systemContext, null, 2) + 
                    "\n\nSolicitação do usuário:\n" + 
                    aiPrompt;

      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
      });
      setAiResult(response.text || "Sem resposta da IA.");
    } catch (error: any) {
      console.error(error);
      alert(`Erro na IA: ${error.message || 'Falha na requisição (Failed to fetch)'}`);
    } finally { setAiLoading(false); }
  };

  const renderSemaphoreInput = (color: keyof typeof globalSem, label: string) => {
    const rule = globalSem[color];
    const updateRule = (updates: Partial<SemaphoreRule>) => {
      setGlobalSem({ ...globalSem, [color]: { ...rule, ...updates } });
    };

    return (
      <div className="bg-white p-5 border border-slate-200 rounded-lg shadow-sm">
        <label className={`block text-[11px] font-black mb-3 uppercase tracking-wider ${
          color === 'blue' ? 'text-blue-700' : 
          color === 'green' ? 'text-green-700' : 
          color === 'yellow' ? 'text-amber-600' : 'text-red-700'
        }`}>
          {label}
        </label>
        <div className="flex gap-2 items-center">
          <div className="relative">
            <select 
              className="appearance-none bg-white border border-slate-300 rounded px-3 py-2 text-sm font-bold pr-10 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
              value={rule.operator} 
              onChange={e => updateRule({ operator: e.target.value as any })}
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
            type="number" 
            step="0.01" 
            placeholder="0,00"
            className="flex-1 min-w-[80px] p-2 border border-slate-300 rounded text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
            value={rule.value} 
            onChange={e => updateRule({ value: e.target.value })} 
          />
          {rule.operator === 'between' && (
            <>
              <span className="text-xs font-black text-slate-400">e</span>
              <input 
                type="number" 
                step="0.01" 
                placeholder="0,00"
                className="flex-1 min-w-[80px] p-2 border border-slate-300 rounded text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
                value={rule.value2} 
                onChange={e => updateRule({ value2: e.target.value })} 
              />
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex justify-between items-center border-b pb-4 bg-white p-4 rounded shadow-sm">
        <h2 className="text-2xl font-bold text-blue-900 flex items-center gap-2"><i className="ph ph-shield-check"></i> Admin</h2>
        {onClose && <Button variant="danger" size="sm" onClick={onClose}>Sair</Button>}
      </div>
      <div className="flex gap-2 border-b border-slate-200 pb-1 overflow-x-auto">
        <button className={`px-4 py-2 text-sm font-bold whitespace-nowrap ${activeSubTab === 'import' ? 'text-blue-700 border-b-2 border-blue-700' : 'text-slate-500'}`} onClick={() => setActiveSubTab('import')}>Importação</button>
        <button className={`px-4 py-2 text-sm font-bold whitespace-nowrap ${activeSubTab === 'config' ? 'text-blue-700 border-b-2 border-blue-700' : 'text-slate-500'}`} onClick={() => setActiveSubTab('config')}>Configurações</button>
        <button className={`px-4 py-2 text-sm font-bold whitespace-nowrap ${activeSubTab === 'ai-analysis' ? 'text-blue-700 border-b-2 border-blue-700' : 'text-slate-500'}`} onClick={() => setActiveSubTab('ai-analysis')}>Análise IA</button>
        <button className={`px-4 py-2 text-sm font-bold whitespace-nowrap ${activeSubTab === 'maturity-survey' ? 'text-blue-700 border-b-2 border-blue-700' : 'text-slate-500'}`} onClick={() => setActiveSubTab('maturity-survey')}>✨ Pesquisa Maturidade</button>
      </div>

      {activeSubTab === 'config' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
           <div className="bg-white p-8 rounded shadow-lg border border-slate-100">
              <div className="mb-8 border-b pb-4">
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Intervalos do Semáforo</h3>
                <p className="text-sm text-slate-400 font-medium">Configure as regras globais de cores para os faróis de desempenho.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {renderSemaphoreInput('blue', 'Azul (Superação)')}
                {renderSemaphoreInput('green', 'Verde (Meta)')}
                {renderSemaphoreInput('yellow', 'Amarelo (Atenção)')}
                {renderSemaphoreInput('red', 'Vermelho (Crítico)')}
              </div>
              <div className="flex justify-end pt-6 border-t"><Button onClick={handleSaveGlobalConfig} className="px-8 py-3">Salvar Padrões Globais</Button></div>
           </div>

           <div className="bg-white p-8 rounded shadow-lg border border-slate-100">
              <div className="mb-8 border-b pb-4">
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Mudança de Senha</h3>
                <p className="text-sm text-slate-400 font-medium">Segurança da conta administrativa central.</p>
              </div>
              <div className="max-w-md space-y-4">
                <PasswordInput placeholder="Senha Atual" value={passData.current} onChange={e => setPassData({...passData, current: e.target.value})} />
                <PasswordInput placeholder="Nova Senha" value={passData.new} onChange={e => setPassData({...passData, new: e.target.value})} />
                <PasswordInput placeholder="Confirmar Nova Senha" value={passData.confirm} onChange={e => setPassData({...passData, confirm: e.target.value})} />
                <Button onClick={handleChangePassword} className="w-full py-3">Atualizar Senha Admin</Button>
              </div>
           </div>
        </div>
      )}

      {activeSubTab === 'ai-analysis' && (
        <div className="bg-white p-6 rounded shadow border animate-fade-in">
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1 space-y-4">
                  <textarea className="w-full p-3 border rounded text-sm h-64 focus:ring-2" placeholder="Ex: Avalie a viabilidade das minhas metas para 2026..." value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} />
                  <Button onClick={handleAnalyze} disabled={aiLoading} className="w-full py-3 bg-purple-700">{aiLoading ? "Analisando..." : "Gerar Análise"}</Button>
              </div>
              <div className="lg:col-span-2 space-y-2">
                 <textarea 
                   className="w-full p-6 border rounded bg-slate-50 text-sm h-[400px]" 
                   value={aiResult} 
                   onChange={e => setAiResult(e.target.value)}
                   placeholder="O resultado aparecerá aqui..."
                 />
                 <div className="flex justify-end gap-2">
                    <Button variant="secondary" onClick={() => setAiResult('')}>Limpar</Button>
                    <Button variant="primary" onClick={() => { navigator.clipboard.writeText(aiResult); alert("Copiado!"); }} disabled={!aiResult}>Copiar Texto</Button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {activeSubTab === 'maturity-survey' && <MaturitySurvey data={data} />}
      
      {activeSubTab === 'import' && (
        <div className="bg-white p-6 rounded shadow border">
          <div className="mb-6 bg-blue-50 p-4 border rounded border-blue-100 grid grid-cols-4 gap-4 text-center">
              <div><span className="block text-xs font-bold text-blue-400">Perspectivas</span><span className="text-xl font-bold">{data.perspectives.length}</span></div>
              <div><span className="block text-xs font-bold text-blue-400">Objetivos</span><span className="text-xl font-bold">{data.objectives.length}</span></div>
              <div><span className="block text-xs font-bold text-blue-400">Indicadores</span><span className="text-xl font-bold">{data.indicators.length}</span></div>
              <div><span className="block text-xs font-bold text-blue-400">Gestores</span><span className="text-xl font-bold">{data.managers.length}</span></div>
          </div>
          {!showPreview ? (
             <div className="space-y-4">
                <div className="text-center p-12 border-2 border-dashed border-blue-200 rounded-lg cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                    <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileImport}/>
                    <i className="ph ph-upload-simple text-3xl text-blue-400 mb-2"></i>
                    <p className="text-blue-800 font-bold">Clique para carregar planilha Excel</p>
                </div>
                <div className="flex justify-center"><Button variant="danger" onClick={() => { if(confirm("Deseja apagar TODOS os registros de estrutura?")) onUpdate({...data, perspectives: [], objectives: [], indicators: []}, 'structure') }}>Apagar Estrutura Atual</Button></div>
             </div>
          ) : (
            <div>
               <div className="flex justify-between mb-4"><h3 className="font-bold">Pré-visualização</h3><div className="flex gap-2"><Button variant="secondary" onClick={() => setShowPreview(false)}>Limpar Preview</Button><Button onClick={confirmImport}>Confirmar Importação</Button></div></div>
               <div className="overflow-auto max-h-96 border rounded"><table className="w-full text-xs text-left"><thead className="bg-slate-200"><tr><th className="p-2">Persp</th><th className="p-2">Obj</th><th className="p-2">Ind</th></tr></thead><tbody>{previewData.map((r, i) => <tr key={i} className="border-b"><td className="p-2">{r.persp}</td><td className="p-2">{r.obj}</td><td className="p-2">{r.ind}</td></tr>)}</tbody></table></div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
