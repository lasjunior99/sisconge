import React, { useState, useRef } from 'react';
import { AppData, User, Indicator, Objective, Perspective, Manager, INITIAL_DATA } from '../types';
import { Button } from './ui/Button';
import { excelParser } from '../services/apiService';
import { PasswordInput } from './ui/PasswordInput';

interface AdminPanelProps {
  data: AppData;
  user: User;
  onUpdate: (newData: AppData, section: any) => void;
  onClose?: () => void;
}

type TabMode = 'structure' | 'import' | 'security';

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

  // --- Security State ---
  const [passData, setPassData] = useState({ current: '', new: '', confirm: '' });

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

  // --- PASSWORD CHANGE LOGIC ---
  const handleChangePassword = () => {
    if (!passData.current || !passData.new || !passData.confirm) {
        alert("Preencha todos os campos.");
        return;
    }
    
    const validPass = data.adminPassword || '123456';
    if (passData.current !== validPass) {
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
    }
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
        <button className={`px-4 py-2 text-sm font-bold rounded-t-lg border-t border-x ${activeSubTab === 'security' ? 'bg-white text-blue-700' : 'bg-slate-100 text-slate-500'}`} onClick={() => setActiveSubTab('security')}>🔒 Segurança</button>
      </div>

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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="border rounded-lg p-4 bg-slate-50">
                    <h3 className="font-bold text-lg mb-3 text-blue-900 flex items-center gap-2"><i className="ph ph-squares-four"></i> Perspectivas</h3>
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
                    <h3 className="font-bold text-lg mb-3 text-blue-900 flex items-center gap-2"><i className="ph ph-users"></i> Gestores</h3>
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
            <div className="border rounded-lg p-4 bg-slate-50">
                <h3 className="font-bold text-lg mb-3 text-blue-900 flex items-center gap-2"><i className="ph ph-target"></i> Objetivos</h3>
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
        </div>
      )}

      {/* GLOBAL REPORT TABLE */}
      <div className="bg-white rounded border overflow-hidden shadow-sm mt-8">
        <div className="bg-slate-100 p-3 border-b flex justify-between items-center">
          <h3 className="font-bold text-slate-700 flex items-center gap-2"><i className="ph ph-table"></i> Dados no Sistema</h3>
          <span className="text-xs text-slate-500 font-bold">Total: {data.indicators.length}</span>
        </div>
        <div className="overflow-x-auto max-h-[500px]">
          <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b sticky top-0">
                  <tr>
                      <th className="p-3">Perspectiva</th>
                      <th className="p-3">Objetivo</th>
                      <th className="p-3">Indicador</th>
                      <th className="p-3">Gestor</th>
                      <th className="p-3 text-right">Ações</th>
                  </tr>
              </thead>
              <tbody className="divide-y">
                  {data.indicators.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-slate-400">Nenhum dado.</td></tr>}
                  {data.indicators.map(ind => (
                      <tr key={ind.id} className="hover:bg-blue-50 group">
                          <td className="p-3 text-xs text-slate-500 align-top">{data.perspectives.find(p => p.id === ind.perspectivaId)?.name}</td>
                          <td className="p-3 text-xs text-slate-600 align-top">{data.objectives.find(o => o.id === ind.objetivoId)?.name}</td>
                          <td className="p-3 font-medium text-slate-800 align-top">{ind.name}</td>
                          <td className="p-3 text-xs text-slate-500 align-top">{data.managers.find(m => m.id === ind.gestorId)?.name || '-'}</td>
                          <td className="p-3 text-right align-top">
                              <div className="flex justify-end gap-2">
                                  <button onClick={() => handleEdit('ind', ind.id, ind.name)} className="text-blue-600 hover:bg-blue-100 p-1 rounded" title="Editar"><i className="ph ph-pencil text-lg"></i></button>
                                  <button onClick={() => handleDelete('ind', ind.id)} className="text-red-600 hover:bg-red-100 p-1 rounded" title="Excluir"><i className="ph ph-trash text-lg"></i></button>
                              </div>
                          </td>
                      </tr>
                  ))}
              </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
