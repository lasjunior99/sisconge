import React, { useState, useRef, useEffect } from 'react';
import { AppData, User, Indicator, Objective, Perspective, Manager, INITIAL_DATA } from '../types';
import { Button } from './ui/Button';
import { excelParser } from '../services/apiService';
import { PasswordInput } from './ui/PasswordInput';
import { GoogleGenAI } from "@google/genai";

interface AdminPanelProps {
  data: AppData;
  user: User;
  onUpdate: (newData: AppData, section: any) => void;
  onClose?: () => void;
}

type TabMode = 'structure' | 'import' | 'security' | 'config' | 'ai-analysis';

export const AdminPanel: React.FC<AdminPanelProps> = ({ 
  data, 
  user,
  onUpdate,
  onClose
}) => {
  // --- Tab State ---
  const [activeSubTab, setActiveSubTab] = useState<TabMode>('structure');
  
  // --- Import State ---
  const [importReport, setImportReport] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Preview State ---
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);

  // --- CRUD States for Structure ---
  const [newPerspName, setNewPerspName] = useState('');
  const [newManagerName, setNewManagerName] = useState('');
  
  const [newObjName, setNewObjName] = useState('');
  const [selectedPerspForObj, setSelectedPerspForObj] = useState('');

  // States for Manual Indicator Creation
  const [newIndName, setNewIndName] = useState('');
  const [indPerspFilter, setIndPerspFilter] = useState('');
  const [indObjFilter, setIndObjFilter] = useState('');
  const [indManager, setIndManager] = useState('');

  // --- Security State ---
  const [passData, setPassData] = useState({ current: '', new: '', confirm: '' });

  // --- Global Config State ---
  const [globalSem, setGlobalSem] = useState({ blue: '', green: '', yellow: '', red: '' });

  // --- AI Analysis State ---
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResult, setAiResult] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    if (data.globalSettings && data.globalSettings.semaphore) {
      setGlobalSem(data.globalSettings.semaphore);
    } else {
      setGlobalSem(INITIAL_DATA.globalSettings?.semaphore || { blue: '', green: '', yellow: '', red: '' });
    }
  }, [data.globalSettings]);

  const generateId = (prefix: string) => `${prefix}-` + Math.random().toString(36).substr(2, 9).toUpperCase();
  const normalizeKey = (str: string) => String(str || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

  // --- GENERIC CRUD HANDLERS ---
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

  const addPerspective = () => {
    if (!newPerspName.trim()) return;
    onUpdate({ ...data, perspectives: [...data.perspectives, { id: generateId('PERSP'), name: newPerspName.trim() }] }, 'structure');
    setNewPerspName('');
  };

  const addManager = () => {
    if (!newManagerName.trim()) return;
    onUpdate({ ...data, managers: [...data.managers, { id: generateId('MGR'), name: newManagerName.trim() }] }, 'structure');
    setNewManagerName('');
  };

  const addObjective = () => {
    if (!newObjName.trim() || !selectedPerspForObj) return;
    onUpdate({ ...data, objectives: [...data.objectives, { id: generateId('OBJ'), name: newObjName.trim(), perspectiveId: selectedPerspForObj, gestorId: '' }] }, 'structure');
    setNewObjName('');
  };

  const addIndicator = () => {
    if (!newIndName.trim() || !indObjFilter) {
       alert("Selecione um Objetivo e digite o nome do Indicador.");
       return;
    }

    const obj = data.objectives.find(o => o.id === indObjFilter);
    if (!obj) return;

    const newInd: Indicator = {
        id: generateId('IND'),
        name: newIndName.trim(),
        objetivoId: obj.id,
        perspectivaId: obj.perspectiveId, // Garante o vínculo correto para filtros
        gestorId: indManager,
        description: '',
        formula: '',
        unit: 'num',
        source: '',
        periodicity: 'mensal',
        polarity: 'maior_melhor',
        status: 'draft',
        updatedAt: new Date().toISOString()
    };

    onUpdate({ ...data, indicators: [...data.indicators, newInd] }, 'structure');
    setNewIndName('');
  };

  // --- PASSWORD CHANGE LOGIC ---
  const handleChangePassword = () => {
    if (!passData.current || !passData.new || !passData.confirm) {
        alert("Preencha todos os campos.");
        return;
    }
    
    // TRATAMENTO ROBUSTO DE SENHA
    const currentInput = passData.current.trim();
    const storedPass = data.adminPassword ? String(data.adminPassword).trim() : '';
    
    // Aceita se for a senha salva OU a senha mestra '123456'
    const isValid = currentInput === '123456' || (storedPass && currentInput === storedPass);
    
    if (!isValid) {
        alert("A senha atual está incorreta.");
        return;
    }

    if (passData.new !== passData.confirm) {
        alert("A nova senha e a confirmação não coincidem.");
        return;
    }

    if (passData.new.length < 4) {
        alert("A senha deve ter pelo menos 4 caracteres.");
        return;
    }

    if (confirm("Deseja realmente alterar a senha de administrador?")) {
        onUpdate({ ...data, adminPassword: passData.new }, 'settings');
        setPassData({ current: '', new: '', confirm: '' });
        alert("Senha alterada com sucesso!");
    }
  };

  // --- GLOBAL CONFIG SAVE ---
  const handleSaveGlobalConfig = () => {
    onUpdate({
      ...data,
      globalSettings: {
        ...data.globalSettings,
        semaphore: globalSem
      }
    }, 'settings');
  };

  // --- IMPORT LOGIC ---
  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportReport(null);
    setPreviewData([]);
    setShowPreview(false);

    try {
      const rawRows = await excelParser.parse(file);
      analyzeImportFile(rawRows);
    } catch (err: any) {
      console.error(err);
      alert(`Erro ao ler arquivo: ${err.message || 'Formato inválido'}.`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const analyzeImportFile = (rows: any[]) => {
    if (!rows || rows.length === 0) return alert("Arquivo vazio.");

    // 1. Find Header
    let headerRowIndex = -1;
    let colIndices = { persp: -1, obj: -1, ind: -1, mgr: -1 };
    const synonyms = {
      persp: ['perspectiva', 'perspective', 'dimensao'],
      obj: ['objetivo', 'objective', 'estrategia'],
      ind: ['indicador', 'indicator', 'nome', 'kpi'],
      mgr: ['gestor', 'manager', 'responsavel']
    };

    const findIndex = (row: any[], keys: string[]) => row.findIndex(c => c && keys.includes(normalizeKey(c)));

    for (let i = 0; i < Math.min(rows.length, 25); i++) {
      const row = rows[i];
      if (!Array.isArray(row)) continue;
      const normRow = row.map(c => normalizeKey(c));
      
      const idxInd = findIndex(normRow, synonyms.ind);
      if (idxInd !== -1) {
        const idxPersp = findIndex(normRow, synonyms.persp);
        const idxObj = findIndex(normRow, synonyms.obj);
        
        // At least Indicator + (Perspective OR Objective)
        if (idxPersp !== -1 || idxObj !== -1) {
          headerRowIndex = i;
          colIndices = { persp: idxPersp, obj: idxObj, ind: idxInd, mgr: findIndex(normRow, synonyms.mgr) };
          break;
        }
      }
    }

    if (headerRowIndex === -1) {
      alert("❌ Cabeçalho não encontrado.\nO sistema procura por: 'Perspectiva', 'Objetivo' e 'Indicador'.");
      return;
    }

    // 2. Extract Data with Fill-Down
    const extractedData = [];
    let lastPersp = '';
    let lastObj = '';

    for (let i = headerRowIndex + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!Array.isArray(row)) continue;

      const rawInd = row[colIndices.ind] ? String(row[colIndices.ind]).trim() : '';
      if (!rawInd) continue;

      const rawPersp = (colIndices.persp !== -1 && row[colIndices.persp]) ? String(row[colIndices.persp]).trim() : '';
      if (rawPersp) lastPersp = rawPersp;

      const rawObj = (colIndices.obj !== -1 && row[colIndices.obj]) ? String(row[colIndices.obj]).trim() : '';
      if (rawObj) lastObj = rawObj;

      // Ensure we have context
      if (!lastPersp && !lastObj) continue; 

      extractedData.push({
        persp: lastPersp || 'Geral',
        obj: lastObj || 'Geral',
        ind: rawInd,
        mgr: (colIndices.mgr !== -1 && row[colIndices.mgr]) ? String(row[colIndices.mgr]).trim() : ''
      });
    }

    if (extractedData.length === 0) {
      alert("Nenhum indicador válido encontrado nas linhas abaixo do cabeçalho.");
      return;
    }

    setPreviewData(extractedData);
    setShowPreview(true);
  };

  const confirmImport = () => {
    try {
      let newPerspectives = [...data.perspectives];
      let newObjectives = [...data.objectives];
      let newManagers = [...data.managers];
      let newIndicators = [...data.indicators];
      let count = 0;

      previewData.forEach(row => {
        // 1. Perspective
        let p = newPerspectives.find(x => normalizeKey(x.name) === normalizeKey(row.persp));
        if (!p) { p = { id: generateId('PERSP'), name: row.persp }; newPerspectives.push(p); }

        // 2. Manager
        let mId = '';
        if (row.mgr) {
          let m = newManagers.find(x => normalizeKey(x.name) === normalizeKey(row.mgr));
          if (!m) { m = { id: generateId('MGR'), name: row.mgr }; newManagers.push(m); }
          mId = m.id;
        }

        // 3. Objective
        let o = newObjectives.find(x => normalizeKey(x.name) === normalizeKey(row.obj) && x.perspectiveId === p!.id);
        if (!o) { o = { id: generateId('OBJ'), name: row.obj, perspectiveId: p!.id, gestorId: mId }; newObjectives.push(o); }

        // 4. Indicator
        const exists = newIndicators.some(x => normalizeKey(x.name) === normalizeKey(row.ind) && x.objetivoId === o!.id);
        if (!exists) {
          newIndicators.push({
            id: generateId('IND'), name: row.ind, perspectivaId: p!.id, objetivoId: o!.id, gestorId: mId,
            description: '', formula: '', unit: '', source: '', periodicity: '', polarity: '', status: 'draft', updatedAt: new Date().toISOString()
          });
          count++;
        }
      });

      onUpdate({ ...data, perspectives: newPerspectives, managers: newManagers, objectives: newObjectives, indicators: newIndicators }, 'structure');
      
      setImportReport(`✅ Importação Concluída: ${count} novos indicadores adicionados.`);
      setShowPreview(false);
      setPreviewData([]);

    } catch (e: any) {
      alert(`Erro ao salvar dados: ${e.message}`);
    }
  };

  const cancelImport = () => {
    setShowPreview(false);
    setPreviewData([]);
    setImportReport(null);
  };

  const handleExportData = () => {
    const XLSX = window.XLSX;
    if (!XLSX) return alert("Erro: Biblioteca Excel não carregada.");
    const rows = data.indicators.map(ind => ({
        'Perspectiva': data.perspectives.find(p => p.id === ind.perspectivaId)?.name || '',
        'Objetivo': data.objectives.find(o => o.id === ind.objetivoId)?.name || '',
        'Indicador': ind.name,
        'Gestor': data.managers.find(m => m.id === ind.gestorId)?.name || ''
    }));
    if (rows.length === 0) return alert("Não há dados para exportar.");
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Dados_Estrutura");
    XLSX.writeFile(wb, "Backup_Estrutura.xlsx");
  };

  const handleClearDatabase = () => {
    if (confirm("⚠️ ATENÇÃO: Deseja apagar TODOS os dados do sistema?\n\nIsso excluirá permanentemente indicadores, metas e histórico.")) {
        onUpdate({ ...INITIAL_DATA, users: data.users, adminPassword: data.adminPassword }, 'structure');
        setImportReport("Base de dados limpa com sucesso.");
        setPreviewData([]);
        setShowPreview(false);
    }
  };

  // --- AI ANALYSIS LOGIC ---
  const handleAnalyze = async () => {
    if (!process.env.API_KEY) {
      alert("Chave de API do Google Gemini não configurada. Verifique as variáveis de ambiente.");
      return;
    }

    if (!aiPrompt.trim()) {
        alert("Por favor, digite sua pergunta ou solicitação para a IA.");
        return;
    }

    setAiLoading(true);
    setAiResult('');

    // Preparar o contexto do sistema em JSON simplificado para a IA
    const systemContext = {
      Identidade: {
        Empresa: data.identity.companyName,
        Missao: data.identity.mission,
        Visao: data.identity.vision,
        Valores: data.identity.values,
        Proposito: data.identity.purpose
      },
      VisaoFuturo: data.visionLine.map(v => ({ Ano: v.year, Descricao: v.description })),
      MapaEstrategico: data.perspectives.map(p => ({
        Perspectiva: p.name,
        Objetivos: data.objectives
          .filter(o => o.perspectiveId === p.id)
          .map(o => ({
            Nome: o.name,
            Responsavel: data.managers.find(m => m.id === o.gestorId)?.name,
            Indicadores: data.indicators
              .filter(i => i.objetivoId === o.id)
              .map(i => ({
                Nome: i.name,
                MetaAnual: data.goals.find(g => g.indicatorId === i.id)?.monthlyValues.reduce((acc, curr) => acc + (parseFloat(curr)||0), 0)
              }))
          }))
      }))
    };

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      // Usando o modelo gemini-2.5-flash para tarefas de texto básicas/analíticas
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            parts: [
              { text: "INSTRUÇÃO DO SISTEMA: Você é um consultor especialista em planejamento estratégico. Responda à solicitação do usuário com base EXCLUSIVAMENTE nos dados da empresa fornecidos abaixo." },
              { text: "DADOS DA EMPRESA (JSON):" },
              { text: JSON.stringify(systemContext, null, 2) },
              { text: "SOLICITAÇÃO DO USUÁRIO:" },
              { text: aiPrompt }
            ]
          }
        ]
      });

      const text = response.text;
      setAiResult(text || "Sem resposta da IA.");

    } catch (error: any) {
      console.error("Erro na análise IA:", error);
      alert("Ocorreu um erro ao consultar a IA. Verifique o console ou sua chave de API.");
      setAiResult("Erro na execução da análise.");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex justify-between items-center border-b pb-4 bg-white p-4 rounded shadow-sm">
        <h2 className="text-2xl font-bold text-blue-900 flex items-center gap-2"><i className="ph ph-shield-check"></i> Painel do Administrador</h2>
        
        {onClose && (
          <Button variant="danger" size="sm" onClick={onClose} className="flex items-center gap-2 bg-red-100 text-red-600 border border-red-200 hover:bg-red-200">
             <i className="ph ph-sign-out"></i> Sair do Admin
          </Button>
        )}
      </div>

      <div className="flex gap-2 border-b border-slate-200 pb-1 overflow-x-auto">
        <button className={`px-4 py-2 text-sm font-bold rounded-t-lg border-t border-x ${activeSubTab === 'structure' ? 'bg-white text-blue-700' : 'bg-slate-100 text-slate-500'}`} onClick={() => setActiveSubTab('structure')}>🛠️ Manual</button>
        <button className={`px-4 py-2 text-sm font-bold rounded-t-lg border-t border-x ${activeSubTab === 'import' ? 'bg-white text-blue-700' : 'bg-slate-100 text-slate-500'}`} onClick={() => setActiveSubTab('import')}>📥 Importação</button>
        <button className={`px-4 py-2 text-sm font-bold rounded-t-lg border-t border-x ${activeSubTab === 'config' ? 'bg-white text-blue-700' : 'bg-slate-100 text-slate-500'}`} onClick={() => setActiveSubTab('config')}>⚙️ Configurações</button>
        <button className={`px-4 py-2 text-sm font-bold rounded-t-lg border-t border-x ${activeSubTab === 'security' ? 'bg-white text-blue-700' : 'bg-slate-100 text-slate-500'}`} onClick={() => setActiveSubTab('security')}>🔒 Segurança</button>
        <button className={`px-4 py-2 text-sm font-bold rounded-t-lg border-t border-x ${activeSubTab === 'ai-analysis' ? 'bg-white text-blue-700' : 'bg-slate-100 text-slate-500'}`} onClick={() => setActiveSubTab('ai-analysis')}>✨ Análise IA</button>
      </div>

      {activeSubTab === 'ai-analysis' && (
        <div className="bg-white p-6 rounded-b-lg shadow-sm border border-t-0 border-slate-200 animate-fade-in">
           <div className="flex justify-between items-center mb-4">
               <div>
                   <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                     <i className="ph ph-magic-wand text-purple-600"></i> Consultoria Estratégica via IA
                   </h3>
                   <p className="text-sm text-slate-500">Utilize inteligência artificial para auditar e sugerir melhorias no seu Contrato de Gestão.</p>
               </div>
           </div>

           <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1 space-y-4">
                  <div>
                      <label className="block text-xs font-bold text-slate-500 mb-2">Sua Solicitação (Prompt)</label>
                      <textarea 
                        className="w-full p-3 border rounded-lg text-sm h-64 focus:ring-2 focus:ring-purple-200 focus:border-purple-400 placeholder:text-slate-400"
                        placeholder="Ex: Analise a coerência entre a Visão de Futuro e os Indicadores cadastrados..."
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                      />
                  </div>
                  <Button 
                    onClick={handleAnalyze} 
                    disabled={aiLoading} 
                    className={`w-full flex items-center justify-center gap-2 py-3 ${aiLoading ? 'bg-slate-400' : 'bg-purple-700 hover:bg-purple-800'}`}
                  >
                    {aiLoading ? (
                        <>
                           <i className="ph ph-spinner animate-spin"></i> Analisando...
                        </>
                    ) : (
                        <>
                           <i className="ph ph-lightning"></i> Gerar Análise
                        </>
                    )}
                  </Button>
                  <div className="bg-purple-50 p-3 rounded text-xs text-purple-800 border border-purple-100">
                     <strong>Nota:</strong> O sistema injetará automaticamente os dados de Identidade, Metas e Estrutura da empresa para contexto da IA.
                  </div>
              </div>

              <div className="lg:col-span-2">
                 <div className="border rounded-lg bg-slate-50 min-h-[400px] flex flex-col">
                    <div className="p-3 border-b bg-white rounded-t-lg font-bold text-slate-700">Resultado da Análise</div>
                    <div className="p-6 flex-1 whitespace-pre-wrap text-sm text-slate-800 font-medium leading-relaxed overflow-y-auto max-h-[600px]">
                        {aiResult || <span className="text-slate-400 italic">O resultado aparecerá aqui...</span>}
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}

      {activeSubTab === 'config' && (
        <div className="bg-white p-6 rounded-b-lg shadow-sm border border-t-0 border-slate-200 animate-fade-in">
           <h3 className="font-bold text-lg mb-4 text-slate-800">Configurações Globais</h3>
           <p className="text-sm text-slate-500 mb-6">Defina os valores padrão para o semáforo de desempenho. Esses valores serão aplicados a novos indicadores ou àqueles que não possuírem regras específicas.</p>
           
           <div className="p-6 bg-slate-50 border border-slate-200 rounded-lg max-w-4xl">
              <label className="block text-sm font-bold text-slate-700 mb-4 border-b pb-2">Farol de Desempenho (Semáforo) - Padrão Geral</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="bg-white p-3 rounded border border-blue-100 shadow-sm">
                    <span className="block text-xs text-blue-600 font-bold mb-1">Azul (Superação)</span>
                    <input 
                      className="w-full border p-2 rounded text-sm font-medium text-blue-900" 
                      placeholder="Ex: Acima de 110%" 
                      value={globalSem.blue} 
                      onChange={e => setGlobalSem({...globalSem, blue: e.target.value})} 
                    />
                 </div>
                 <div className="bg-white p-3 rounded border border-green-100 shadow-sm">
                    <span className="block text-xs text-green-600 font-bold mb-1">Verde (Meta)</span>
                    <input 
                      className="w-full border p-2 rounded text-sm font-medium text-green-900" 
                      placeholder="Ex: De 100% a 110%" 
                      value={globalSem.green} 
                      onChange={e => setGlobalSem({...globalSem, green: e.target.value})} 
                    />
                 </div>
                 <div className="bg-white p-3 rounded border border-yellow-100 shadow-sm">
                    <span className="block text-xs text-yellow-600 font-bold mb-1">Amarelo (Atenção)</span>
                    <input 
                      className="w-full border p-2 rounded text-sm font-medium text-yellow-900" 
                      placeholder="Ex: De 90% a 99%" 
                      value={globalSem.yellow} 
                      onChange={e => setGlobalSem({...globalSem, yellow: e.target.value})} 
                    />
                 </div>
                 <div className="bg-white p-3 rounded border border-red-100 shadow-sm">
                    <span className="block text-xs text-red-600 font-bold mb-1">Vermelho (Crítico)</span>
                    <input 
                      className="w-full border p-2 rounded text-sm font-medium text-red-900" 
                      placeholder="Ex: Abaixo de 90%" 
                      value={globalSem.red} 
                      onChange={e => setGlobalSem({...globalSem, red: e.target.value})} 
                    />
                 </div>
              </div>
              <div className="mt-6 flex justify-end">
                 <Button onClick={handleSaveGlobalConfig} className="flex items-center gap-2"><i className="ph ph-floppy-disk"></i> Salvar Padrões</Button>
              </div>
           </div>
        </div>
      )}

      {activeSubTab === 'security' && (
        <div className="bg-white p-6 rounded-b-lg shadow-sm border border-t-0 border-slate-200 animate-fade-in">
           <h3 className="font-bold text-lg mb-4 text-slate-800">Alterar Senha de Acesso</h3>
           <div className="max-w-md space-y-4">
              <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Senha Atual</label>
                  <PasswordInput value={passData.current} onChange={e => setPassData({...passData, current: e.target.value})} />
              </div>
              <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Nova Senha</label>
                  <PasswordInput value={passData.new} onChange={e => setPassData({...passData, new: e.target.value})} />
              </div>
              <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Confirmar Nova Senha</label>
                  <PasswordInput value={passData.confirm} onChange={e => setPassData({...passData, confirm: e.target.value})} />
              </div>
              <div className="pt-2">
                 <Button onClick={handleChangePassword}>Salvar Nova Senha</Button>
              </div>
           </div>
        </div>
      )}

      {/* Import Tab */}
      {activeSubTab === 'import' && (
        <div className="bg-white p-6 rounded-b-lg shadow-sm border border-t-0 border-slate-200">
          {!showPreview ? (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                  <div className="flex items-start gap-3 mb-4">
                    <div className="bg-green-100 p-2 rounded text-green-700 text-2xl"><i className="ph ph-microsoft-excel-logo"></i></div>
                    <div><h3 className="text-lg font-bold text-slate-800">Importar Dados</h3><p className="text-xs text-slate-500">Planilhas .xlsx</p></div>
                  </div>
                  <div className="p-6 border-2 border-dashed border-blue-200 rounded-lg bg-blue-50 text-center hover:bg-blue-100 transition-colors relative cursor-pointer mb-4">
                    <input ref={fileInputRef} type="file" accept=".xlsx, .xls" onChange={handleFileImport} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"/>
                    <i className="ph ph-upload-simple text-3xl text-blue-400 mb-2"></i>
                    <p className="text-blue-800 font-bold text-sm">Clique para carregar</p>
                  </div>
                  <div className="text-xs text-slate-500 bg-slate-100 p-3 rounded">
                    <strong>Colunas:</strong> Perspectiva, Objetivo, Indicador.<br/>
                    <span className="text-slate-400 italic">O sistema detecta automaticamente o cabeçalho.</span>
                  </div>
              </div>
              <div className="flex flex-col gap-4 border-l pl-8">
                  <h3 className="text-lg font-bold text-slate-800">Ações</h3>
                  <div className="space-y-3">
                      <Button onClick={handleExportData} type="button" variant="secondary" className="w-full gap-2"><i className="ph ph-download-simple"></i> Backup (.xlsx)</Button>
                      <hr className="my-2"/>
                      <Button onClick={handleClearDatabase} type="button" className="w-full gap-2 bg-red-100 text-red-700 hover:bg-red-200 border-red-200"><i className="ph ph-trash"></i> Limpar Tudo</Button>
                  </div>
              </div>
             </div>
          ) : (
            <div className="animate-fade-in">
               <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-lg text-slate-800">Pré-visualização da Importação</h3>
                  <div className="flex gap-2">
                     <Button variant="secondary" onClick={cancelImport}>Cancelar</Button>
                     <Button variant="success" onClick={confirmImport} className="flex items-center gap-2"><i className="ph ph-check"></i> Confirmar Importação</Button>
                  </div>
               </div>
               <div className="bg-slate-50 border rounded p-2 overflow-auto max-h-[400px]">
                  <table className="w-full text-xs text-left">
                     <thead className="bg-slate-200 font-bold sticky top-0">
                        <tr>
                           <th className="p-2">Perspectiva</th>
                           <th className="p-2">Objetivo</th>
                           <th className="p-2">Indicador</th>
                           <th className="p-2">Gestor</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-200 bg-white">
                        {previewData.slice(0, 100).map((row, idx) => (
                           <tr key={idx}>
                              <td className="p-2">{row.persp}</td>
                              <td className="p-2">{row.obj}</td>
                              <td className="p-2 font-medium">{row.ind}</td>
                              <td className="p-2">{row.mgr}</td>
                           </tr>
                        ))}
                        {previewData.length > 100 && <tr><td colSpan={4} className="p-2 text-center text-slate-400">... e mais {previewData.length - 100} itens</td></tr>}
                     </tbody>
                  </table>
               </div>
            </div>
          )}

          {importReport && (
            <div className="mt-6 p-4 bg-emerald-50 text-emerald-800 rounded border border-emerald-200 text-sm flex items-center gap-3">
                <i className="ph ph-check-circle text-xl"></i> {importReport}
            </div>
          )}
        </div>
      )}

      {activeSubTab === 'structure' && (
        <div className="bg-white p-6 rounded-b-lg shadow-sm border border-t-0 border-slate-200 space-y-8">
            
            {/* ROW 1: Perspectives & Managers */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="border rounded-lg p-4 bg-slate-50">
                    <h3 className="font-bold text-lg mb-3 text-blue-900 flex items-center gap-2"><i className="ph ph-squares-four"></i> 1. Perspectivas</h3>
                    <div className="flex gap-2 mb-3">
                        <input className="flex-1 border p-2 rounded text-sm" placeholder="Nova Perspectiva" value={newPerspName} onChange={e => setNewPerspName(e.target.value)} />
                        <Button size="sm" type="button" onClick={addPerspective}><i className="ph ph-plus"></i></Button>
                    </div>
                    <ul className="bg-white rounded border divide-y max-h-40 overflow-y-auto">
                        {data.perspectives.map(p => (
                            <li key={p.id} className="p-2 text-sm flex justify-between items-center hover:bg-slate-50 group">
                                <span>{p.name}</span>
                                <div className="flex gap-2">
                                    <button onClick={() => handleEdit('persp', p.id, p.name)} className="text-blue-600 hover:text-blue-800 p-1"><i className="ph ph-pencil"></i></button>
                                    <button onClick={() => handleDelete('persp', p.id)} className="text-red-600 hover:text-red-800 p-1"><i className="ph ph-trash"></i></button>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="border rounded-lg p-4 bg-slate-50">
                    <h3 className="font-bold text-lg mb-3 text-blue-900 flex items-center gap-2"><i className="ph ph-users"></i> 2. Gestores</h3>
                    <div className="flex gap-2 mb-3">
                        <input className="flex-1 border p-2 rounded text-sm" placeholder="Novo Gestor" value={newManagerName} onChange={e => setNewManagerName(e.target.value)} />
                        <Button size="sm" type="button" onClick={addManager}><i className="ph ph-plus"></i></Button>
                    </div>
                    <ul className="bg-white rounded border divide-y max-h-40 overflow-y-auto">
                        {data.managers.map(m => (
                            <li key={m.id} className="p-2 text-sm flex justify-between items-center hover:bg-slate-50 group">
                                <span>{m.name}</span>
                                <div className="flex gap-2">
                                    <button onClick={() => handleEdit('mgr', m.id, m.name)} className="text-blue-600 hover:text-blue-800 p-1"><i className="ph ph-pencil"></i></button>
                                    <button onClick={() => handleDelete('mgr', m.id)} className="text-red-600 hover:text-red-800 p-1"><i className="ph ph-trash"></i></button>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            {/* ROW 2: Objectives */}
            <div className="border rounded-lg p-4 bg-slate-50">
                <h3 className="font-bold text-lg mb-3 text-blue-900 flex items-center gap-2"><i className="ph ph-target"></i> 3. Objetivos Estratégicos</h3>
                <div className="flex flex-col md:flex-row gap-2 mb-3 bg-white p-3 rounded border shadow-sm">
                    <select className="border p-2 rounded text-sm md:w-1/3" value={selectedPerspForObj} onChange={e => setSelectedPerspForObj(e.target.value)}>
                        <option value="">Selecione a Perspectiva...</option>
                        {data.perspectives.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <input className="flex-1 border p-2 rounded text-sm" placeholder="Nome do Objetivo" value={newObjName} onChange={e => setNewObjName(e.target.value)} />
                    <Button size="sm" type="button" onClick={addObjective} disabled={!selectedPerspForObj}>Adicionar</Button>
                </div>
                <div className="bg-white rounded border divide-y max-h-60 overflow-y-auto">
                    {data.objectives.map(o => (
                        <div key={o.id} className="p-2 text-sm flex justify-between items-center hover:bg-slate-50 group border-l-4 border-transparent hover:border-blue-500">
                            <div><span className="font-bold block text-slate-700">{o.name}</span><span className="text-xs text-slate-400">{data.perspectives.find(p => p.id === o.perspectiveId)?.name}</span></div>
                            <div className="flex gap-2">
                                <button onClick={() => handleEdit('obj', o.id, o.name)} className="text-blue-600 hover:text-blue-800 p-1"><i className="ph ph-pencil"></i></button>
                                <button onClick={() => handleDelete('obj', o.id)} className="text-red-600 hover:text-red-800 p-1"><i className="ph ph-trash"></i></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ROW 3: Indicators (NEW) */}
            <div className="border rounded-lg p-4 bg-slate-50 border-blue-200">
                <h3 className="font-bold text-lg mb-3 text-blue-900 flex items-center gap-2"><i className="ph ph-chart-line-up"></i> 4. Indicadores de Desempenho</h3>
                <div className="bg-white p-3 rounded border shadow-sm space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <select className="border p-2 rounded text-sm" value={indPerspFilter} onChange={e => { setIndPerspFilter(e.target.value); setIndObjFilter(''); }}>
                            <option value="">1. Filtre a Perspectiva...</option>
                            {data.perspectives.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <select className="border p-2 rounded text-sm" value={indObjFilter} onChange={e => setIndObjFilter(e.target.value)} disabled={!indPerspFilter}>
                            <option value="">2. Selecione o Objetivo...</option>
                            {data.objectives.filter(o => o.perspectiveId === indPerspFilter).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                        </select>
                        <select className="border p-2 rounded text-sm" value={indManager} onChange={e => setIndManager(e.target.value)}>
                            <option value="">3. Defina o Gestor (Opcional)</option>
                            {data.managers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                    </div>
                    <div className="flex gap-2">
                       <input className="flex-1 border p-2 rounded text-sm" placeholder="Nome do Indicador" value={newIndName} onChange={e => setNewIndName(e.target.value)} />
                       <Button size="sm" type="button" onClick={addIndicator} disabled={!indObjFilter || !newIndName.trim()}>Adicionar Indicador</Button>
                    </div>
                </div>
            </div>
        </div>
      )}

    </div>
  );
};