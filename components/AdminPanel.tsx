
import React, { useState, useEffect } from 'react';
import { AppData, Perspective, Manager, Objective, Indicator } from '../types';
import { Button } from './ui/Button';
import { storageService } from '../services/storageService';
import { saveFirebaseConfig, clearFirebaseConfig, isFirebaseConnected, compressConfig } from '../services/firebase';

interface AdminPanelProps {
  data: AppData;
  onUpdate: (newData: AppData) => void;
  isAuthenticated: boolean;
  setAuthenticated: (auth: boolean) => void;
  onClose: () => void;
}

type TabMode = 'structure' | 'import' | 'batch' | 'cloud' | 'settings';

export const AdminPanel: React.FC<AdminPanelProps> = ({ 
  data, 
  onUpdate, 
  isAuthenticated, 
  setAuthenticated, 
  onClose 
}) => {
  const [passwordInput, setPasswordInput] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<TabMode>('import');
  
  // --- States for Manual Structure Management ---
  const [newManager, setNewManager] = useState('');
  const [newPerspective, setNewPerspective] = useState('');
  
  // States for Indicator Management (Structure Tab)
  const [filterIndSearch, setFilterIndSearch] = useState('');
  const [editingIndId, setEditingIndId] = useState<string | null>(null);
  const [editingIndName, setEditingIndName] = useState('');

  // --- States for Batch Wizard ---
  const [batchManagers, setBatchManagers] = useState('');
  const [batchPerspectives, setBatchPerspectives] = useState('');
  const [batchObjTargetPersp, setBatchObjTargetPersp] = useState('');
  const [batchObjectives, setBatchObjectives] = useState('');
  const [batchIndTargetObj, setBatchIndTargetObj] = useState('');
  const [batchIndTargetManager, setBatchIndTargetManager] = useState('');
  const [batchIndicators, setBatchIndicators] = useState('');

  // --- States for Import ---
  const [loading, setLoading] = useState(false);
  const [importReport, setImportReport] = useState<string | null>(null);
  const [pasteData, setPasteData] = useState('');

  // --- States for Cloud Config ---
  const [firebaseConfigInput, setFirebaseConfigInput] = useState('');
  const [isOnline] = useState(isFirebaseConnected());
  const [restarting, setRestarting] = useState(false); // Estado para controlar o reload suave
  const [generatedToken, setGeneratedToken] = useState('');
  const [isLocalhost, setIsLocalhost] = useState(false);

  // --- States for Settings ---
  const [newAdminPass, setNewAdminPass] = useState('');

  useEffect(() => {
    // Detecta se está rodando localmente
    const hostname = window.location.hostname;
    setIsLocalhost(hostname === 'localhost' || hostname === '127.0.0.1');
  }, []);

  const handleLogin = () => {
    if (passwordInput === data.adminPassword) {
      setAuthenticated(true);
    } else {
      alert('Senha incorreta');
    }
  };

  const changeAdminPassword = () => {
    if (!newAdminPass || newAdminPass.length < 4) {
      alert("A senha deve ter pelo menos 4 caracteres.");
      return;
    }
    onUpdate({ ...data, adminPassword: newAdminPass });
    setNewAdminPass('');
    alert("Senha de Administrador alterada com sucesso! Não a esqueça.");
  };

  const generateId = (prefix: string) => `${prefix}-` + Math.random().toString(36).substr(2, 9).toUpperCase();

  // ... Import Logic (Keep existing helpers) ...
  const normalizeKey = (str: string) => 
    String(str).normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

  const processImportData = (rows: any[]) => {
    if (rows.length === 0) {
      setImportReport('❌ Nenhum dado encontrado para processar.');
      return;
    }

    let newPerspectives = [...data.perspectives];
    let newManagers = [...data.managers];
    let newObjectives = [...data.objectives];
    let newIndicators = [...data.indicators];

    let stats = { p: 0, o: 0, i: 0, m: 0 };
    let skipped = 0;

    rows.forEach((rawRow: any) => {
      const row: any = {};
      Object.keys(rawRow).forEach(key => {
          const cleanKey = normalizeKey(key);
          row[cleanKey] = rawRow[key];
      });

      const getVal = (aliases: string[]) => {
        for (const alias of aliases) {
          if (row[alias] !== undefined && row[alias] !== null) {
              return String(row[alias]).trim();
          }
        }
        return '';
      };

      const perspName = getVal(['perspectiva', 'perspectivas', 'perspective', 'perspectiva estrategica']);
      const objName = getVal(['objetivo', 'objetivos', 'objetivo estrategico', 'objective']);
      const indName = getVal(['indicador', 'indicadores', 'indicador estrategico', 'indicator']);
      const gestorName = getVal(['gestor', 'gestores', 'manager', 'responsavel', 'responsavel pelo indicador']);

      if (!perspName || !objName || !indName) {
          skipped++;
          return;
      }

      let persp = newPerspectives.find(p => normalizeKey(p.name) === normalizeKey(perspName));
      if (!persp) {
        persp = { id: generateId('PERSP'), name: perspName };
        newPerspectives.push(persp);
        stats.p++;
      }

      let managerId = '';
      if (gestorName) {
          let manager = newManagers.find(m => normalizeKey(m.name) === normalizeKey(gestorName));
          if (!manager) {
              manager = { id: generateId('MGR'), name: gestorName };
              newManagers.push(manager);
              stats.m++;
          }
          managerId = manager.id;
      }

      let obj = newObjectives.find(o => 
          normalizeKey(o.name) === normalizeKey(objName) && o.perspectiveId === persp!.id
      );
      if (!obj) {
        obj = { id: generateId('OBJ'), name: objName, perspectiveId: persp!.id, gestorId: managerId };
        newObjectives.push(obj);
        stats.o++;
      }

      let ind = newIndicators.find(i => 
          normalizeKey(i.name) === normalizeKey(indName) && i.objetivoId === obj!.id
      );
      if (!ind) {
        ind = {
          id: generateId('IND'),
          name: indName,
          perspectivaId: persp!.id,
          objetivoId: obj!.id,
          gestorId: managerId,
          description: '', formula: '', unit: '', source: '', periodicity: '', polarity: '', 
          status: 'draft', updatedAt: new Date().toISOString()
        };
        newIndicators.push(ind);
        stats.i++;
      }
    });

    onUpdate({
        ...data,
        perspectives: newPerspectives,
        managers: newManagers,
        objectives: newObjectives,
        indicators: newIndicators
    });
    
    setImportReport(
        `✅ Processamento concluído!\n\n` +
        `• Linhas analisadas: ${rows.length}\n` +
        `• Novas Perspectivas: ${stats.p}\n` +
        `• Novos Objetivos: ${stats.o}\n` +
        `• Novos Indicadores: ${stats.i}\n` +
        `• Novos Gestores: ${stats.m}`
    );
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    setImportReport(null);
    setLoading(true);
    try {
      const rows = await storageService.parseExcel(e.target.files[0]);
      processImportData(rows);
    } catch (err) {
      console.error(err);
      setImportReport('❌ Erro ao ler arquivo. Tente usar a opção "Copiar/Colar Texto" abaixo.');
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const handleTextImport = () => {
    if (!pasteData.trim()) return;
    setLoading(true);
    setImportReport(null);
    try {
      const lines = pasteData.trim().split('\n');
      if (lines.length < 2) {
        setImportReport('❌ Texto muito curto.');
        setLoading(false);
        return;
      }
      const headers = lines[0].split('\t').map(h => h.trim());
      const dataRows = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split('\t');
        const rowObj: any = {};
        headers.forEach((h, idx) => { rowObj[h] = values[idx]; });
        dataRows.push(rowObj);
      }
      processImportData(dataRows);
      setPasteData('');
    } catch (e) {
      setImportReport('❌ Erro ao processar texto colado.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveFirebase = () => {
    if (!firebaseConfigInput) return;
    // Agora aceita tanto o JSON completo quanto o Token curto
    const success = saveFirebaseConfig(firebaseConfigInput);
    if (!success) {
      alert("Formato inválido! Verifique o código copiado.");
    } else {
      setRestarting(true);
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    }
  };

  const handleDisconnectFirebase = () => {
      setRestarting(true);
      clearFirebaseConfig();
      setTimeout(() => {
        window.location.reload();
      }, 1500);
  };

  const generateShareData = () => {
    const rawConfig = localStorage.getItem('kpi_firebase_config');
    if (!rawConfig) {
        alert("Erro: Configuração não encontrada.");
        return;
    }
    const compressed = compressConfig(rawConfig);
    if (!compressed) {
        alert("Erro ao gerar token.");
        return;
    }
    
    const url = `${window.location.origin}${window.location.pathname}?config=${encodeURIComponent(compressed)}`;
    navigator.clipboard.writeText(url);
    
    setGeneratedToken(compressed);
    
    if (isLocalhost) {
        alert("⚠️ ATENÇÃO: Link copiado, MAS você está em Localhost.\n\nEste link NÃO funcionará para outras pessoas se você não publicar o site primeiro.\n\nLeia o guia 'Como Publicar' na tela.");
    } else {
        alert("Link copiado! Envie para sua equipe.");
    }
  };

  // ... Batch Handlers ...
  const handleBatchManagers = () => { 
      const names = batchManagers.split('\n').map(s => s.trim()).filter(s => s);
      if (!names.length) return;
      const newMgrs = [...data.managers];
      let count = 0;
      names.forEach(name => {
        if (!newMgrs.find(m => normalizeKey(m.name) === normalizeKey(name))) {
          newMgrs.push({ id: generateId('MGR'), name });
          count++;
        }
      });
      onUpdate({ ...data, managers: newMgrs });
      setBatchManagers('');
      alert(`${count} Gestores adicionados.`);
  };
  const handleBatchPerspectives = () => {
      const names = batchPerspectives.split('\n').map(s => s.trim()).filter(s => s);
      if (!names.length) return;
      const newPersps = [...data.perspectives];
      let count = 0;
      names.forEach(name => {
        if (!newPersps.find(p => normalizeKey(p.name) === normalizeKey(name))) {
          newPersps.push({ id: generateId('PERSP'), name });
          count++;
        }
      });
      onUpdate({ ...data, perspectives: newPersps });
      setBatchPerspectives('');
      alert(`${count} Perspectivas adicionadas.`);
  };
  const handleBatchObjectives = () => {
    if (!batchObjTargetPersp) { alert('Selecione uma Perspectiva Pai.'); return; }
    const names = batchObjectives.split('\n').map(s => s.trim()).filter(s => s);
    if (!names.length) return;
    const newObjs = [...data.objectives];
    let count = 0;
    names.forEach(name => {
      if (!newObjs.find(o => normalizeKey(o.name) === normalizeKey(name) && o.perspectiveId === batchObjTargetPersp)) {
        newObjs.push({ id: generateId('OBJ'), name, perspectiveId: batchObjTargetPersp, gestorId: '' });
        count++;
      }
    });
    onUpdate({ ...data, objectives: newObjs });
    setBatchObjectives('');
    alert(`${count} Objetivos adicionados.`);
  };
  const handleBatchIndicators = () => {
    if (!batchIndTargetObj) { alert('Selecione um Objetivo Pai.'); return; }
    const names = batchIndicators.split('\n').map(s => s.trim()).filter(s => s);
    if (!names.length) return;
    const parentObj = data.objectives.find(o => o.id === batchIndTargetObj);
    if (!parentObj) return;
    const newInds = [...data.indicators];
    let count = 0;
    names.forEach(name => {
      if (!newInds.find(i => normalizeKey(i.name) === normalizeKey(name) && i.objetivoId === batchIndTargetObj)) {
        newInds.push({
            id: generateId('IND'), name, objetivoId: batchIndTargetObj, perspectivaId: parentObj.perspectiveId,
            gestorId: batchIndTargetManager || parentObj.gestorId || '', 
            description: '', formula: '', unit: '', source: '', periodicity: '', polarity: '', 
            status: 'draft', updatedAt: new Date().toISOString()
        });
        count++;
      }
    });
    onUpdate({ ...data, indicators: newInds });
    setBatchIndicators('');
    alert(`${count} Indicadores adicionados.`);
  };

  const removeManager = (id: string) => {
    if (data.indicators.some(i => i.gestorId === id)) {
        alert("Não é possível remover: Existem indicadores vinculados a este gestor.");
        return;
    }
    onUpdate({...data, managers: data.managers.filter(x => x.id !== id)});
  };
  const removePerspective = (id: string) => {
      if (data.objectives.some(o => o.perspectiveId === id)) {
          alert("Não é possível remover: Existem objetivos nesta perspectiva.");
          return;
      }
      onUpdate({...data, perspectives: data.perspectives.filter(x => x.id !== id)});
  };

  // --- INDICATOR MANAGEMENT LOGIC ---
  const filteredIndicators = data.indicators.filter(i => 
    i.name.toLowerCase().includes(filterIndSearch.toLowerCase()) || 
    data.managers.find(m => m.id === i.gestorId)?.name.toLowerCase().includes(filterIndSearch.toLowerCase())
  );

  const deleteIndicator = (id: string) => {
    if (!window.confirm("Excluir indicador permanentemente?")) return;
    onUpdate({
        ...data,
        indicators: data.indicators.filter(i => i.id !== id),
        goals: data.goals.filter(g => g.indicatorId !== id)
    });
  };

  const unlockIndicator = (id: string) => {
    const newInds = data.indicators.map(i => i.id === id ? { ...i, status: 'draft' as const } : i);
    onUpdate({ ...data, indicators: newInds });
    alert("Indicador liberado para edição.");
  };

  const startEditingInd = (ind: Indicator) => {
    setEditingIndId(ind.id);
    setEditingIndName(ind.name);
  };

  const saveEditingInd = () => {
    if (!editingIndId || !editingIndName) return;
    const newInds = data.indicators.map(i => i.id === editingIndId ? { ...i, name: editingIndName } : i);
    onUpdate({ ...data, indicators: newInds });
    setEditingIndId(null);
  };

  // --------------------------------------------------------------------------------

  if (restarting) {
      return (
          <div className="fixed inset-0 bg-slate-900 bg-opacity-90 flex flex-col items-center justify-center z-50 text-white">
              <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-purple-500 mb-4"></div>
              <h2 className="text-2xl font-bold mb-2">Reiniciando SISCONGE...</h2>
              <p className="text-slate-300">Aplicando configurações de banco de dados.</p>
          </div>
      );
  }

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-lg shadow-md border border-slate-200">
        <h2 className="text-xl font-bold text-blue-900 mb-4">Acesso Administrativo SISCONGE</h2>
        <div className="mb-4">
          <input
            type="password"
            placeholder="Senha de Admin"
            className="w-full p-2 border rounded"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          />
        </div>
        <Button onClick={handleLogin} className="w-full">Entrar</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <div className="flex justify-between items-center border-b pb-4 bg-white p-4 rounded shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-blue-900 flex items-center gap-2">
            Painel do Administrador
            <span className="text-xs font-normal bg-green-100 text-green-800 px-2 py-1 rounded-full">Logado</span>
            {isOnline ? 
               <span className="text-xs font-normal bg-purple-100 text-purple-800 px-2 py-1 rounded-full animate-pulse">☁️ Online</span> :
               <span className="text-xs font-normal bg-slate-100 text-slate-800 px-2 py-1 rounded-full">💻 Offline</span>
            }
          </h2>
        </div>
        <Button variant="danger" onClick={onClose} size="sm">
          Sair / Fechar Aba
        </Button>
      </div>

      <div className="flex gap-2 border-b border-slate-200 pb-1 overflow-x-auto">
        <button className={`px-4 py-2 text-sm font-bold rounded-t-lg transition-colors whitespace-nowrap ${activeSubTab === 'import' ? 'bg-white border-x border-t border-slate-200 text-blue-700' : 'bg-slate-100 text-slate-500'}`} onClick={() => setActiveSubTab('import')}>📥 Importação</button>
        <button className={`px-4 py-2 text-sm font-bold rounded-t-lg transition-colors whitespace-nowrap ${activeSubTab === 'batch' ? 'bg-white border-x border-t border-slate-200 text-blue-700' : 'bg-slate-100 text-slate-500'}`} onClick={() => setActiveSubTab('batch')}>📑 Cadastro em Lote</button>
        <button className={`px-4 py-2 text-sm font-bold rounded-t-lg transition-colors whitespace-nowrap ${activeSubTab === 'structure' ? 'bg-white border-x border-t border-slate-200 text-blue-700' : 'bg-slate-100 text-slate-500'}`} onClick={() => setActiveSubTab('structure')}>🛠️ Estrutura</button>
        <button className={`px-4 py-2 text-sm font-bold rounded-t-lg transition-colors whitespace-nowrap ${activeSubTab === 'cloud' ? 'bg-purple-50 border-x border-t border-purple-200 text-purple-700' : 'bg-slate-100 text-slate-500'}`} onClick={() => setActiveSubTab('cloud')}>☁️ Conexão Nuvem</button>
        <button className={`px-4 py-2 text-sm font-bold rounded-t-lg transition-colors whitespace-nowrap ${activeSubTab === 'settings' ? 'bg-white border-x border-t border-slate-200 text-blue-700' : 'bg-slate-100 text-slate-500'}`} onClick={() => setActiveSubTab('settings')}>⚙️ Configurações</button>
      </div>

      {activeSubTab === 'settings' && (
        <div className="bg-white p-6 rounded-b-lg shadow-sm border border-t-0 border-slate-200">
           <h3 className="text-lg font-bold text-slate-900 mb-4">Configurações Gerais</h3>
           <div className="max-w-md">
             <label className="block text-sm font-bold text-slate-700 mb-2">Alterar Senha do Administrador</label>
             <div className="flex gap-2">
               <input type="text" className="flex-1 p-2 border rounded" placeholder="Nova senha..." value={newAdminPass} onChange={e => setNewAdminPass(e.target.value)} />
               <Button onClick={changeAdminPassword}>Alterar</Button>
             </div>
           </div>
        </div>
      )}

      {activeSubTab === 'cloud' && (
        <div className="bg-purple-50 p-6 rounded-b-lg shadow-sm border border-t-0 border-purple-200">
           <h3 className="text-lg font-bold text-purple-900 mb-2">Configuração Multi-usuário (Google Firebase)</h3>
           <p className="text-sm text-purple-800 mb-4">
             Conecte-se ao banco de dados para compartilhar informações em tempo real.
           </p>

           {!isOnline ? (
             <div className="bg-white p-4 rounded shadow-sm border border-purple-100">
               <h4 className="font-bold text-slate-700 mb-2">Opção 1: Tenho um Código ou JSON</h4>
               <textarea 
                 className="w-full h-32 border rounded p-2 text-xs font-mono bg-slate-50 mb-2"
                 placeholder={'Cole aqui o código do Firebase ({ apiKey... }) ou o Token curto (Ex: AIzaSyB...$project...)'}
                 value={firebaseConfigInput}
                 onChange={e => setFirebaseConfigInput(e.target.value)}
               />
               <Button onClick={handleSaveFirebase} className="w-full bg-purple-600 hover:bg-purple-700">
                 Conectar
               </Button>
               
               <div className="mt-6 pt-4 border-t">
                  <h4 className="font-bold text-slate-700 mb-2">Opção 2: Primeira Configuração</h4>
                  <p className="text-xs text-slate-600 mb-2">Se você é o administrador e ainda não tem o código, crie um projeto em <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer" className="text-blue-600 underline">console.firebase.google.com</a>.</p>
               </div>
             </div>
           ) : (
             <div className="bg-green-50 p-6 rounded border border-green-200 text-center">
                <div className="text-4xl mb-2">☁️</div>
                <h4 className="font-bold text-green-900 text-lg">Sistema Conectado Online</h4>

                {isLocalhost && (
                    <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800 p-4 text-left my-4 shadow-md">
                        <p className="font-bold text-sm">⚠️ ATENÇÃO: Você está usando "localhost"</p>
                        <p className="text-xs mt-1">
                            Este endereço funciona apenas no <strong>SEU</strong> computador. Se você enviar o link abaixo para um colega, <strong>NÃO FUNCIONARÁ</strong>.
                        </p>
                        <div className="mt-3 text-xs bg-white p-2 rounded border border-yellow-200">
                            <strong>Como resolver:</strong>
                            <ol className="list-decimal pl-4 mt-1 space-y-1">
                                <li>Pare o servidor atual. Execute o comando <code className="bg-slate-100 p-0.5 rounded">npm run build</code>.</li>
                                <li>Isso criará uma pasta chamada <strong>dist</strong> no seu projeto.</li>
                                <li>Arraste essa pasta <strong>dist</strong> para o site <a href="https://app.netlify.com/drop" target="_blank" rel="noreferrer" className="text-blue-600 underline font-bold">Netlify Drop</a> (é grátis).</li>
                                <li>O Netlify criará um link público (ex: <em>sisconge-xyz.netlify.app</em>).</li>
                                <li>Acesse esse novo link, conecte o banco de dados novamente e <strong>Gere o Link de Acesso</strong> por lá.</li>
                            </ol>
                        </div>
                    </div>
                )}

                <div className="p-4 bg-white rounded border border-green-100 text-left max-w-lg mx-auto mb-4 mt-4">
                   <h5 className="font-bold text-green-800 text-sm mb-2">🔗 Distribuir Acesso</h5>
                   <p className="text-xs text-slate-600 mb-3">
                     Clique abaixo para gerar um link que configura automaticamente os computadores da sua equipe.
                   </p>
                   <Button size="sm" onClick={generateShareData} className="w-full mb-2">
                     Gerar Link e Token de Acesso
                   </Button>
                   
                   {generatedToken && (
                       <div className="mt-4 animate-fadeIn">
                           <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Link Gerado (Curto)</label>
                           <p className="text-xs text-blue-600 break-all bg-slate-50 p-2 rounded border mb-2 select-all">
                               {window.location.origin}{window.location.pathname}?config={encodeURIComponent(generatedToken)}
                           </p>

                           <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Token Manual (Alternativo)</label>
                           <textarea 
                             readOnly 
                             className="w-full h-20 text-[10px] font-mono p-2 bg-slate-100 border rounded"
                             value={generatedToken}
                           />
                           <p className="text-[10px] text-slate-400 mt-1">Se o link não funcionar, envie este texto para o usuário colar na caixa "Conexão Nuvem".</p>
                       </div>
                   )}
                </div>
                <Button variant="danger" size="sm" onClick={handleDisconnectFirebase}>
                  Desconectar (Voltar para modo Offline)
                </Button>
             </div>
           )}
        </div>
      )}

      {activeSubTab === 'import' && (
        <div className="bg-white p-6 rounded-b-lg shadow-sm border border-t-0 border-slate-200">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Importação de Dados</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h4 className="font-bold text-blue-900 mb-2">Opção 1: Copiar e Colar</h4>
              <p className="text-xs text-slate-500 mb-2">Copie as colunas do Excel e cole abaixo.</p>
              <textarea className="w-full h-40 border rounded p-2 text-xs font-mono bg-slate-50" placeholder="Cole aqui os dados..." value={pasteData} onChange={e => setPasteData(e.target.value)} />
              <Button onClick={handleTextImport} disabled={loading} className="mt-2 w-full">{loading ? 'Processando...' : 'Processar Texto Colado'}</Button>
            </div>
            <div className="border-l pl-8">
              <h4 className="font-bold text-blue-900 mb-2">Opção 2: Arquivo Excel</h4>
              <p className="text-xs text-slate-500 mb-4">Arquivo .xlsx ou .csv.</p>
              <label className="block w-full cursor-pointer bg-slate-100 border-2 border-dashed border-slate-300 rounded p-6 text-center hover:bg-slate-200">
                 <span className="text-slate-600 font-medium">Clique para selecionar arquivo</span>
                 <input type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={handleFileImport} disabled={loading} />
              </label>
            </div>
          </div>
          {importReport && <div className={`mt-6 p-4 rounded border whitespace-pre-line text-sm ${importReport.includes('❌') ? 'bg-red-50 border-red-200 text-red-800' : 'bg-green-50 border-green-200 text-green-900'}`}>{importReport}</div>}
        </div>
      )}

      {activeSubTab === 'batch' && (
        <div className="bg-white p-6 rounded-b-lg shadow-sm border border-t-0 border-slate-200 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <h4 className="font-bold text-slate-700 mb-2">1. Gestores em Lote</h4>
                    <textarea className="w-full h-24 border rounded p-2 text-sm" value={batchManagers} onChange={e => setBatchManagers(e.target.value)} placeholder="Um por linha"/>
                    <Button size="sm" variant="secondary" onClick={handleBatchManagers} className="mt-2 w-full">Adicionar</Button>
                </div>
                <div>
                    <h4 className="font-bold text-slate-700 mb-2">2. Perspectivas em Lote</h4>
                    <textarea className="w-full h-24 border rounded p-2 text-sm" value={batchPerspectives} onChange={e => setBatchPerspectives(e.target.value)} placeholder="Uma por linha"/>
                    <Button size="sm" variant="secondary" onClick={handleBatchPerspectives} className="mt-2 w-full">Adicionar</Button>
                </div>
            </div>
            <hr className="border-slate-200"/>
            <div>
                <h4 className="font-bold text-slate-700 mb-2">3. Vincular Objetivos</h4>
                <div className="flex gap-4">
                    <select className="border p-2 rounded text-sm w-1/3" value={batchObjTargetPersp} onChange={e => setBatchObjTargetPersp(e.target.value)}>
                        <option value="">Selecione Perspectiva...</option>
                        {data.perspectives.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <div className="flex-1">
                        <textarea className="w-full h-20 border rounded p-2 text-sm" value={batchObjectives} onChange={e => setBatchObjectives(e.target.value)} placeholder="Objetivos (um por linha)"/>
                        <Button size="sm" variant="secondary" onClick={handleBatchObjectives} className="mt-2">Adicionar</Button>
                    </div>
                </div>
            </div>
            <hr className="border-slate-200"/>
            <div>
                <h4 className="font-bold text-slate-700 mb-2">4. Vincular Indicadores</h4>
                <div className="flex gap-4 mb-2">
                    <select className="border p-2 rounded text-sm w-1/3" value={batchIndTargetObj} onChange={e => setBatchIndTargetObj(e.target.value)}>
                        <option value="">Selecione Objetivo...</option>
                        {data.objectives.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                    <select className="border p-2 rounded text-sm w-1/3" value={batchIndTargetManager} onChange={e => setBatchIndTargetManager(e.target.value)}>
                        <option value="">Selecione Gestor (Opcional)...</option>
                        {data.managers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                </div>
                <textarea className="w-full h-20 border rounded p-2 text-sm" value={batchIndicators} onChange={e => setBatchIndicators(e.target.value)} placeholder="Indicadores (um por linha)"/>
                <Button size="sm" variant="secondary" onClick={handleBatchIndicators} className="mt-2">Adicionar</Button>
            </div>
        </div>
      )}

      {activeSubTab === 'structure' && (
        <div className="bg-white p-6 rounded-b-lg shadow-sm border border-t-0 border-slate-200 space-y-8">
            <div>
                <h3 className="text-lg font-bold text-blue-900 border-b pb-2 mb-4">Gestão de Indicadores Cadastrados</h3>
                <div className="mb-4">
                  <input placeholder="🔍 Buscar por nome do indicador ou gestor..." className="w-full p-2 border rounded" value={filterIndSearch} onChange={e => setFilterIndSearch(e.target.value)} />
                </div>
                <div className="border rounded max-h-[400px] overflow-y-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-100 text-slate-700 sticky top-0">
                      <tr><th className="px-3 py-2">Indicador</th><th className="px-3 py-2">Gestor</th><th className="px-3 py-2">Status</th><th className="px-3 py-2 text-right">Ações</th></tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredIndicators.map(ind => (
                        <tr key={ind.id} className="hover:bg-slate-50">
                          <td className="px-3 py-2">
                            {editingIndId === ind.id ? (
                                <div className="flex gap-1"><input className="border p-1 rounded text-xs flex-1" value={editingIndName} onChange={e => setEditingIndName(e.target.value)} /><button onClick={saveEditingInd} className="text-green-600 font-bold">OK</button><button onClick={() => setEditingIndId(null)} className="text-slate-400">X</button></div>
                            ) : <span className="font-medium text-slate-800">{ind.name}</span>}
                            <div className="text-xs text-slate-400">{data.objectives.find(o => o.id === ind.objetivoId)?.name}</div>
                          </td>
                          <td className="px-3 py-2 text-slate-600">{data.managers.find(m => m.id === ind.gestorId)?.name || '-'}</td>
                          <td className="px-3 py-2"><span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${ind.status === 'final' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{ind.status === 'final' ? 'Final' : 'Rascunho'}</span></td>
                          <td className="px-3 py-2 text-right space-x-2">
                             {ind.status === 'final' && <Button size="sm" variant="secondary" onClick={() => unlockIndicator(ind.id)} title="Liberar Edição">🔓 Liberar</Button>}
                             <button onClick={() => startEditingInd(ind)} className="text-blue-600 hover:underline text-xs">Editar Nome</button>
                             <button onClick={() => deleteIndicator(ind.id)} className="text-red-600 hover:underline text-xs">Excluir</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t pt-6">
                <div>
                    <h3 className="font-bold text-lg mb-4 text-slate-700">Gestores</h3>
                    <div className="flex gap-2 mb-2"><input className="flex-1 border p-2 rounded text-sm" placeholder="Nome" value={newManager} onChange={e => setNewManager(e.target.value)} /><Button size="sm" onClick={() => { if(!newManager) return; onUpdate({ ...data, managers: [...data.managers, { id: generateId('MGR'), name: newManager }] }); setNewManager(''); }}>Add</Button></div>
                    <div className="max-h-60 overflow-y-auto border rounded p-2 text-sm bg-slate-50">{data.managers.map(m => <div key={m.id} className="flex justify-between py-1 border-b last:border-0"><span>{m.name}</span><button className="text-red-500 text-xs hover:underline" onClick={() => removeManager(m.id)}>Excluir</button></div>)}</div>
                </div>
                <div>
                    <h3 className="font-bold text-lg mb-4 text-slate-700">Perspectivas</h3>
                    <div className="flex gap-2 mb-2"><input className="flex-1 border p-2 rounded text-sm" placeholder="Nome" value={newPerspective} onChange={e => setNewPerspective(e.target.value)} /><Button size="sm" onClick={() => { if(!newPerspective) return; onUpdate({ ...data, perspectives: [...data.perspectives, { id: generateId('PERSP'), name: newPerspective }] }); setNewPerspective(''); }}>Add</Button></div>
                    <div className="max-h-60 overflow-y-auto border rounded p-2 text-sm bg-slate-50">{data.perspectives.map(p => <div key={p.id} className="flex justify-between py-1 border-b last:border-0"><span>{p.name}</span><button className="text-red-500 text-xs hover:underline" onClick={() => removePerspective(p.id)}>Excluir</button></div>)}</div>
                </div>
            </div>
        </div>
      )}

    </div>
  );
};