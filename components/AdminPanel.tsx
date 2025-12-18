import React, { useState, useRef, useEffect } from 'react';
import { AppData, User, Indicator, Objective, Perspective, Manager, INITIAL_DATA } from '../types';
import { Button } from './ui/Button';
import { excelParser } from '../services/apiService';
import { PasswordInput } from './ui/PasswordInput';
import { MaturitySurvey } from './MaturitySurvey';

interface AdminPanelProps {
  data: AppData;
  user: User;
  onUpdate: (newData: AppData, section: any) => void;
  onClose?: () => void;
}

type TabMode = 'structure' | 'import' | 'security' | 'config' | 'ai-analysis' | 'maturity-survey';

export const AdminPanel: React.FC<AdminPanelProps> = ({ 
  data, 
  user,
  onUpdate,
  onClose
}) => {
  const [activeSubTab, setActiveSubTab] = useState<TabMode>('structure');
  const [importReport, setImportReport] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);

  const [newPerspName, setNewPerspName] = useState('');
  const [newManagerName, setNewManagerName] = useState('');
  const [newObjName, setNewObjName] = useState('');
  const [selectedPerspForObj, setSelectedPerspForObj] = useState('');
  const [newIndName, setNewIndName] = useState('');
  const [indPerspFilter, setIndPerspFilter] = useState('');
  const [indObjFilter, setIndObjFilter] = useState('');
  const [indManager, setIndManager] = useState('');

  const [passData, setPassData] = useState({ current: '', new: '', confirm: '' });
  const [globalSem, setGlobalSem] = useState({ blue: '', green: '', yellow: '', red: '' });

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
    if (!newIndName.trim() || !indObjFilter) return alert("Selecione um Objetivo e digite o nome.");
    const obj = data.objectives.find(o => o.id === indObjFilter);
    if (!obj) return;
    const newInd: Indicator = {
        id: generateId('IND'),
        name: newIndName.trim(),
        objetivoId: obj.id,
        perspectivaId: obj.perspectiveId,
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
      const rawRows = await excelParser.parse(file);
      analyzeImportFile(rawRows);
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const analyzeImportFile = (rows: any[]) => {
    let headerRowIndex = -1;
    let colIndices = { persp: -1, obj: -1, ind: -1, mgr: -1 };
    const synonyms = { persp: ['perspectiva'], obj: ['objetivo'], ind: ['indicador'], mgr: ['gestor'] };
    const findIndex = (row: any[], keys: string[]) => row.findIndex(c => c && keys.includes(normalizeKey(c)));

    for (let i = 0; i < Math.min(rows.length, 25); i++) {
      const normRow = (rows[i] || []).map((c: any) => normalizeKey(c));
      const idxInd = findIndex(normRow, synonyms.ind);
      if (idxInd !== -1) {
        headerRowIndex = i;
        colIndices = { persp: findIndex(normRow, synonyms.persp), obj: findIndex(normRow, synonyms.obj), ind: idxInd, mgr: findIndex(normRow, synonyms.mgr) };
        break;
      }
    }
    if (headerRowIndex === -1) return alert("Cabeçalho não encontrado.");
    const extractedData = [];
    let lastPersp = '', lastObj = '';
    for (let i = headerRowIndex + 1; i < rows.length; i++) {
      const row = rows[i];
      const rawInd = row[colIndices.ind] ? String(row[colIndices.ind]).trim() : '';
      if (!rawInd) continue;
      if (colIndices.persp !== -1 && row[colIndices.persp]) lastPersp = String(row[colIndices.persp]).trim();
      if (colIndices.obj !== -1 && row[colIndices.obj]) lastObj = String(row[colIndices.obj]).trim();
      extractedData.push({ persp: lastPersp || 'Geral', obj: lastObj || 'Geral', ind: rawInd, mgr: row[colIndices.mgr] ? String(row[colIndices.mgr]).trim() : '' });
    }
    setPreviewData(extractedData);
    setShowPreview(true);
  };

  const confirmImport = () => {
    let newPerspectives = [...data.perspectives], newObjectives = [...data.objectives], newManagers = [...data.managers], newIndicators = [...data.indicators], count = 0;
    previewData.forEach(row => {
      let p = newPerspectives.find(x => normalizeKey(x.name) === normalizeKey(row.persp));
      if (!p) { p = { id: generateId('PERSP'), name: row.persp }; newPerspectives.push(p); }
      let mId = '';
      if (row.mgr) {
        let m = newManagers.find(x => normalizeKey(x.name) === normalizeKey(row.mgr));
        if (!m) { m = { id: generateId('MGR'), name: row.mgr }; newManagers.push(m); }
        mId = m.id;
      }
      let o = newObjectives.find(x => normalizeKey(x.name) === normalizeKey(row.obj) && x.perspectiveId === p!.id);
      if (!o) { o = { id: generateId('OBJ'), name: row.obj, perspectiveId: p!.id, gestorId: mId }; newObjectives.push(o); }
      if (!newIndicators.some(x => normalizeKey(x.name) === normalizeKey(row.ind) && x.objetivoId === o!.id)) {
        newIndicators.push({ id: generateId('IND'), name: row.ind, perspectivaId: p!.id, objetivoId: o!.id, gestorId: mId, description: '', formula: '', unit: '', source: '', periodicity: '', polarity: '', status: 'draft', updatedAt: new Date().toISOString() });
        count++;
      }
    });
    onUpdate({ ...data, perspectives: newPerspectives, managers: newManagers, objectives: newObjectives, indicators: newIndicators }, 'structure');
    setImportReport(`Importação Concluída: ${count} itens.`);
    setShowPreview(false);
  };

  const handleAnalyze = async () => {
    if (!aiPrompt.trim()) return alert("Digite uma solicitação.");
    setAiLoading(true); setAiResult('');
    const systemContext = { Identidade: data.identity, Visao: data.visionLine, Mapa: data.perspectives.map(p => ({ p: p.name, objs: data.objectives.filter(o => o.perspectiveId === p.id).map(o => o.name) })) };
    try {
     
const response = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${import.meta.env.VITE_GEMINI_API_KEY}`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text:
                "Você é um consultor estratégico. Responda baseado nos dados abaixo:\n\n" +
                JSON.stringify(systemContext, null, 2) +
                "\n\nSolicitação do usuário:\n" +
                aiPrompt
            }
          ]
        }
      ]
    })
  }
);

const dataAI = await response.json();

const text =
  dataAI?.candidates?.[0]?.content?.parts?.[0]?.text ||
  "Sem resposta.";

setAiResult(text);

  
      setAiResult(response.text || "Sem resposta.");
    } catch (error) {
      alert("Erro na IA.");
    } finally { setAiLoading(false); }
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex justify-between items-center border-b pb-4 bg-white p-4 rounded shadow-sm">
        <h2 className="text-2xl font-bold text-blue-900 flex items-center gap-2"><i className="ph ph-shield-check"></i> Admin</h2>
        {onClose && <Button variant="danger" size="sm" onClick={onClose}>Sair</Button>}
      </div>
      <div className="flex gap-2 border-b border-slate-200 pb-1 overflow-x-auto">
        <button className={`px-4 py-2 text-sm font-bold whitespace-nowrap ${activeSubTab === 'structure' ? 'text-blue-700 border-b-2 border-blue-700' : 'text-slate-500'}`} onClick={() => setActiveSubTab('structure')}>Manual</button>
        <button className={`px-4 py-2 text-sm font-bold whitespace-nowrap ${activeSubTab === 'import' ? 'text-blue-700 border-b-2 border-blue-700' : 'text-slate-500'}`} onClick={() => setActiveSubTab('import')}>Importação</button>
        <button className={`px-4 py-2 text-sm font-bold whitespace-nowrap ${activeSubTab === 'config' ? 'text-blue-700 border-b-2 border-blue-700' : 'text-slate-500'}`} onClick={() => setActiveSubTab('config')}>Configurações</button>
        <button className={`px-4 py-2 text-sm font-bold whitespace-nowrap ${activeSubTab === 'security' ? 'text-blue-700 border-b-2 border-blue-700' : 'text-slate-500'}`} onClick={() => setActiveSubTab('security')}>Segurança</button>
        <button className={`px-4 py-2 text-sm font-bold whitespace-nowrap ${activeSubTab === 'ai-analysis' ? 'text-blue-700 border-b-2 border-blue-700' : 'text-slate-500'}`} onClick={() => setActiveSubTab('ai-analysis')}>Análise IA</button>
        <button className={`px-4 py-2 text-sm font-bold whitespace-nowrap ${activeSubTab === 'maturity-survey' ? 'text-blue-700 border-b-2 border-blue-700' : 'text-slate-500'}`} onClick={() => setActiveSubTab('maturity-survey')}>✨ Pesquisa Maturidade</button>
      </div>

      {activeSubTab === 'maturity-survey' && (
        <MaturitySurvey data={data} />
      )}

      {activeSubTab === 'ai-analysis' && (
        <div className="bg-white p-6 rounded shadow border animate-fade-in">
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1 space-y-4">
                  <textarea className="w-full p-3 border rounded text-sm h-64 focus:ring-2" placeholder="Ex: Avalie a viabilidade das minhas metas para 2026..." value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} />
                  <Button onClick={handleAnalyze} disabled={aiLoading} className="w-full py-3 bg-purple-700">{aiLoading ? "Analisando..." : "Gerar Análise"}</Button>
              </div>
              <div className="lg:col-span-2 border rounded bg-slate-50 p-6 whitespace-pre-wrap text-sm">{aiResult || "O resultado aparecerá aqui..."}</div>
           </div>
        </div>
      )}

      {activeSubTab === 'config' && (
        <div className="bg-white p-6 rounded shadow border animate-fade-in">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div><label className="text-xs text-blue-600 font-bold">Azul</label><input className="w-full border p-2 rounded" value={globalSem.blue} onChange={e => setGlobalSem({...globalSem, blue: e.target.value})} /></div>
                 <div><label className="text-xs text-green-600 font-bold">Verde</label><input className="w-full border p-2 rounded" value={globalSem.green} onChange={e => setGlobalSem({...globalSem, green: e.target.value})} /></div>
                 <div><label className="text-xs text-yellow-600 font-bold">Amarelo</label><input className="w-full border p-2 rounded" value={globalSem.yellow} onChange={e => setGlobalSem({...globalSem, yellow: e.target.value})} /></div>
                 <div><label className="text-xs text-red-600 font-bold">Vermelho</label><input className="w-full border p-2 rounded" value={globalSem.red} onChange={e => setGlobalSem({...globalSem, red: e.target.value})} /></div>
           </div>
           <div className="mt-6 flex justify-end"><Button onClick={handleSaveGlobalConfig}>Salvar Padrões</Button></div>
        </div>
      )}

      {activeSubTab === 'security' && (
        <div className="bg-white p-6 rounded shadow border animate-fade-in">
           <div className="max-w-md space-y-4">
              <PasswordInput placeholder="Senha Atual" value={passData.current} onChange={e => setPassData({...passData, current: e.target.value})} />
              <PasswordInput placeholder="Nova Senha" value={passData.new} onChange={e => setPassData({...passData, new: e.target.value})} />
              <PasswordInput placeholder="Confirmar Nova Senha" value={passData.confirm} onChange={e => setPassData({...passData, confirm: e.target.value})} />
              <Button onClick={handleChangePassword}>Salvar</Button>
           </div>
        </div>
      )}

      {activeSubTab === 'import' && (
        <div className="bg-white p-6 rounded shadow border">
          {!showPreview ? (
             <div className="text-center p-12 border-2 border-dashed border-blue-200 rounded-lg cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileImport}/>
                <i className="ph ph-upload-simple text-3xl text-blue-400 mb-2"></i>
                <p className="text-blue-800 font-bold">Clique para carregar planilha Excel</p>
             </div>
          ) : (
            <div>
               <div className="flex justify-between mb-4"><h3 className="font-bold">Pré-visualização</h3><div className="flex gap-2"><Button variant="secondary" onClick={() => setShowPreview(false)}>Cancelar</Button><Button onClick={confirmImport}>Confirmar</Button></div></div>
               <div className="overflow-auto max-h-96 border rounded"><table className="w-full text-xs text-left"><thead className="bg-slate-200"><tr><th className="p-2">Persp</th><th className="p-2">Obj</th><th className="p-2">Ind</th></tr></thead><tbody>{previewData.map((r, i) => <tr key={i} className="border-b"><td className="p-2">{r.persp}</td><td className="p-2">{r.obj}</td><td className="p-2">{r.ind}</td></tr>)}</tbody></table></div>
            </div>
          )}
        </div>
      )}

      {activeSubTab === 'structure' && (
        <div className="space-y-8 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white p-4 border rounded shadow-sm">
                    <h3 className="font-bold mb-3 flex items-center gap-2"><i className="ph ph-squares-four"></i> Perspectivas</h3>
                    <div className="flex gap-2 mb-3"><input className="flex-1 border p-2 rounded text-sm" value={newPerspName} onChange={e => setNewPerspName(e.target.value)} /><Button size="sm" onClick={addPerspective}>+</Button></div>
                    <ul className="divide-y max-h-40 overflow-auto">{data.perspectives.map(p => <li key={p.id} className="p-2 text-sm flex justify-between">{p.name}<div className="flex gap-2"><button onClick={() => handleEdit('persp', p.id, p.name)} className="text-blue-600"><i className="ph ph-pencil"></i></button><button onClick={() => handleDelete('persp', p.id)} className="text-red-600"><i className="ph ph-trash"></i></button></div></li>)}</ul>
                </div>
                <div className="bg-white p-4 border rounded shadow-sm">
                    <h3 className="font-bold mb-3 flex items-center gap-2"><i className="ph ph-users"></i> Gestores</h3>
                    <div className="flex gap-2 mb-3"><input className="flex-1 border p-2 rounded text-sm" value={newManagerName} onChange={e => setNewManagerName(e.target.value)} /><Button size="sm" onClick={addManager}>+</Button></div>
                    <ul className="divide-y max-h-40 overflow-auto">{data.managers.map(m => <li key={m.id} className="p-2 text-sm flex justify-between">{m.name}<div className="flex gap-2"><button onClick={() => handleEdit('mgr', m.id, m.name)} className="text-blue-600"><i className="ph ph-pencil"></i></button><button onClick={() => handleDelete('mgr', m.id)} className="text-red-600"><i className="ph ph-trash"></i></button></div></li>)}</ul>
                </div>
            </div>
            <div className="bg-white p-4 border rounded shadow-sm">
                <h3 className="font-bold mb-3 flex items-center gap-2"><i className="ph ph-target"></i> Objetivos Estratégicos</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
                    <select className="border p-2 rounded text-sm" value={selectedPerspForObj} onChange={e => setSelectedPerspForObj(e.target.value)}><option value="">Perspectiva...</option>{data.perspectives.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                    <input className="border p-2 rounded text-sm" placeholder="Nome do Objetivo" value={newObjName} onChange={e => setNewObjName(e.target.value)} /><Button onClick={addObjective}>Adicionar</Button>
                </div>
                <ul className="divide-y max-h-60 overflow-auto">{data.objectives.map(o => <li key={o.id} className="p-2 text-sm flex justify-between"><div><span className="font-bold">{o.name}</span><br/><span className="text-xs text-slate-400">{data.perspectives.find(p => p.id === o.perspectiveId)?.name}</span></div><div className="flex gap-2"><button onClick={() => handleEdit('obj', o.id, o.name)} className="text-blue-600"><i className="ph ph-pencil"></i></button><button onClick={() => handleDelete('obj', o.id)} className="text-red-600"><i className="ph ph-trash"></i></button></div></li>)}</ul>
            </div>
            <div className="bg-white p-4 border rounded shadow-sm">
                <h3 className="font-bold mb-3 flex items-center gap-2"><i className="ph ph-chart-line-up"></i> Indicadores</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-3">
                    <select className="border p-2 rounded text-sm" value={indPerspFilter} onChange={e => setIndPerspFilter(e.target.value)}><option value="">Perspectiva...</option>{data.perspectives.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                    <select className="border p-2 rounded text-sm" value={indObjFilter} onChange={e => setIndObjFilter(e.target.value)}><option value="">Objetivo...</option>{data.objectives.filter(o => o.perspectiveId === indPerspFilter).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
                    <input className="border p-2 rounded text-sm" placeholder="Nome Indicador" value={newIndName} onChange={e => setNewIndName(e.target.value)} /><Button onClick={addIndicator}>Adicionar</Button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};