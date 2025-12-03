import React, { useState, useEffect } from 'react';
import { AdminPanel } from './components/AdminPanel';
import { ManagerPanel } from './components/ManagerPanel';
import { ResultsPanel } from './components/ResultsPanel';
import { GoalsPanel } from './components/GoalsPanel';
import { Logo } from './components/ui/Logo';
import { AppData, INITIAL_DATA } from './types';
import { storageService } from './services/storageService';
import { isFirebaseConnected } from './services/firebase';

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
  const [isOnline] = useState(isFirebaseConnected());
  
  // Admin State persisted via Session Storage (survives page refresh, dies on tab close)
  const [adminAuthenticated, setAdminAuthenticated] = useState(() => {
    return sessionStorage.getItem('adminAuth') === 'true';
  });

  const handleAdminAuth = (status: boolean) => {
    setAdminAuthenticated(status);
    if (status) {
      sessionStorage.setItem('adminAuth', 'true');
    } else {
      sessionStorage.removeItem('adminAuth');
    }
  };

  // Subscribe to Realtime Data
  useEffect(() => {
    const unsubscribe = storageService.subscribe((data) => {
      setAppData(data);
    });
    return () => unsubscribe();
  }, []);

  const handleUpdate = (newData: AppData) => {
    storageService.save(newData);
    setAppData(newData);
  };

  const navItemClass = (tab: Tab) => `
    flex-1 py-4 text-xs md:text-sm font-bold uppercase tracking-wide transition-colors text-center border-b-4
    ${activeTab === tab 
      ? 'bg-slate-50 text-blue-900 border-blue-600' 
      : 'bg-blue-900 text-blue-200 hover:bg-blue-800 hover:text-white border-transparent'}
  `;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <header className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-6 shadow-xl flex items-center gap-4">
        <div className="bg-white/10 p-3 rounded-lg shadow-inner">
           <Logo className="w-10 h-10 text-white" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl md:text-2xl font-extrabold tracking-tight uppercase">SISTEMA CONTRATO DE GESTÃO</h1>
            {isOnline && (
                <span className="bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse shadow-sm">
                   ONLINE
                </span>
            )}
          </div>
          <p className="text-blue-200 text-sm mt-0.5 opacity-90 font-light">Sistema de Gestão Estratégica & Performance</p>
        </div>
      </header>

      <nav className="flex shadow-md sticky top-0 z-20 bg-blue-900 overflow-x-auto">
        <button onClick={() => setActiveTab(Tab.MANAGER)} className={navItemClass(Tab.MANAGER)}>
          Ficha Técnica
        </button>
        <button onClick={() => setActiveTab(Tab.GOALS)} className={navItemClass(Tab.GOALS)}>
          Metas
        </button>
        <button onClick={() => setActiveTab(Tab.RESULTS)} className={navItemClass(Tab.RESULTS)}>
          Resultados
        </button>
        <button onClick={() => setActiveTab(Tab.ADMIN)} className={navItemClass(Tab.ADMIN)}>
          Admin
        </button>
        <button onClick={() => setActiveTab(Tab.GUIDE)} className={navItemClass(Tab.GUIDE)}>
          Ajuda
        </button>
      </nav>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8">
        {activeTab === Tab.MANAGER && (
          <ManagerPanel data={appData} onUpdate={handleUpdate} />
        )}
        
        {activeTab === Tab.GOALS && (
          <GoalsPanel data={appData} onUpdate={handleUpdate} />
        )}
        
        {activeTab === Tab.ADMIN && (
          <AdminPanel 
            data={appData} 
            onUpdate={handleUpdate} 
            isAuthenticated={adminAuthenticated}
            setAuthenticated={handleAdminAuth}
            onClose={() => { handleAdminAuth(false); setActiveTab(Tab.MANAGER); }} 
          />
        )}

        {activeTab === Tab.RESULTS && (
          <ResultsPanel data={appData} />
        )}

        {activeTab === Tab.GUIDE && (
          <div className="bg-white p-8 rounded-lg shadow-sm border border-slate-200 prose max-w-none text-slate-600">
            <h2 className="text-2xl font-bold text-blue-900 mb-6 flex items-center gap-2 border-b pb-4">
              <Logo className="w-6 h-6" /> Manual de Orientações
            </h2>
            
            <div className="grid grid-cols-1 gap-8">
              
              {/* BLOCO FICHA TÉCNICA */}
              <div className="bg-slate-50 p-6 rounded border border-slate-200">
                <h3 className="text-xl font-bold text-blue-800 mb-4 flex items-center gap-2">
                  <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">1</span>
                  Aba FICHA TÉCNICA (Antiga aba Gestor)
                </h3>
                <div className="space-y-3 text-sm text-slate-700">
                  <p>Esta aba é destinada à definição técnica (qualitativa) do indicador.</p>
                  <ol className="list-decimal pl-5 space-y-2">
                    <li><strong>Busca:</strong> Utilize o campo de pesquisa para digitar o <strong>nome do indicador</strong> ou o <strong>nome do gestor</strong>. O sistema filtrará a lista automaticamente.</li>
                    <li><strong>Seleção:</strong> Clique em um indicador na lista lateral para abrir o formulário.</li>
                    <li><strong>Preenchimento:</strong> Preencha os campos técnicos:
                      <ul className="list-disc pl-5 mt-1 text-slate-500">
                        <li><em>Unidade de Medida:</em> Como o dado é expresso (%, R$, Quantidade).</li>
                        <li><em>Periodicidade:</em> Frequência de medição (Mensal, Trimestral, Anual).</li>
                        <li><em>Descrição Operacional:</em> O que está sendo medido e por quê.</li>
                        <li><em>Fórmula:</em> A matemática por trás do cálculo.</li>
                        <li><em>Fonte de Dados:</em> De onde a informação é extraída.</li>
                        <li><em>Polaridade:</em> Se "Quanto maior melhor" ou "Quanto menor melhor".</li>
                      </ul>
                    </li>
                    <li><strong>Ações de Salvar:</strong>
                      <ul className="list-disc pl-5 mt-1 text-slate-500">
                        <li><span className="font-bold text-slate-700">Salvar Rascunho:</span> Guarda as informações mas permite edição posterior. Use enquanto estiver trabalhando.</li>
                        <li><span className="font-bold text-green-700">Finalizar (Travar):</span> Salva e bloqueia o indicador. Indica que você concluiu esta etapa. Apenas o Administrador pode destravar depois.</li>
                        <li><span className="font-bold text-red-700">Limpar Detalhes:</span> Apaga o conteúdo dos campos descritivos para recomeçar o preenchimento.</li>
                      </ul>
                    </li>
                  </ol>
                </div>
              </div>

              {/* BLOCO METAS */}
              <div className="bg-slate-50 p-6 rounded border border-slate-200">
                <h3 className="text-xl font-bold text-blue-800 mb-4 flex items-center gap-2">
                  <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">2</span>
                  Aba METAS (Definição Quantitativa)
                </h3>
                <div className="space-y-3 text-sm text-slate-700">
                  <p>Esta aba é destinada à inserção dos números, histórico e metas futuras.</p>
                  <ol className="list-decimal pl-5 space-y-2">
                    <li><strong>Filtros:</strong> Utilize os filtros no topo (Perspectiva -> Objetivo -> Indicador) para encontrar o item desejado.</li>
                    <li><strong>Identificação:</strong> O sistema exibirá automaticamente o nome do Gestor responsável pelo indicador selecionado.</li>
                    <li><strong>Configuração do Indicador:</strong>
                      <ul className="list-disc pl-5 mt-1 text-slate-500">
                        <li><em>Tipo de Cálculo:</em> Define como o sistema consolidará os dados (Isolado, Acumulado ou Média).</li>
                        <li><em>Farol (Semáforo):</em> Defina as faixas de atingimento (Ex: Azul &gt; 100%, Verde = 100%, etc.).</li>
                      </ul>
                    </li>
                    <li><strong>Dados Numéricos:</strong>
                      <ul className="list-disc pl-5 mt-1 text-slate-500">
                        <li><em>Histórico:</em> Preencha os valores realizados nos 3 anos anteriores para base de comparação.</li>
                        <li><em>Metas Mensais:</em> Preencha a meta prevista para cada mês do ano vigente. O formulário é dividido em dois semestres (Jan-Jun e Jul-Dez).</li>
                      </ul>
                    </li>
                    <li><strong>Salvar:</strong> Clique em "Salvar Metas" ao final da página para gravar todos os dados numéricos.</li>
                  </ol>
                </div>
              </div>

               {/* BLOCO RESULTADOS */}
               <div className="bg-slate-50 p-6 rounded border border-slate-200">
                <h3 className="text-xl font-bold text-blue-800 mb-4 flex items-center gap-2">
                  <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">3</span>
                  Aba RESULTADOS
                </h3>
                <div className="space-y-3 text-sm text-slate-700">
                  <p>Visualize os dados consolidados e exporte relatórios.</p>
                  <ul className="list-disc pl-5 mt-1 text-slate-500">
                     <li><strong>Filtros:</strong> Filtre a tabela por Perspectiva ou Gestor.</li>
                     <li><strong>Exportação:</strong> Utilize os botões para baixar planilhas Excel:
                       <ul className="pl-4 mt-1 border-l-2 border-slate-300">
                         <li><em>Relatório Resumido:</em> Contém apenas a estrutura (Perspectiva, Objetivo, Indicador, Gestor e Status).</li>
                         <li><em>Relatório Detalhado:</em> Contém todos os campos, incluindo fórmulas, descrições e metas cadastradas.</li>
                       </ul>
                     </li>
                  </ul>
                </div>
              </div>

              <div className="bg-slate-50 p-6 rounded border border-slate-200">
                <h3 className="text-xl font-bold text-blue-800 mb-4 flex items-center gap-2">
                  <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">4</span>
                  Administração
                </h3>
                <p className="text-sm">Para cadastrar novos indicadores, gestores ou objetivos, acesse a aba <strong>ADMIN</strong> com a senha padrão. Utilize a função de "Importação" para carregar dados em massa via Excel ou utilize a aba "Estrutura & Gestores" para gerenciar e liberar indicadores travados.</p>
                <p className="text-sm mt-2 text-purple-800 font-bold">
                  Para utilizar o sistema em modo distribuído (online), acesse a sub-aba "Conexão Nuvem" dentro do Admin.
                </p>
              </div>

            </div>
          </div>
        )}
      </main>

      <footer className="bg-slate-900 text-slate-400 p-6 text-center text-xs border-t border-slate-800">
        <div className="flex items-center justify-center gap-2 mb-2 opacity-50">
           <Logo className="w-4 h-4" />
           <span className="font-bold tracking-widest uppercase">SISTEMA CONTRATO DE GESTÃO</span>
        </div>
        &copy; {new Date().getFullYear()} Todos os direitos reservados.
      </footer>
    </div>
  );
}