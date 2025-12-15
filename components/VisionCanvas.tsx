import React, { useState, useEffect, useRef } from 'react';
import { AppData, StrategicIdentity, VisionMilestone } from '../types';
import { Button } from './ui/Button';

// Declaração global para bibliotecas de PDF carregadas via CDN
declare global {
  interface Window {
    html2canvas: any;
    jspdf: any;
  }
}

interface VisionCanvasProps {
  data: AppData;
  onUpdate: (newData: AppData) => void;
}

type CanvasTab = 'identity' | 'timeline' | 'onepage';

export const VisionCanvas: React.FC<VisionCanvasProps> = ({ data, onUpdate }) => {
  // Alterado ordem padrão para 'identity' conforme solicitado
  const [activeSubTab, setActiveSubTab] = useState<CanvasTab>('identity'); 
  
  // Local state for form handling
  const [identity, setIdentity] = useState<StrategicIdentity>(data.identity);
  const [visionLine, setVisionLine] = useState<VisionMilestone[]>(data.visionLine || []);
  
  // Zoom State for Report
  const [scale, setScale] = useState(0.8); // Start at 80% to fit most screens

  // Ref for file input
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync with props if they change externally
  useEffect(() => {
    setIdentity(data.identity);
    setVisionLine(data.visionLine || []);
  }, [data.identity, data.visionLine]);

  const handleIdentityChange = (field: keyof StrategicIdentity, value: string | number) => {
    setIdentity(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    // Apenas chama o update. O feedback visual (Toast) virá da resposta da API em apiService/App.tsx
    onUpdate({
      ...data,
      identity,
      visionLine
    });
  };

  // --- Logo Upload Logic (Base64) ---
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validação de tamanho (Limitando a 800KB para evitar payload excessivo no JSON)
    if (file.size > 800 * 1024) {
      alert("A imagem é muito grande. Por favor, escolha uma imagem menor que 800KB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      handleIdentityChange('logoUrl', base64String);
    };
    reader.readAsDataURL(file);
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const removeLogo = () => {
    if(confirm("Remover a logomarca atual?")) {
      handleIdentityChange('logoUrl', '');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // --- Timeline Logic ---
  const addMilestone = () => {
    if (visionLine.length >= 5) {
      alert("Limite máximo de 5 anos na Linha da Visão.");
      return;
    }
    // Auto-increment year based on horizon or last milestone
    const lastYear = visionLine.length > 0 ? visionLine[visionLine.length - 1].year : (identity.horizonStart || new Date().getFullYear());
    const nextYear = lastYear + 1;
    
    const newMilestone: VisionMilestone = {
      id: Math.random().toString(36).substr(2, 9),
      year: nextYear,
      description: ''
    };
    setVisionLine([...visionLine, newMilestone].sort((a, b) => a.year - b.year));
  };

  const updateMilestone = (id: string, field: keyof VisionMilestone, value: string | number) => {
    setVisionLine(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m).sort((a, b) => a.year - b.year));
  };

  const removeMilestone = (id: string) => {
    if(!confirm("Remover este marco?")) return;
    setVisionLine(prev => prev.filter(m => m.id !== id));
  };

  // --- PDF Export Logic ---
  const exportPDF = async () => {
    const element = document.getElementById('one-page-canvas');
    if (!element || !window.html2canvas || !window.jspdf) {
      alert("Bibliotecas de PDF não carregadas ou elemento não encontrado.");
      return;
    }

    const exportBtn = document.getElementById('export-btn');
    if(exportBtn) exportBtn.style.display = 'none';

    // Store current scale and reset to 1 for high-res capture
    const originalTransform = element.style.transform;
    const originalMargin = element.style.margin;
    
    // Temporarily reset styles for capture
    element.style.transform = 'none';
    element.style.margin = '0';
    
    // Show a loading feedback (optional)
    document.body.style.cursor = 'wait';

    try {
      const canvas = await window.html2canvas(element, { 
        scale: 2, // High resolution (2x)
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false
      });
      
      const imgData = canvas.toDataURL('image/png');
      const { jsPDF } = window.jspdf;
      
      // Export as A4 Landscape
      const pdf = new jsPDF('l', 'mm', 'a4'); 
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgProps = pdf.getImageProperties(imgData);
      const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      // Center vertically if image is shorter than page
      const y = imgHeight < pdfHeight ? (pdfHeight - imgHeight) / 2 : 0;

      pdf.addImage(imgData, 'PNG', 0, y, pdfWidth, imgHeight);
      pdf.save(`Canvas_Visao_${identity.companyName || 'Estrategia'}.pdf`);
    } catch (err) {
      console.error(err);
      alert("Erro ao gerar PDF.");
    } finally {
      // Restore styles
      element.style.transform = originalTransform;
      element.style.margin = originalMargin;
      if(exportBtn) exportBtn.style.display = 'flex';
      document.body.style.cursor = 'default';
    }
  };

  // Sort: High year at top (visually) for the arrow stack
  const reversedVisionLine = [...visionLine].sort((a, b) => b.year - a.year);

  return (
    <div className="pb-10 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <h2 className="text-2xl font-bold text-blue-900 flex items-center gap-2">
          <i className="ph ph-rocket-launch"></i> Canvas da Visão de Futuro
        </h2>
        
        {activeSubTab === 'onepage' && (
          <div className="flex items-center gap-4 bg-white p-2 rounded shadow-sm border">
              {/* Zoom Controls */}
              <div className="flex items-center gap-2 border-r pr-4">
                  <span className="text-xs font-bold text-slate-400 uppercase">Zoom:</span>
                  <button onClick={() => setScale(Math.max(0.5, scale - 0.1))} className="p-1 hover:bg-slate-100 rounded text-slate-600">
                    <i className="ph ph-minus"></i>
                  </button>
                  <input 
                    type="range" 
                    min="0.5" 
                    max="1.5" 
                    step="0.1" 
                    value={scale} 
                    onChange={(e) => setScale(parseFloat(e.target.value))}
                    className="w-24 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <button onClick={() => setScale(Math.min(1.5, scale + 0.1))} className="p-1 hover:bg-slate-100 rounded text-slate-600">
                    <i className="ph ph-plus"></i>
                  </button>
                  <span className="text-xs font-mono w-10 text-right">{Math.round(scale * 100)}%</span>
              </div>

              <div className="flex gap-2">
                <Button onClick={exportPDF} variant="secondary" id="export-btn" className="flex items-center gap-2 bg-slate-800 text-white hover:bg-slate-700">
                  <i className="ph ph-file-pdf"></i> PDF
                </Button>
                <Button onClick={handleSave} className="flex items-center gap-2">
                  <i className="ph ph-floppy-disk"></i> Salvar
                </Button>
              </div>
          </div>
        )}
        
        {activeSubTab !== 'onepage' && (
           <Button onClick={handleSave} className="flex items-center gap-2">
             <i className="ph ph-floppy-disk"></i> Salvar Dados
           </Button>
        )}
      </div>

      {/* Tabs Reordered */}
      <div className="flex gap-2 border-b border-slate-200 pb-1 overflow-x-auto">
        <button 
          className={`px-6 py-2 text-sm font-bold rounded-t-lg transition-colors border-t border-x ${activeSubTab === 'identity' ? 'bg-white border-slate-200 text-blue-700' : 'bg-slate-100 text-slate-500 border-transparent'}`} 
          onClick={() => setActiveSubTab('identity')}
        >
          1. Identidade Estratégica
        </button>
        <button 
          className={`px-6 py-2 text-sm font-bold rounded-t-lg transition-colors border-t border-x ${activeSubTab === 'timeline' ? 'bg-white border-slate-200 text-blue-700' : 'bg-slate-100 text-slate-500 border-transparent'}`} 
          onClick={() => setActiveSubTab('timeline')}
        >
          2. Linha da Visão
        </button>
        <button 
          className={`px-6 py-2 text-sm font-bold rounded-t-lg transition-colors border-t border-x ${activeSubTab === 'onepage' ? 'bg-white border-slate-200 text-blue-700' : 'bg-slate-100 text-slate-500 border-transparent'}`} 
          onClick={() => setActiveSubTab('onepage')}
        >
          3. Relatório One Page
        </button>
      </div>

      {/* CONTENT: IDENTITY EDIT (Moved to First Position) */}
      {activeSubTab === 'identity' && (
        <div className="bg-white p-6 rounded-b-lg shadow-sm border border-t-0 border-slate-200 animate-fade-in">
          
          {/* Company Data */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8 border-b pb-8">
            <div className="col-span-1">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Logomarca</label>
              
              <div className="space-y-2">
                <input 
                  type="file" 
                  accept="image/*" 
                  ref={fileInputRef}
                  className="hidden"
                  onChange={handleLogoUpload}
                />
                
                <div className="w-full h-32 bg-slate-50 border-2 border-dashed border-slate-300 rounded flex flex-col items-center justify-center overflow-hidden relative group">
                  {identity.logoUrl ? (
                    <>
                      <img src={identity.logoUrl} alt="Logo" className="max-h-full max-w-full object-contain p-2" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button onClick={triggerFileInput} className="p-2 bg-white rounded-full text-blue-600 hover:bg-blue-50" title="Alterar">
                          <i className="ph ph-pencil-simple"></i>
                        </button>
                        <button onClick={removeLogo} className="p-2 bg-white rounded-full text-red-600 hover:bg-red-50" title="Remover">
                          <i className="ph ph-trash"></i>
                        </button>
                      </div>
                    </>
                  ) : (
                    <div onClick={triggerFileInput} className="flex flex-col items-center justify-center cursor-pointer w-full h-full text-slate-400 hover:text-blue-500 hover:bg-slate-100 transition-colors">
                      <i className="ph ph-image text-3xl mb-1"></i>
                      <span className="text-xs font-bold">Carregar Imagem</span>
                      <span className="text-[10px] opacity-70">(Máx 800kb)</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome da Empresa</label>
              <input 
                type="text" 
                className="w-full p-3 border rounded text-xl font-bold text-blue-900"
                placeholder="Nome da Organização"
                value={identity.companyName}
                onChange={e => handleIdentityChange('companyName', e.target.value)}
              />
            </div>
            
            {/* HORIZON INPUTS */}
            <div className="col-span-1 bg-blue-50 p-3 rounded border border-blue-100">
               <label className="block text-xs font-bold text-blue-800 uppercase mb-2">Horizonte (Anos)</label>
               <div className="flex gap-2 items-center">
                  <div className="flex-1">
                    <input 
                      type="number" 
                      className="w-full p-2 border rounded text-center font-bold"
                      placeholder="Início"
                      value={identity.horizonStart || ''}
                      onChange={e => handleIdentityChange('horizonStart', parseInt(e.target.value))}
                    />
                  </div>
                  <span className="text-blue-400">a</span>
                  <div className="flex-1">
                    <input 
                      type="number" 
                      className="w-full p-2 border rounded text-center font-bold"
                      placeholder="Fim"
                      value={identity.horizonEnd || ''}
                      onChange={e => handleIdentityChange('horizonEnd', parseInt(e.target.value))}
                    />
                  </div>
               </div>
            </div>
          </div>

          {/* Strategic Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                <label className="flex items-center gap-2 text-sm font-bold text-blue-800 mb-2">
                  <i className="ph ph-target text-lg"></i> Propósito
                </label>
                <textarea 
                  className="w-full p-3 border rounded text-sm min-h-[100px]" 
                  value={identity.purpose}
                  onChange={e => handleIdentityChange('purpose', e.target.value)}
                />
              </div>
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
                  <i className="ph ph-briefcase text-lg"></i> Negócio
                </label>
                <textarea 
                  className="w-full p-3 border rounded text-sm min-h-[80px]" 
                  value={identity.business}
                  onChange={e => handleIdentityChange('business', e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100">
                <label className="flex items-center gap-2 text-sm font-bold text-emerald-800 mb-2">
                  <i className="ph ph-flag text-lg"></i> Missão
                </label>
                <textarea 
                  className="w-full p-3 border rounded text-sm min-h-[80px]" 
                  value={identity.mission}
                  onChange={e => handleIdentityChange('mission', e.target.value)}
                />
              </div>
              <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
                <label className="flex items-center gap-2 text-sm font-bold text-purple-800 mb-2">
                  <i className="ph ph-eye text-lg"></i> Visão de Futuro
                </label>
                <textarea 
                  className="w-full p-3 border rounded text-sm min-h-[80px]" 
                  value={identity.vision}
                  onChange={e => handleIdentityChange('vision', e.target.value)}
                />
              </div>
            </div>
            
            <div className="md:col-span-2 bg-amber-50 p-4 rounded-lg border border-amber-100">
              <label className="flex items-center gap-2 text-sm font-bold text-amber-800 mb-2">
                <i className="ph ph-diamond text-lg"></i> Valores
              </label>
              <textarea 
                className="w-full p-3 border rounded text-sm min-h-[80px]" 
                value={identity.values}
                onChange={e => handleIdentityChange('values', e.target.value)}
              />
            </div>
          </div>
        </div>
      )}

      {/* CONTENT: VISION LINE EDIT (Moved to Second Position) */}
      {activeSubTab === 'timeline' && (
        <div className="bg-white p-6 rounded-b-lg shadow-sm border border-t-0 border-slate-200 animate-fade-in">
          <div className="flex justify-between items-center mb-6">
             <div>
                <h3 className="text-lg font-bold text-slate-800">Linha da Visão (Roadmap)</h3>
                <p className="text-sm text-slate-500">Defina os marcos estratégicos para os próximos anos (Máx: 5).</p>
             </div>
             <Button onClick={addMilestone} disabled={visionLine.length >= 5} variant="secondary">
                <i className="ph ph-plus"></i> Adicionar Ano
             </Button>
          </div>

          <div className="space-y-4">
             {visionLine.length === 0 && (
                <div className="text-center p-10 bg-slate-50 rounded border border-dashed text-slate-400">
                   Nenhum marco definido. Clique em "Adicionar Ano" para começar.
                </div>
             )}

             {visionLine.map((item, index) => (
                <div key={item.id} className="flex gap-4 items-start p-4 bg-white border rounded shadow-sm hover:shadow-md transition-shadow relative group">
                   <div className="flex flex-col items-center gap-2 pt-2">
                      <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow">
                         {index + 1}
                      </div>
                      {index < visionLine.length - 1 && <div className="w-0.5 h-full bg-blue-100 min-h-[50px]"></div>}
                   </div>
                   
                   <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4">
                      <div className="md:col-span-2">
                         <label className="block text-xs font-bold text-slate-500 mb-1">Ano</label>
                         <input 
                           type="number" 
                           className="w-full p-2 border rounded font-bold text-blue-900"
                           value={item.year}
                           onChange={e => updateMilestone(item.id, 'year', parseInt(e.target.value))}
                         />
                      </div>
                      <div className="md:col-span-10">
                         <label className="block text-xs font-bold text-slate-500 mb-1">Marcos da Linha da Visão</label>
                         <textarea 
                           className="w-full p-2 border rounded text-sm h-20 resize-none"
                           placeholder="O que deve ser alcançado neste ano?"
                           value={item.description}
                           onChange={e => updateMilestone(item.id, 'description', e.target.value)}
                         />
                      </div>
                   </div>

                   <button 
                      onClick={() => removeMilestone(item.id)}
                      className="text-slate-300 hover:text-red-500 absolute top-2 right-2 p-1"
                      title="Remover ano"
                   >
                      <i className="ph ph-trash text-lg"></i>
                   </button>
                </div>
             ))}
          </div>
        </div>
      )}

      {/* CONTENT: ONE PAGE REPORT (Moved to Third Position) */}
      {activeSubTab === 'onepage' && (
        <div className="flex justify-center bg-slate-200 p-4 md:p-8 rounded-b-lg overflow-auto border border-slate-300">
          
          {/* Scroll Container Wrapper */}
          <div className="relative" style={{ width: 1123 * scale, height: 794 * scale }}>
              {/* 
                  A4 Landscape Dimensions in px (approx 96 DPI): 1123 x 794.
                  Applied Transform Scale for Zoom.
                  Transform Origin Top-Left allows the container to grow/shrink naturally in the flow.
              */}
              <div 
                id="one-page-canvas" 
                style={{ 
                   transform: `scale(${scale})`, 
                   transformOrigin: 'top left',
                   width: '1123px',
                   minHeight: '794px' 
                }}
                className="bg-white shadow-2xl p-8 relative flex flex-col font-sans"
              >
                {/* Header */}
                <div className="text-center mb-6">
                   <h1 className="text-2xl font-black uppercase tracking-[0.2em] text-blue-900 border-b-4 border-blue-900 inline-block pb-2">
                     Mapa "One Page" - Canvas da Visão
                   </h1>
                </div>

                <div className="flex-1 grid grid-cols-12 gap-6">
                   
                   {/* --- LEFT COLUMN (30%) --- */}
                   <div className="col-span-3 flex flex-col gap-4">
                      {/* Company Info */}
                      <div className="border border-blue-200 rounded-xl p-3 bg-slate-50 shadow-sm flex flex-col gap-2">
                         <div className="flex items-center gap-3">
                            {identity.logoUrl ? (
                              <img src={identity.logoUrl} className="w-14 h-14 object-contain bg-white rounded p-1 shadow-sm border" alt="Logo" />
                            ) : (
                              <div className="w-14 h-14 bg-slate-200 rounded flex items-center justify-center text-xs font-bold text-slate-400">LOGO</div>
                            )}
                            <div className="flex-1 overflow-hidden">
                               <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Empresa</div>
                               <div className="font-extrabold text-blue-900 text-lg leading-tight truncate">{identity.companyName || 'Nome da Empresa'}</div>
                            </div>
                         </div>
                      </div>

                      {/* Horizon Box */}
                      <div className="border border-blue-200 rounded-xl p-3 bg-white shadow-sm text-center">
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Horizonte Estratégico</div>
                          <div className="text-xl font-black text-blue-800">
                            {identity.horizonStart || 'Ano X'} <span className="text-slate-300 mx-2">➔</span> {identity.horizonEnd || 'Ano Y'}
                          </div>
                      </div>

                      {/* VALUES Box */}
                      <div className="flex-1 border-2 border-dashed border-blue-300 rounded-2xl p-4 relative mt-4 bg-white">
                          <div className="absolute -top-3 left-6 bg-blue-900 text-white px-3 py-1 rounded-full text-sm font-bold shadow-md">
                             Valores
                          </div>
                          <div className="h-full mt-2 text-xs text-slate-700 whitespace-pre-wrap leading-relaxed text-justify">
                             {identity.values || 'Liste aqui os valores inegociáveis...'}
                          </div>
                      </div>
                   </div>

                   {/* --- CENTER COLUMN (40%) - THE ARROW STACK --- */}
                   <div className="col-span-6 flex flex-col items-center">
                      
                      {/* Vision OVAL */}
                      <div className="w-full max-w-lg aspect-[2.2/1] relative mb-1 z-20">
                          <div className="absolute inset-0 rounded-[50%] border-[4px] border-blue-900 bg-white flex items-center justify-center p-6 text-center shadow-xl">
                              <div className="flex flex-col items-center justify-center h-full w-full">
                                 <div className="text-[10px] font-bold text-blue-400 uppercase tracking-[0.2em] mb-1">Visão de Futuro</div>
                                 <div className="text-lg font-bold text-slate-800 leading-tight overflow-hidden text-ellipsis line-clamp-4">
                                    "{identity.vision || 'Aonde queremos chegar?'}"
                                 </div>
                              </div>
                          </div>
                      </div>

                      {/* THE BIG ARROW CONTAINER */}
                      <div className="w-full flex-1 relative -mt-6 pt-8 z-10 px-2">
                         {/* SVG Background for the Arrow Shape */}
                         <svg className="absolute inset-0 w-full h-full drop-shadow-xl" viewBox="0 0 300 400" preserveAspectRatio="none">
                            <path d="M150 0 L300 100 L260 100 L290 400 L10 400 L40 100 L0 100 Z" fill="white" stroke="#1e3a8a" strokeWidth="2" />
                         </svg>
                         
                         <div className="absolute top-2 left-0 right-0 text-center">
                            <span className="text-[9px] uppercase font-bold text-blue-300 tracking-widest">Linha da Visão</span>
                         </div>

                         {/* Content Stacked Bottom to Top visually */}
                         <div className="relative z-10 w-full h-full flex flex-col justify-end pb-4 px-10 md:px-16 gap-1">
                            {reversedVisionLine.length === 0 && (
                                <div className="text-center text-slate-400 py-20 text-xs">
                                   Adicione marcos na aba "Linha da Visão"
                                </div>
                            )}
                            
                            {reversedVisionLine.map((milestone, idx) => (
                               <div key={milestone.id} className="flex items-center gap-3 border-b border-blue-100 py-2 last:border-0 bg-white/50 backdrop-blur-sm rounded px-2">
                                   <div className="min-w-[60px] text-right">
                                      <span className="bg-blue-900 text-white font-bold text-xs px-2 py-0.5 rounded shadow-sm">
                                        {milestone.year}
                                      </span>
                                   </div>
                                   <div className="flex-1 text-xs font-medium text-slate-800 leading-tight">
                                      {milestone.description}
                                   </div>
                               </div>
                            ))}
                         </div>
                      </div>

                   </div>

                   {/* --- RIGHT COLUMN (30%) --- */}
                   <div className="col-span-3 flex flex-col gap-4">
                      
                      {/* Purpose Box */}
                      <div className="border border-blue-200 rounded-xl p-3 bg-white shadow-sm relative mt-2 group">
                          <div className="absolute -top-2.5 right-4 bg-white px-2 py-0.5 text-[10px] font-bold text-blue-900 uppercase border border-blue-100 shadow-sm rounded-full">
                             Propósito
                          </div>
                          <div className="text-xs text-slate-700 italic min-h-[40px] flex items-center justify-center text-center">
                             {identity.purpose || 'Defina o propósito...'}
                          </div>
                      </div>

                      {/* Business Box */}
                      <div className="border border-blue-200 rounded-xl p-3 bg-white shadow-sm relative mt-2 group">
                          <div className="absolute -top-2.5 right-4 bg-white px-2 py-0.5 text-[10px] font-bold text-blue-900 uppercase border border-blue-100 shadow-sm rounded-full">
                             Negócio
                          </div>
                          <div className="text-xs text-slate-700 font-medium min-h-[40px] flex items-center justify-center text-center">
                             {identity.business || 'Defina o negócio...'}
                          </div>
                      </div>

                      {/* MISSION Box */}
                      <div className="flex-1 border-2 border-dashed border-blue-300 rounded-2xl p-4 relative mt-4 bg-white">
                          <div className="absolute -top-3 right-6 bg-blue-900 text-white px-3 py-1 rounded-full text-sm font-bold shadow-md">
                             Missão
                          </div>
                          <div className="h-full mt-2 flex items-center justify-center text-center text-xs font-medium text-slate-700 whitespace-pre-wrap leading-relaxed">
                             {identity.mission || 'Escreva a missão da empresa aqui.'}
                          </div>
                      </div>

                   </div>
                </div>
                
                {/* Footer / Caption */}
                <div className="text-center mt-3 text-[9px] text-slate-400 uppercase tracking-widest">
                   Planejamento Estratégico {identity.horizonStart} - {identity.horizonEnd} • {identity.companyName}
                </div>
              </div>
          </div>
        </div>
      )}

    </div>
  );
};