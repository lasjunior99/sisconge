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
import { PasswordInput } from './components/ui/PasswordInput';

enum Tab {
  VISION = 'vision',
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
  const [activeTab, setActiveTab] = useState<Tab>(Tab.VISION);
  const [appData, setAppData] = useState<AppData>(INITIAL_DATA);
  
  // Controle de Bloqueio do Admin
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [adminPassInput, setAdminPassInput] = useState('');
  
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
  const handleUpdate = async (newData: AppData, section: 'structure' | 'indicators' | 'goals' | 'users' | 'vision' | 'settings') => {
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
        await apiService.saveIndicators(newData.indicators, currentUser);
        break;
      case 'users':
        await apiService.saveUsers(newData.users, currentUser);
        break;
      case 'settings':
        // Save both password and global settings if they exist
        const settingsPayload: any = {};
        if (newData.adminPassword) settingsPayload.adminPassword = newData.adminPassword;
        if (newData.globalSettings) settingsPayload.globalSettings = newData.globalSettings;
        
        await apiService.saveAdminSettings(settingsPayload, currentUser);
        break;
    }
  };

  const attemptAdminUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    // Verifica se a senha bate com a salva (ou o padrão 123456)
    const validPass = appData.adminPassword || '123456';
    if (adminPassInput === validPass) {
        setAdminUnlocked(true);
        setAdminPassInput('');
    } else {
        setNotification({ msg: "Senha incorreta.", type: 'error' });
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
          <>
            {!adminUnlocked ? (
              <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
                  <div className="bg-white p-8 rounded-lg shadow-lg border border-slate-200 max-w-md w-full text-center">
                      <div className="bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
                          <i className="ph ph-lock-key text-3xl"></i>
                      </div>
                      <h2 className="text-2xl font-bold text-slate-800 mb-2">Acesso Restrito</h2>
                      <p className="text-slate-500 mb-6 text-sm">Esta área é exclusiva para administradores do sistema.</p>
                      
                      <form onSubmit={attemptAdminUnlock} className="space-y-4">
                          <PasswordInput 
                             placeholder="Senha de Acesso" 
                             value={adminPassInput}
                             onChange={e => setAdminPassInput(e.target.value)}
                             autoFocus
                          />
                          <Button type="submit" className="w-full">
                             <i className="ph ph-sign-in"></i> Entrar no Painel
                          </Button>
                      </form>
                      <p className="text-xs text-slate-400 mt-4">Senha provisória padrão: <strong>123456</strong></p>
                  </div>
              </div>
            ) : (
              <AdminPanel 
                data={appData} 
                user={currentUser}
                onUpdate={handleUpdate} 
                onClose={() => setAdminUnlocked(false)}
              />
            )}
          </>
        )}

        {activeTab === Tab.RESULTS && (
          <ResultsPanel data={appData} />
        )}

        {activeTab === Tab.GUIDE && (
          <div className="bg-white p-8 rounded-lg shadow-sm border border-slate-200 prose max-w-none text-slate-600">
            <h2 className="text-2xl font-bold text-blue-900 mb-6 flex items-center gap-2 border-b pb-4">
              <Logo className="w-6 h-6" /> Manual de Orientações do Usuário
            </h2>
            
            <p className="lead text-lg text-slate-700">
              Bem-vindo ao <strong>SISCONGE</strong>. Este sistema foi desenhado para facilitar a gestão estratégica e o acompanhamento de indicadores de desempenho. Siga o guia abaixo para alimentar e gerenciar seus dados corretamente.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
                
                {/* BLOCO 1 */}
                <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                    <h3 className="font-bold text-blue-900 text-lg flex items-center gap-2 mb-3">
                        <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
                        Visão de Futuro
                    </h3>
                    <p className="text-sm mb-3">Aqui você define a identidade visual e estratégica da empresa.</p>
                    <ul className="text-sm space-y-2 list-disc pl-5">
                        <li><strong>Identidade:</strong> Carregue o logotipo, nome da empresa e defina Missão, Visão e Valores.</li>
                        <li><strong>Linha da Visão:</strong> Adicione marcos temporais (anos) e descreva o objetivo principal para cada ano (Máximo 5 anos).</li>
                        <li><strong>One Page:</strong> Visualize o resumo estratégico em uma página e exporte para PDF para apresentações.</li>
                    </ul>
                </div>

                {/* BLOCO 2 */}
                <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                    <h3 className="font-bold text-blue-900 text-lg flex items-center gap-2 mb-3">
                        <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                        Admin (Estrutura)
                    </h3>
                    <p className="text-sm mb-3 text-red-600 font-bold">⚠️ Comece por aqui se o sistema estiver vazio!</p>
                    <ul className="text-sm space-y-2 list-disc pl-5">
                        <li><strong>Acesso:</strong> Use a senha padrão (123456) para entrar.</li>
                        <li><strong>Manual:</strong> Cadastre Perspectivas, Gestores e Objetivos manualmente usando os botões "+".</li>
                        <li><strong>Importação:</strong> Use uma planilha Excel (.xlsx) contendo as colunas <em>Perspectiva, Objetivo, Indicador</em> e <em>Gestor</em> para carregar tudo de uma vez.</li>
                        <li><strong>Configurações:</strong> Defina o padrão global para o Farol de Desempenho (Semáforo).</li>
                        <li><strong>Segurança:</strong> Altere a senha de acesso na aba "Segurança".</li>
                    </ul>
                </div>

                {/* BLOCO 3 */}
                <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                    <h3 className="font-bold text-blue-900 text-lg flex items-center gap-2 mb-3">
                        <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">3</span>
                        Ficha Técnica
                    </h3>
                    <p className="text-sm mb-3">Detalhe as regras de negócio de cada indicador cadastrado.</p>
                    <ul className="text-sm space-y-2 list-disc pl-5">
                        <li>Selecione um indicador na lista lateral.</li>
                        <li>Defina a <strong>Unidade de Medida</strong> (%, R$, Un), a <strong>Periodicidade</strong> e a <strong>Polaridade</strong> (ex: "Quanto maior, melhor").</li>
                        <li>Escreva a fórmula de cálculo e a fonte de dados.</li>
                        <li>Se os campos do farol (semáforo) estiverem vazios, o sistema assumirá o padrão do administrador.</li>
                        <li>Clique em "Finalizar" para marcar o indicador como pronto (ícone verde).</li>
                    </ul>
                </div>

                {/* BLOCO 4 */}
                <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                    <h3 className="font-bold text-blue-900 text-lg flex items-center gap-2 mb-3">
                        <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">4</span>
                        Metas
                    </h3>
                    <p className="text-sm mb-3">Lance os valores históricos e as metas futuras.</p>
                    <ul className="text-sm space-y-2 list-disc pl-5">
                        <li>Utilize os filtros no topo para encontrar o indicador desejado.</li>
                        <li><strong>Configuração:</strong> Defina o tipo de cálculo (Isolado/Acumulado) e as faixas do farol (Semáforo).</li>
                        <li><strong>Valores:</strong> Preencha o histórico dos últimos 3 anos e as metas mês a mês do ano atual.</li>
                        <li>Salve as alterações para que os dados apareçam nos relatórios.</li>
                    </ul>
                </div>

            </div>

            <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
               <strong>Dica Importante:</strong> Sempre clique no botão <strong>"Salvar"</strong> ao final de cada edição. O sistema notifica com uma mensagem verde no canto da tela quando os dados são gravados com sucesso na nuvem.
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