import React, { useState, useEffect } from 'react';
import { AdminPanel } from './components/AdminPanel';
import { ManagerPanel } from './components/ManagerPanel';
import { ResultsPanel } from './components/ResultsPanel';
import { GoalsPanel } from './components/GoalsPanel';
import { Logo } from './components/ui/Logo';
import { AppData, INITIAL_DATA, User } from './types';
import { apiService, setNotificationHandler } from './services/apiService';
import { NotificationToast, NotificationType } from './components/ui/NotificationToast';
import { PasswordInput } from './components/ui/PasswordInput';
import { Button } from './components/ui/Button';

enum Tab {
  MANAGER = 'manager',
  GOALS = 'goals',
  ADMIN = 'admin',
  RESULTS = 'results',
  GUIDE = 'guide'
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.MANAGER);
  const [appData, setAppData] = useState<AppData>(INITIAL_DATA);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  // Login State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Notification State
  const [notification, setNotification] = useState<{msg: string, type: NotificationType} | null>(null);

  useEffect(() => {
    // Configura o handler global de notificações
    setNotificationHandler((msg: string, type: NotificationType) => {
      setNotification({ msg, type });
    });

    // Check Local Storage for session
    const savedUser = localStorage.getItem('sisconge_user');
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser));
      loadData();
    }
  }, []);

  const loadData = async () => {
    const data = await apiService.loadFullData();
    setAppData(data);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    try {
      const user = await apiService.login(loginEmail, loginPass);
      setCurrentUser(user);
      localStorage.setItem('sisconge_user', JSON.stringify(user));
      await loadData();
    } catch (error) {
      // Notification handled by apiService
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('sisconge_user');
    setCurrentUser(null);
    setAppData(INITIAL_DATA);
    setLoginEmail('');
    setLoginPass('');
  };

  // Generic Update Handler (Optimistic UI + API Call)
  const handleUpdate = async (newData: AppData, section: 'structure' | 'indicators' | 'goals' | 'users') => {
    if (!currentUser) return;
    
    // Optimistic Update
    setAppData(newData);

    // API Sync
    switch (section) {
      case 'structure':
        await apiService.saveStructure(newData, currentUser);
        break;
      case 'indicators':
        await apiService.saveIndicators(newData.indicators, currentUser);
        break;
      case 'goals':
        await apiService.saveGoals(newData.goals, currentUser);
        // Indicators are also updated when goals change (meta config), so save them too
        await apiService.saveIndicators(newData.indicators, currentUser);
        break;
      case 'users':
        await apiService.saveUsers(newData.users, currentUser);
        break;
    }
  };

  const navItemClass = (tab: Tab) => `
    flex-1 py-4 text-xs md:text-sm font-bold uppercase tracking-wide transition-colors text-center border-b-4
    ${activeTab === tab 
      ? 'bg-slate-50 text-blue-900 border-blue-600' 
      : 'bg-blue-900 text-blue-200 hover:bg-blue-800 hover:text-white border-transparent'}
  `;

  // --- LOGIN SCREEN ---
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 to-slate-900 flex items-center justify-center p-4">
        {notification && (
          <NotificationToast 
            message={notification.msg} 
            type={notification.type} 
            onClose={() => setNotification(null)} 
          />
        )}
        <div className="bg-white rounded-lg shadow-2xl p-8 max-w-md w-full">
           <div className="flex justify-center mb-6">
             <div className="bg-blue-900 p-4 rounded-xl shadow-lg">
                <Logo className="w-12 h-12 text-white" />
             </div>
           </div>
           <h1 className="text-2xl font-bold text-center text-slate-800 mb-1">SISCONGE</h1>
           <p className="text-center text-slate-500 text-sm mb-8">Sistema de Contrato de Gestão</p>
           
           <form onSubmit={handleLogin} className="space-y-4">
             <div>
               <label className="block text-xs font-bold text-slate-600 mb-1 uppercase">E-mail</label>
               <input 
                 type="email" 
                 required
                 className="w-full p-3 border rounded-lg bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none"
                 value={loginEmail} 
                 onChange={e => setLoginEmail(e.target.value)}
                 placeholder="seu@email.com"
               />
             </div>
             <div>
               <label className="block text-xs font-bold text-slate-600 mb-1 uppercase">Senha</label>
               <PasswordInput 
                 required
                 className="bg-slate-50"
                 value={loginPass}
                 onChange={e => setLoginPass(e.target.value)}
                 placeholder="••••••"
               />
             </div>
             <Button className="w-full py-3 text-base shadow-lg" disabled={isLoggingIn}>
               {isLoggingIn ? 'Entrando...' : 'Acessar Sistema'}
             </Button>
           </form>
           <p className="text-xs text-center text-slate-400 mt-6">
             v2.0 Distributed • Google Sheets Database
           </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {notification && (
        <NotificationToast 
          message={notification.msg} 
          type={notification.type} 
          onClose={() => setNotification(null)} 
        />
      )}

      <header className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-6 shadow-xl flex items-center gap-4">
        <div className="bg-white/10 p-3 rounded-lg shadow-inner">
           <Logo className="w-10 h-10 text-white" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl md:text-2xl font-extrabold tracking-tight uppercase">SISTEMA CONTRATO DE GESTÃO</h1>
            <span className="bg-emerald-500/20 border border-emerald-400/50 text-emerald-100 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
               <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
               ONLINE
            </span>
          </div>
          <p className="text-blue-200 text-sm mt-0.5 opacity-90 font-light">
             Olá, <strong>{currentUser.nome}</strong> ({currentUser.perfil})
          </p>
        </div>
        <Button variant="danger" size="sm" onClick={handleLogout} className="bg-white/10 hover:bg-white/20 border border-white/20">
          Sair <i className="ph ph-sign-out ml-1"></i>
        </Button>
      </header>

      <nav className="flex shadow-md sticky top-0 z-20 bg-blue-900 overflow-x-auto">
        <button onClick={() => setActiveTab(Tab.MANAGER)} className={navItemClass(Tab.MANAGER)}>Ficha Técnica</button>
        <button onClick={() => setActiveTab(Tab.GOALS)} className={navItemClass(Tab.GOALS)}>Metas</button>
        <button onClick={() => setActiveTab(Tab.RESULTS)} className={navItemClass(Tab.RESULTS)}>Resultados</button>
        <button onClick={() => setActiveTab(Tab.ADMIN)} className={navItemClass(Tab.ADMIN)}>Admin</button>
        <button onClick={() => setActiveTab(Tab.GUIDE)} className={navItemClass(Tab.GUIDE)}>Orientações</button>
      </nav>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8">
        {activeTab === Tab.MANAGER && (
          <ManagerPanel data={appData} onUpdate={(d) => handleUpdate(d, 'indicators')} />
        )}
        
        {activeTab === Tab.GOALS && (
          <GoalsPanel data={appData} onUpdate={(d) => handleUpdate(d, 'goals')} />
        )}
        
        {activeTab === Tab.ADMIN && (
          <AdminPanel 
            data={appData} 
            user={currentUser}
            onUpdate={handleUpdate} 
          />
        )}

        {activeTab === Tab.RESULTS && (
          <ResultsPanel data={appData} />
        )}

        {activeTab === Tab.GUIDE && (
          <div className="bg-white p-8 rounded-lg shadow-sm border border-slate-200 prose max-w-none text-slate-600">
            <h2 className="text-2xl font-bold text-blue-900 mb-6 flex items-center gap-2 border-b pb-4">
              <Logo className="w-6 h-6" /> Manual de Orientações v2.0
            </h2>
            
            <div className="p-4 bg-blue-50 border-l-4 border-blue-500 rounded mb-6 text-sm text-blue-800 shadow-sm">
               <h4 className="font-bold mb-1 flex items-center gap-2"><i className="ph ph-cloud-check text-lg"></i> Sistema Conectado</h4>
               <p>O SISCONGE v2.0 opera em nuvem. Todos os dados são salvos automaticamente no banco de dados institucional (Google Sheets). Não é necessário salvar arquivos localmente.</p>
            </div>

            <h3 className="text-lg font-bold text-slate-800 mt-6 mb-2">Perfis de Acesso</h3>
            <ul className="list-disc pl-5 mb-4 space-y-1">
                <li><strong>LEITOR:</strong> Apenas visualiza os resultados e relatórios.</li>
                <li><strong>EDITOR:</strong> Pode preencher metas e realizar apontamentos de resultados.</li>
                <li><strong>ADMIN:</strong> Gerencia estrutura (indicadores, gestores), usuários e configurações.</li>
            </ul>

            <h3 className="text-lg font-bold text-slate-800 mt-6 mb-2">Como usar</h3>
            <ol className="list-decimal pl-5 mb-4 space-y-2">
                <li><strong>Ficha Técnica:</strong> Consulte os detalhes de cada indicador.</li>
                <li><strong>Metas:</strong> Defina as metas mensais (apenas Editores/Admins).</li>
                <li><strong>Resultados:</strong> Acompanhe o desempenho consolidado e exporte relatórios Excel.</li>
            </ol>
            
            <div className="mt-8 pt-4 border-t text-xs text-slate-400">
               <p>Status da Conexão: <span className="text-green-600 font-bold">● Ativa</span></p>
               <p>Em caso de falhas, o sistema notificará automaticamente.</p>
            </div>
          </div>
        )}
      </main>

      <footer className="bg-slate-900 text-slate-400 p-6 text-center text-xs border-t border-slate-800">
        <div className="flex items-center justify-center gap-2 mb-2 opacity-50">
           <Logo className="w-4 h-4" />
           <span className="font-bold tracking-widest uppercase">SISCONGE</span>
        </div>
        &copy; {new Date().getFullYear()} Todos os direitos reservados.
      </footer>
    </div>
  );
}