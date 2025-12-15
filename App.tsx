import React, { useState, useEffect } from 'react';
import { AdminPanel } from './components/AdminPanel';
import { ManagerPanel } from './components/ManagerPanel';
import { ResultsPanel } from './components/ResultsPanel';
import { GoalsPanel } from './components/GoalsPanel';
import { VisionCanvas } from './components/VisionCanvas';
import { Logo } from './components/ui/Logo';
import { AppData, INITIAL_DATA, User } from './types';
import { apiService, setNotificationHandler } from './services/apiService';
import { NotificationToast, NotificationType } from './components/ui/NotificationToast';
import { Button } from './components/ui/Button';

enum Tab {
  VISION = 'vision', // Nova aba
  MANAGER = 'manager',
  GOALS = 'goals',
  ADMIN = 'admin',
  RESULTS = 'results',
  GUIDE = 'guide'
}

// Usuário padrão com permissão total para acesso direto sem login
const DEFAULT_USER: User = {
  email: 'admin@sistema.com',
  nome: 'Administrador',
  perfil: 'ADMIN',
  ativo: true
};

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.VISION); // Inicia na Visão
  const [appData, setAppData] = useState<AppData>(INITIAL_DATA);
  
  // Define o usuário padrão imediatamente (Autologin)
  const [currentUser, setCurrentUser] = useState<User>(DEFAULT_USER);
  
  // Notification State
  const [notification, setNotification] = useState<{msg: string, type: NotificationType} | null>(null);

  useEffect(() => {
    // Configura o handler global de notificações
    setNotificationHandler((msg: string, type: NotificationType) => {
      setNotification({ msg, type });
    });

    // Carrega dados iniciais automaticamente
    loadData();
  }, []);

  const loadData = async () => {
    const data = await apiService.loadFullData();
    setAppData(data);
  };

  // Generic Update Handler (Optimistic UI + API Call)
  const handleUpdate = async (newData: AppData, section: 'structure' | 'indicators' | 'goals' | 'users' | 'vision') => {
    if (!currentUser) return;
    
    // Optimistic Update
    setAppData(newData);

    // API Sync
    switch (section) {
      case 'vision':
        await apiService.saveVision(newData.identity, newData.visionLine, currentUser);
        break;
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

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {notification && (
        <NotificationToast 
          message={notification.msg} 
          type={notification.type} 
          onClose={() => setNotification(null)} 
        />
      )}

      {/* HEADER ATUALIZADO */}
      <header className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-4 shadow-xl z-30">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-4 md:gap-6">
          
          {/* 1. Identidade do SISTEMA (Fixa) */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="bg-white/10 p-2 rounded-lg shadow-inner">
               <Logo className="w-8 h-8 text-white" />
            </div>
            <div>
               <h1 className="text-lg font-extrabold tracking-tight uppercase leading-none">SISCONGE</h1>
               <span className="text-[10px] text-blue-200 font-light tracking-widest uppercase block">
                 Sistema Contrato de Gestão
               </span>
            </div>
          </div>

          {/* 2. Divisor e Identidade da EMPRESA (Dinâmica) */}
          {(appData.identity.companyName || appData.identity.logoUrl) && (
            <>
              <div className="hidden md:block w-px h-10 bg-blue-400/30 mx-2"></div>
              
              <div className="flex items-center gap-4 flex-1 justify-center md:justify-start">
                 {appData.identity.logoUrl && (
                   <img 
                      src={appData.identity.logoUrl} 
                      alt="Logo Empresa" 
                      className="h-12 w-auto max-w-[150px] object-contain bg-white rounded-md p-1 shadow-md" 
                   />
                 )}
                 {appData.identity.companyName && (
                   <h2 className="text-xl md:text-2xl font-bold uppercase tracking-tight text-white drop-shadow-sm">
                     {appData.identity.companyName}
                   </h2>
                 )}
              </div>
            </>
          )}

          {/* Informações de usuário removidas conforme solicitado */}

        </div>
      </header>

      <nav className="flex shadow-md sticky top-0 z-20 bg-blue-900 overflow-x-auto">
        <button onClick={() => setActiveTab(Tab.VISION)} className={navItemClass(Tab.VISION)}>Visão de Futuro</button>
        <button onClick={() => setActiveTab(Tab.MANAGER)} className={navItemClass(Tab.MANAGER)}>Ficha Técnica</button>
        <button onClick={() => setActiveTab(Tab.GOALS)} className={navItemClass(Tab.GOALS)}>Metas</button>
        <button onClick={() => setActiveTab(Tab.RESULTS)} className={navItemClass(Tab.RESULTS)}>Resultados</button>
        <button onClick={() => setActiveTab(Tab.ADMIN)} className={navItemClass(Tab.ADMIN)}>Admin</button>
        <button onClick={() => setActiveTab(Tab.GUIDE)} className={navItemClass(Tab.GUIDE)}>Orientações</button>
      </nav>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8">
        
        {activeTab === Tab.VISION && (
          <VisionCanvas data={appData} onUpdate={(d) => handleUpdate(d, 'vision')} />
        )}

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
               <p>O SISCONGE v2.0 opera em nuvem. Todos os dados são salvos automaticamente no banco de dados institucional (Google Sheets).</p>
            </div>

            <h3 className="text-lg font-bold text-slate-800 mt-6 mb-2">Modo Administrativo</h3>
            <p className="text-sm">
              O sistema está operando em modo de acesso direto. Todas as funcionalidades de edição e administração estão liberadas.
            </p>

            <h3 className="text-lg font-bold text-slate-800 mt-6 mb-2">Como usar</h3>
            <ol className="list-decimal pl-5 mb-4 space-y-2">
                <li><strong>Visão de Futuro:</strong> Defina a identidade da empresa e a linha do tempo estratégica.</li>
                <li><strong>Ficha Técnica:</strong> Consulte e edite os detalhes de cada indicador (Unidade, Polaridade, etc).</li>
                <li><strong>Metas:</strong> Defina as metas mensais ou importe via Excel.</li>
                <li><strong>Resultados:</strong> Acompanhe o desempenho consolidado e exporte relatórios Excel.</li>
                <li><strong>Admin:</strong> Importe planilhas de estrutura ou cadastre manualmente.</li>
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