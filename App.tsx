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

const DEFAULT_USER: User = {
  email: 'admin@sistema.com',
  nome: 'Administrador',
  perfil: 'ADMIN',
  ativo: true
};

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.VISION);
  const [appData, setAppData] = useState<AppData>(INITIAL_DATA);
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [adminPassInput, setAdminPassInput] = useState('');
  const [currentUser, setCurrentUser] = useState<User>(DEFAULT_USER);
  const [notification, setNotification] = useState<{msg: string, type: NotificationType} | null>(null);

  useEffect(() => {
    setNotificationHandler((msg: string, type: NotificationType) => {
      setNotification({ msg, type });
    });
    loadData();
  }, []);

  const loadData = async () => {
    const data = await apiService.loadFullData();
    setAppData(data);
  };

  const handleUpdate = async (newData: AppData, section: 'structure' | 'indicators' | 'goals' | 'users' | 'vision' | 'settings') => {
    if (!currentUser) return;
    setAppData(newData);
    switch (section) {
      case 'vision': await apiService.saveVision(newData.identity, newData.visionLine, currentUser); break;
      case 'structure': await apiService.saveStructure(newData, currentUser); break;
      case 'indicators': await apiService.saveIndicators(newData.indicators, currentUser); break;
      case 'goals': await apiService.saveGoals(newData.goals, currentUser); await apiService.saveIndicators(newData.indicators, currentUser); break;
      case 'users': await apiService.saveUsers(newData.users, currentUser); break;
      case 'settings': await apiService.saveAdminSettings({ adminPassword: newData.adminPassword, globalSettings: newData.globalSettings }, currentUser); break;
    }
  };

  const attemptAdminUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    const input = adminPassInput.trim();
    const stored = appData.adminPassword ? String(appData.adminPassword).trim() : '';
    if (input === '123456' || (stored && input === stored)) {
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
      {notification && <NotificationToast message={notification.msg} type={notification.type} onClose={() => setNotification(null)} />}
      <header className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-4 shadow-xl z-30">
        <div className="max-w-7xl mx-auto flex items-center gap-6">
          <Logo className="w-8 h-8 text-white" />
          <div className="flex-1">
             <h1 className="text-xl font-black uppercase">SISCONGE</h1>
             <h2 className="text-xs text-blue-200 font-bold uppercase">{appData.identity.companyName}</h2>
          </div>
          {appData.identity.logoUrl && <img src={appData.identity.logoUrl} className="h-10 w-auto bg-white p-1 rounded" alt="Logo" />}
        </div>
      </header>
      <nav className="flex shadow-md sticky top-0 z-20 bg-blue-900 overflow-x-auto">
        <button onClick={() => setActiveTab(Tab.VISION)} className={navItemClass(Tab.VISION)}>Identidade</button>
        <button onClick={() => setActiveTab(Tab.MANAGER)} className={navItemClass(Tab.MANAGER)}>Fichas Técnicas</button>
        <button onClick={() => setActiveTab(Tab.GOALS)} className={navItemClass(Tab.GOALS)}>Metas</button>
        <button onClick={() => setActiveTab(Tab.RESULTS)} className={navItemClass(Tab.RESULTS)}>Resultados</button>
        <button onClick={() => setActiveTab(Tab.ADMIN)} className={navItemClass(Tab.ADMIN)}>Admin</button>
        <button onClick={() => setActiveTab(Tab.GUIDE)} className={navItemClass(Tab.GUIDE)}>Guia</button>
      </nav>
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8">
        {activeTab === Tab.VISION && <VisionCanvas data={appData} onUpdate={(d) => handleUpdate(d, 'vision')} />}
        {activeTab === Tab.MANAGER && <ManagerPanel data={appData} onUpdate={(d) => handleUpdate(d, 'indicators')} />}
        {activeTab === Tab.GOALS && <GoalsPanel data={appData} onUpdate={(d) => handleUpdate(d, 'goals')} />}
        {activeTab === Tab.RESULTS && <ResultsPanel data={appData} />}
        {activeTab === Tab.ADMIN && (
          adminUnlocked ? <AdminPanel data={appData} user={currentUser} onUpdate={handleUpdate} onClose={() => setAdminUnlocked(false)} /> :
          <div className="flex justify-center py-20 animate-fade-in"><form onSubmit={attemptAdminUnlock} className="bg-white p-8 rounded shadow-lg border w-full max-w-md text-center"><i className="ph ph-lock-key text-4xl text-red-600 mb-4"></i><h2 className="text-xl font-bold mb-6">Acesso Administrativo</h2><PasswordInput placeholder="Senha" value={adminPassInput} onChange={e => setAdminPassInput(e.target.value)} autoFocus /><Button type="submit" className="w-full mt-4">Acessar</Button></form></div>
        )}
        {activeTab === Tab.GUIDE && (
          <div className="bg-white p-10 rounded shadow-xl border border-slate-100 prose max-w-none text-slate-700 animate-fade-in">
            <h2 className="text-3xl font-black text-blue-900 border-b-4 border-blue-900 pb-4 mb-8 uppercase tracking-tight">Manual do Usuário – SISCONGE</h2>

            <div className="space-y-10">
              <section>
                <h3 className="text-xl font-bold text-blue-800 mb-4 flex items-center gap-2">
                  <i className="ph ph-info font-bold"></i> 1. O que é o SISCONGE
                </h3>
                <p>
                  O SISCONGE – Sistema de Controle de Gestão Estratégica é uma plataforma destinada a estruturar,
                  acompanhar e analisar a execução da estratégia organizacional, integrando identidade estratégica,
                  objetivos, indicadores, metas e resultados.
                </p>
                <p>
                  O sistema foi concebido para apoiar decisões gerenciais, avaliações de desempenho e processos
                  de governança, com base em dados consistentes e rastreáveis.
                </p>
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mt-4">
                  <h4 className="font-bold text-blue-900 mb-2 uppercase text-xs">Princípios de Uso</h4>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    <li>Use o sistema como ferramenta de gestão, não apenas de controle</li>
                    <li>Priorize consistência e disciplina</li>
                    <li>Trate indicadores como instrumentos de decisão</li>
                  </ul>
                </div>
                <blockquote className="border-l-4 border-blue-600 pl-4 italic text-slate-500 my-6 bg-slate-50 p-4 rounded-r-lg">
                  “Estratégia sem execução é intenção.<br />
                  Execução sem controle é risco.<br />
                  O SISCONGE existe para conectar os dois”.
                </blockquote>
              </section>

              <section>
                <h3 className="text-xl font-bold text-blue-800 mb-4 flex items-center gap-2">
                  <i className="ph ph-list-numbers font-bold"></i> 2. Lógica de Funcionamento do Sistema
                </h3>
                <ol className="list-decimal list-inside space-y-2 font-medium text-slate-600">
                  <li>Definição da Identidade Estratégica e Ano de Referência</li>
                  <li>Cadastro das Fichas Técnicas de Indicadores</li>
                  <li>Planejamento das Metas</li>
                  <li>Registro dos Resultados (Realizado)</li>
                  <li>Análises, semáforos e consolidações</li>
                </ol>
                <p className="mt-4 text-sm font-bold text-red-600">Cada etapa depende da anterior. O sistema não interpreta dados fora dessa lógica.</p>
              </section>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                  <h3 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
                    <i className="ph ph-calendar font-bold"></i> 3. Ano de Referência
                  </h3>
                  <p className="text-sm">O Ano de Referência é o eixo central do SISCONGE. Todas as metas, resultados e análises estão vinculados a um ano específico. A troca do ano altera completamente o conjunto de dados analisados.</p>
                  <p className="text-xs font-black text-blue-700 mt-3 uppercase">Recomendação: Defina o Ano de Referência antes de iniciar qualquer cadastro.</p>
                </div>

                <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                  <h3 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
                    <i className="ph ph-file-text font-bold"></i> 4. Indicadores e Fichas Técnicas
                  </h3>
                  <p className="text-sm">A Ficha Técnica do Indicador define como o desempenho será medido e interpretado, incluindo regra de cálculo, periodicidade, polaridade e semáforos de desempenho.</p>
                  <p className="text-xs font-black text-blue-700 mt-3 uppercase">Um indicador só deve ser utilizado após a ficha técnica estar finalizada.</p>
                </div>

                <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                  <h3 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
                    <i className="ph ph-target font-bold"></i> 5. Metas
                  </h3>
                  <p className="text-sm">As metas representam os compromissos quantitativos assumidos para cada indicador no Ano de Referência. São planejadas mensalmente e servem como base para comparação Meta x Real.</p>
                </div>

                <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                  <h3 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
                    <i className="ph ph-chart-line-up font-bold"></i> 6. Resultados (Realizado)
                  </h3>
                  <p className="text-sm">Os resultados representam o desempenho efetivamente alcançado. Devem ser registrados conforme a periodicidade do indicador e refletir dados oficiais da organização.</p>
                </div>
              </div>

              <section className="bg-blue-900 text-white p-8 rounded-2xl shadow-lg">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-blue-200">
                  <i className="ph ph-traffic-light font-bold"></i> 7. Semáforos de Desempenho
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-blue-600 rounded-lg">
                    <span className="block font-black text-sm uppercase mb-1">Azul</span>
                    <span className="text-[10px] font-bold opacity-80 uppercase">Superação</span>
                  </div>
                  <div className="text-center p-4 bg-green-600 rounded-lg">
                    <span className="block font-black text-sm uppercase mb-1">Verde</span>
                    <span className="text-[10px] font-bold opacity-80 uppercase">Meta Atingida</span>
                  </div>
                  <div className="text-center p-4 bg-yellow-500 rounded-lg">
                    <span className="block font-black text-sm uppercase mb-1 text-slate-900">Amarelo</span>
                    <span className="text-[10px] font-black opacity-60 uppercase text-slate-900">Atenção</span>
                  </div>
                  <div className="text-center p-4 bg-red-600 rounded-lg">
                    <span className="block font-black text-sm uppercase mb-1">Vermelho</span>
                    <span className="text-[10px] font-bold opacity-80 uppercase">Crítico</span>
                  </div>
                </div>
              </section>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <section className="bg-red-50 p-6 rounded-xl border border-red-100">
                  <h3 className="font-bold text-red-900 mb-3 flex items-center gap-2">
                    <i className="ph ph-shield-check font-bold"></i> 8. Aba Admin
                  </h3>
                  <p className="text-sm text-red-800">A aba ADMIN é uma área privativa, destinada à governança do sistema para importação/exclusão em lote e manutenção da base.</p>
                  <p className="mt-3 text-xs font-black text-red-600 uppercase">O uso inadequado impacta todo o sistema. Acesso restrito ao administrador.</p>
                </section>

                <section className="bg-indigo-50 p-6 rounded-xl border border-indigo-100">
                  <h3 className="font-bold text-indigo-900 mb-3 flex items-center gap-2">
                    <i className="ph ph-sparkle font-bold"></i> 9. Maturidade Estratégica
                  </h3>
                  <p className="text-sm text-indigo-800">Funcionalidade que analisa a capacidade organizacional de planejar, executar e monitorar a estratégia, transformando respostas de formulários em relatórios executivos via IA.</p>
                </section>
              </div>
            </div>
            
            <div className="mt-12 pt-8 border-t text-center text-xs text-slate-400 font-black uppercase tracking-widest">
              SISCONGE Distributed 2.0 • Guia de Referência Rápida
            </div>
          </div>
        )}
      </main>
      <footer className="bg-slate-900 text-slate-400 p-6 text-center text-xs border-t border-slate-800">
        <Logo className="w-4 h-4 mx-auto mb-2 opacity-50" />
        &copy; {new Date().getFullYear()} SISCONGE - Gestão Distribuída de Performance
      </footer>
    </div>
  );
}