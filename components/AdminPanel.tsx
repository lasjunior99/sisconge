import React, { useState } from 'react';
import { AppData, User } from '../types';
import { Button } from './ui/Button';
import { PasswordInput } from './ui/PasswordInput';
import { excelParser } from '../services/apiService';

interface AdminPanelProps {
  data: AppData;
  user: User;
  onUpdate: (newData: AppData, section: any) => void;
}

type TabMode = 'structure' | 'import' | 'users';

export const AdminPanel: React.FC<AdminPanelProps> = ({ 
  data, 
  user,
  onUpdate 
}) => {
  const [activeSubTab, setActiveSubTab] = useState<TabMode>('import');
  
  // --- States for Manual Structure ---
  const [newManager, setNewManager] = useState('');
  const [newPerspective, setNewPerspective] = useState('');
  
  // --- States for Import ---
  const [importReport, setImportReport] = useState<string | null>(null);

  // --- States for User Management ---
  const [newUser, setNewUser] = useState<Partial<User>>({ perfil: 'LEITOR', ativo: true });

  const generateId = (prefix: string) => `${prefix}-` + Math.random().toString(36).substr(2, 9).toUpperCase();
  const normalizeKey = (str: string) => String(str).normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

  // --- ACCESS CONTROL ---
  if (user.perfil !== 'ADMIN') {
    return (
      <div className="p-10 text-center bg-white rounded shadow text-slate-500">
         <i className="ph ph-lock-key text-4xl mb-2"></i>
         <h2 className="text-xl font-bold">Acesso Restrito</h2>
         <p>Apenas administradores podem acessar este painel.</p>
      </div>
    );
  }

  // --- USER HANDLERS ---
  const handleAddUser = () => {
    if (!newUser.email || !newUser.nome || !newUser.senha) {
       alert("Preencha todos os campos obrigatórios.");
       return;
    }
    const updatedUsers = [...data.users, newUser as User];
    onUpdate({ ...data, users: updatedUsers }, 'users');
    setNewUser({ perfil: 'LEITOR', ativo: true, nome: '', email: '', senha: '' });
  };

  const handleDeleteUser = (email: string) => {
    if (email === user.email) { alert("Você não pode excluir a si mesmo."); return; }
    if (!confirm("Excluir usuário?")) return;
    const updatedUsers = data.users.filter(u => u.email !== email);
    onUpdate({ ...data, users: updatedUsers }, 'users');
  };

  // --- IMPORT LOGIC ---
  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    try {
      const rows = await excelParser.parse(e.target.files[0]);
      processImportData(rows);
    } catch (err) {
      alert("Erro ao ler arquivo.");
    }
    e.target.value = '';
  };

  const processImportData = (rows: any[]) => {
    // Mesma lógica de processamento, adaptada para chamar onUpdate com 'structure' e 'indicators'
    let newPerspectives = [...data.perspectives];
    let newManagers = [...data.managers];
    let newObjectives = [...data.objectives];
    let newIndicators = [...data.indicators];
    let stats = { p: 0, o: 0, i: 0, m: 0 };

    rows.forEach((rawRow: any) => {
      const row: any = {};
      Object.keys(rawRow).forEach(key => row[normalizeKey(key)] = rawRow[key]);

      const getVal = (aliases: string[]) => {
        for (const alias of aliases) if (row[alias]) return String(row[alias]).trim();
        return '';
      };

      const perspName = getVal(['perspectiva', 'perspective']);
      const objName = getVal(['objetivo', 'objective']);
      const indName = getVal(['indicador', 'indicator']);
      const gestorName = getVal(['gestor', 'manager']);

      if (!perspName || !objName || !indName) return;

      let persp = newPerspectives.find(p => normalizeKey(p.name) === normalizeKey(perspName));
      if (!persp) { persp = { id: generateId('PERSP'), name: perspName }; newPerspectives.push(persp); stats.p++; }

      let managerId = '';
      if (gestorName) {
          let manager = newManagers.find(m => normalizeKey(m.name) === normalizeKey(gestorName));
          if (!manager) { manager = { id: generateId('MGR'), name: gestorName }; newManagers.push(manager); stats.m++; }
          managerId = manager.id;
      }

      let obj = newObjectives.find(o => normalizeKey(o.name) === normalizeKey(objName) && o.perspectiveId === persp!.id);
      if (!obj) { obj = { id: generateId('OBJ'), name: objName, perspectiveId: persp!.id, gestorId: managerId }; newObjectives.push(obj); stats.o++; }

      let ind = newIndicators.find(i => normalizeKey(i.name) === normalizeKey(indName) && i.objetivoId === obj!.id);
      if (!ind) {
        ind = {
          id: generateId('IND'), name: indName, perspectivaId: persp!.id, objetivoId: obj!.id, gestorId: managerId,
          description: '', formula: '', unit: '', source: '', periodicity: '', polarity: '', status: 'draft', updatedAt: new Date().toISOString()
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
    }, 'structure'); // Salva estrutura

    // Atualiza indicadores separadamente
    setTimeout(() => {
        onUpdate({ ...data, indicators: newIndicators } as AppData, 'indicators');
    }, 1000);
    
    setImportReport(`Importação: ${stats.p} Persp, ${stats.o} Obj, ${stats.i} Ind, ${stats.m} Gestores.`);
  };

  const removeManager = (id: string) => {
      const newData = {...data, managers: data.managers.filter(x => x.id !== id)};
      onUpdate(newData, 'structure');
  };
  const removePerspective = (id: string) => {
      const newData = {...data, perspectives: data.perspectives.filter(x => x.id !== id)};
      onUpdate(newData, 'structure');
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex justify-between items-center border-b pb-4 bg-white p-4 rounded shadow-sm">
        <h2 className="text-2xl font-bold text-blue-900 flex items-center gap-2">
            Painel do Administrador
        </h2>
      </div>

      <div className="flex gap-2 border-b border-slate-200 pb-1 overflow-x-auto">
        <button className={`px-4 py-2 text-sm font-bold rounded-t-lg transition-colors ${activeSubTab === 'import' ? 'bg-white border-x border-t text-blue-700' : 'bg-slate-100 text-slate-500'}`} onClick={() => setActiveSubTab('import')}>📥 Importação</button>
        <button className={`px-4 py-2 text-sm font-bold rounded-t-lg transition-colors ${activeSubTab === 'structure' ? 'bg-white border-x border-t text-blue-700' : 'bg-slate-100 text-slate-500'}`} onClick={() => setActiveSubTab('structure')}>🛠️ Estrutura</button>
        <button className={`px-4 py-2 text-sm font-bold rounded-t-lg transition-colors ${activeSubTab === 'users' ? 'bg-white border-x border-t text-blue-700' : 'bg-slate-100 text-slate-500'}`} onClick={() => setActiveSubTab('users')}>👥 Usuários</button>
      </div>

      {activeSubTab === 'users' && (
          <div className="bg-white p-6 rounded-b-lg shadow-sm border border-t-0 border-slate-200">
              <h3 className="font-bold text-lg mb-4 text-slate-800">Gerenciar Usuários</h3>
              
              <div className="bg-slate-50 p-4 rounded border mb-6 grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                  <div className="md:col-span-1">
                      <label className="text-xs font-bold block mb-1">Nome</label>
                      <input className="w-full p-2 border rounded text-sm" value={newUser.nome || ''} onChange={e => setNewUser({...newUser, nome: e.target.value})} />
                  </div>
                  <div className="md:col-span-1">
                      <label className="text-xs font-bold block mb-1">E-mail</label>
                      <input className="w-full p-2 border rounded text-sm" value={newUser.email || ''} onChange={e => setNewUser({...newUser, email: e.target.value})} />
                  </div>
                  <div className="md:col-span-1">
                      <label className="text-xs font-bold block mb-1">Senha</label>
                      <PasswordInput className="text-sm" value={newUser.senha || ''} onChange={e => setNewUser({...newUser, senha: e.target.value})} />
                  </div>
                  <div className="md:col-span-1">
                      <label className="text-xs font-bold block mb-1">Perfil</label>
                      <select className="w-full p-2 border rounded text-sm" value={newUser.perfil} onChange={e => setNewUser({...newUser, perfil: e.target.value as any})}>
                          <option value="LEITOR">Leitor</option>
                          <option value="EDITOR">Editor</option>
                          <option value="ADMIN">Admin</option>
                      </select>
                  </div>
                  <Button onClick={handleAddUser} size="sm">Adicionar</Button>
              </div>

              <div className="border rounded overflow-hidden">
                  <table className="w-full text-sm text-left">
                      <thead className="bg-slate-100 font-bold text-slate-700">
                          <tr>
                              <th className="p-3">Nome</th>
                              <th className="p-3">E-mail</th>
                              <th className="p-3">Perfil</th>
                              <th className="p-3 text-right">Ações</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y">
                          {data.users.map((u, i) => (
                              <tr key={i} className="hover:bg-slate-50">
                                  <td className="p-3">{u.nome}</td>
                                  <td className="p-3">{u.email}</td>
                                  <td className="p-3"><span className="text-xs bg-slate-200 px-2 py-1 rounded font-bold">{u.perfil}</span></td>
                                  <td className="p-3 text-right">
                                      <button onClick={() => handleDeleteUser(u.email)} className="text-red-600 hover:underline text-xs font-bold">Excluir</button>
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {activeSubTab === 'import' && (
        <div className="bg-white p-6 rounded-b-lg shadow-sm border border-t-0 border-slate-200">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Importação via Planilha</h3>
          <p className="text-sm text-slate-600 mb-4">Selecione um arquivo Excel contendo as colunas: Perspectiva, Objetivo, Indicador e Gestor.</p>
          <input type="file" accept=".xlsx" onChange={handleFileImport} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/>
          {importReport && <div className="mt-4 p-4 bg-green-50 text-green-800 rounded border border-green-200 text-sm">{importReport}</div>}
        </div>
      )}

      {activeSubTab === 'structure' && (
        <div className="bg-white p-6 rounded-b-lg shadow-sm border border-t-0 border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
                <h3 className="font-bold text-lg mb-4 text-slate-700">Gestores</h3>
                <div className="flex gap-2 mb-2"><input className="flex-1 border p-2 rounded text-sm" placeholder="Nome" value={newManager} onChange={e => setNewManager(e.target.value)} /><Button size="sm" onClick={() => { if(!newManager) return; onUpdate({ ...data, managers: [...data.managers, { id: generateId('MGR'), name: newManager }] }, 'structure'); setNewManager(''); }}>Add</Button></div>
                <div className="max-h-60 overflow-y-auto border rounded p-2 text-sm bg-slate-50">{data.managers.map(m => <div key={m.id} className="flex justify-between py-1 border-b last:border-0"><span>{m.name}</span><button className="text-red-500 text-xs hover:underline" onClick={() => removeManager(m.id)}>Excluir</button></div>)}</div>
            </div>
            <div>
                <h3 className="font-bold text-lg mb-4 text-slate-700">Perspectivas</h3>
                <div className="flex gap-2 mb-2"><input className="flex-1 border p-2 rounded text-sm" placeholder="Nome" value={newPerspective} onChange={e => setNewPerspective(e.target.value)} /><Button size="sm" onClick={() => { if(!newPerspective) return; onUpdate({ ...data, perspectives: [...data.perspectives, { id: generateId('PERSP'), name: newPerspective }] }, 'structure'); setNewPerspective(''); }}>Add</Button></div>
                <div className="max-h-60 overflow-y-auto border rounded p-2 text-sm bg-slate-50">{data.perspectives.map(p => <div key={p.id} className="flex justify-between py-1 border-b last:border-0"><span>{p.name}</span><button className="text-red-500 text-xs hover:underline" onClick={() => removePerspective(p.id)}>Excluir</button></div>)}</div>
            </div>
        </div>
      )}
    </div>
  );
};