import React, { useState, useEffect, useRef } from 'react';
import { AppData, StrategicIdentity, VisionMilestone, TextStyle } from '../types';
import { Button } from './ui/Button';
import { Tooltip } from './ui/Tooltip';

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

const FONT_OPTIONS = ['sans-serif', 'serif', 'mono', 'Georgia', 'Verdana', 'Tahoma', 'Trebuchet MS'];

export const VisionCanvas: React.FC<VisionCanvasProps> = ({ data, onUpdate }) => {
  const [activeSubTab, setActiveSubTab] = useState<CanvasTab>('identity'); 
  const [identity, setIdentity] = useState<StrategicIdentity>(data.identity);
  const [visionLine, setVisionLine] = useState<VisionMilestone[]>(data.visionLine || []);
  const [scale, setScale] = useState(0.8);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIdentity(data.identity);
    setVisionLine(data.visionLine || []);
  }, [data.identity, data.visionLine]);

  const handleIdentityChange = (field: keyof StrategicIdentity, value: any) => {
    setIdentity(prev => ({ ...prev, [field]: value }));
  };

  const handleStyleChange = (section: keyof NonNullable<StrategicIdentity['styles']>, field: keyof TextStyle, value: any) => {
    const currentStyles = identity.styles || {};
    const sectionStyle = currentStyles[section] || { font: 'sans-serif', size: 14, color: '#334155' };
    setIdentity({
      ...identity,
      styles: {
        ...currentStyles,
        [section]: { ...sectionStyle, [field]: value }
      }
    });
  };

  const handleSave = () => {
    onUpdate({
      ...data,
      identity,
      visionLine
    });
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
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

  const addMilestone = () => {
    if (visionLine.length >= 5) {
      alert("Limite máximo de 5 anos na Linha da Visão.");
      return;
    }
    const lastYear = visionLine.length > 0 ? visionLine[visionLine.length - 1].year : (identity.horizonStart || new Date().getFullYear());
    const nextYear = lastYear + 1;
    const newMilestone: VisionMilestone = {
      id: Math.random().toString(36).substr(2, 9),
      year: nextYear,
      description: '',
      style: { font: 'sans-serif', size: 14, color: '#334155' }
    };
    setVisionLine([...visionLine, newMilestone].sort((a, b) => a.year - b.year));
  };

  const updateMilestone = (id: string, field: keyof VisionMilestone, value: any) => {
    setVisionLine(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m).sort((a, b) => a.year - b.year));
  };

  const updateMilestoneStyle = (id: string, field: keyof TextStyle, value: any) => {
    setVisionLine(prev => prev.map(m => {
      if (m.id === id) {
        return { ...m, style: { ...(m.style || { font: 'sans-serif', size: 14, color: '#334155' }), [field]: value } };
      }
      return m;
    }));
  };

  const removeMilestone = (id: string) => {
    if(!confirm("Remover este marco?")) return;
    setVisionLine(prev => prev.filter(m => m.id !== id));
  };

  const exportPDF = async () => {
    const element = document.getElementById('one-page-canvas');
    if (!element || !window.html2canvas || !window.jspdf) return;
    const canvas = await window.html2canvas(element, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new window.jspdf.jsPDF('l', 'mm', 'a4'); 
    const w = pdf.internal.pageSize.getWidth();
    const h = (canvas.height * w) / canvas.width;
    pdf.addImage(imgData, 'PNG', 0, (pdf.internal.pageSize.getHeight() - h) / 2, w, h);
    pdf.save(`Canvas_Visao_${identity.companyName}.pdf`);
  };

  const FontEditor = ({ section }: { section: keyof NonNullable<StrategicIdentity['styles']> }) => {
    const style = (identity.styles && identity.styles[section]) || { font: 'sans-serif', size: 14, color: '#334155' };
    return (
      <div className="flex gap-2 items-center bg-white/50 p-1 rounded border mt-2">
        <select className="text-[10px] p-1 border rounded" value={style.font} onChange={e => handleStyleChange(section, 'font', e.target.value)}>
          {FONT_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <input type="number" className="text-[10px] w-10 p-1 border rounded" value={style.size} onChange={e => handleStyleChange(section, 'size', parseInt(e.target.value))} />
        <input type="color" className="w-5 h-5 p-0 border-none bg-transparent" value={style.color} onChange={e => handleStyleChange(section, 'color', e.target.value)} />
      </div>
    );
  };

  const reversedVisionLine = [...visionLine].sort((a, b) => b.year - a.year);

  return (
    <div className="pb-10 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <h2 className="text-2xl font-bold text-blue-900 flex items-center gap-2">
          <i className="ph ph-rocket-launch"></i> Canvas da Visão de Futuro
        </h2>
        
        <div className="flex gap-2">
          {activeSubTab === 'onepage' && (
            <div className="flex items-center gap-4 bg-white p-2 rounded shadow-sm border mr-4">
                <div className="flex items-center gap-2 border-r pr-4">
                    <span className="text-xs font-bold text-slate-400 uppercase">Zoom:</span>
                    <input type="range" min="0.5" max="1.5" step="0.1" value={scale} onChange={(e) => setScale(parseFloat(e.target.value))} className="w-24 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer" />
                </div>
                <Button onClick={exportPDF} variant="secondary">PDF</Button>
            </div>
          )}
          <Button onClick={handleSave}>Salvar Dados</Button>
        </div>
      </div>

      <div className="flex gap-2 border-b border-slate-200 pb-1 overflow-x-auto">
        <button className={`px-6 py-2 text-sm font-bold whitespace-nowrap ${activeSubTab === 'identity' ? 'bg-white text-blue-700 border-b-2 border-blue-700' : 'text-slate-500'}`} onClick={() => setActiveSubTab('identity')}>1. Identidade Estratégica</button>
        <button className={`px-6 py-2 text-sm font-bold whitespace-nowrap ${activeSubTab === 'timeline' ? 'bg-white text-blue-700 border-b-2 border-blue-700' : 'text-slate-500'}`} onClick={() => setActiveSubTab('timeline')}>2. Linha da Visão</button>
        <button className={`px-6 py-2 text-sm font-bold whitespace-nowrap ${activeSubTab === 'onepage' ? 'bg-white text-blue-700 border-b-2 border-blue-700' : 'text-slate-500'}`} onClick={() => setActiveSubTab('onepage')}>3. One Page</button>
      </div>

      {activeSubTab === 'identity' && (
        <div className="bg-white p-6 rounded shadow border animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8 border-b pb-8">
            <div className="col-span-1">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Logomarca</label>
              <div onClick={triggerFileInput} className="w-full h-32 bg-slate-50 border-2 border-dashed rounded flex items-center justify-center cursor-pointer overflow-hidden relative group">
                {identity.logoUrl ? <img src={identity.logoUrl} className="max-h-full max-w-full object-contain p-2" /> : <span className="text-xs text-slate-400">Carregar</span>}
                <input ref={fileInputRef} type="file" className="hidden" onChange={handleLogoUpload} />
              </div>
            </div>
            <div className="col-span-2 space-y-4">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome da Empresa</label>
                    <input type="text" className="w-full p-3 border rounded font-bold" value={identity.companyName} onChange={e => handleIdentityChange('companyName', e.target.value)} />
                </div>
                <div>
                    <label className="block text-xs font-bold text-blue-800 uppercase mb-1">
                      Ano de Referência Principal
                      <Tooltip text="Define o ano base do planejamento e da análise. Todas as metas e resultados estarão vinculados a este ano." />
                    </label>
                    <input type="number" className="w-full p-2 border border-blue-200 rounded bg-blue-50 font-black text-blue-900" value={identity.referenceYear} onChange={e => handleIdentityChange('referenceYear', parseInt(e.target.value))} />
                </div>
            </div>
            <div className="col-span-1 bg-blue-50 p-4 rounded border border-blue-100 h-fit">
               <label className="block text-xs font-bold text-blue-800 uppercase mb-2">Horizonte do Plano</label>
               <div className="flex gap-2 items-center">
                  <input type="number" className="w-full p-2 border rounded text-center" value={identity.horizonStart || ''} onChange={e => handleIdentityChange('horizonStart', parseInt(e.target.value))} />
                  <span>-</span>
                  <input type="number" className="w-full p-2 border rounded text-center" value={identity.horizonEnd || ''} onChange={e => handleIdentityChange('horizonEnd', parseInt(e.target.value))} />
               </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded border">
                <label className="block font-bold text-blue-800 text-sm mb-2">
                  Propósito
                  <Tooltip text="Grandes temas que orientam os objetivos e indicadores estratégicos." />
                </label>
                <textarea 
                  className="w-full p-2 border rounded h-20" 
                  style={{ fontFamily: identity.styles?.purpose?.font, fontSize: `${identity.styles?.purpose?.size}px`, color: identity.styles?.purpose?.color }}
                  value={identity.purpose} 
                  onChange={e => handleIdentityChange('purpose', e.target.value)} 
                />
                <FontEditor section="purpose" />
              </div>
              <div className="bg-slate-50 p-4 rounded border">
                <label className="block font-bold text-slate-700 text-sm mb-2">Negócio</label>
                <textarea 
                  className="w-full p-2 border rounded h-16" 
                  style={{ fontFamily: identity.styles?.business?.font, fontSize: `${identity.styles?.business?.size}px`, color: identity.styles?.business?.color }}
                  value={identity.business} 
                  onChange={e => handleIdentityChange('business', e.target.value)} 
                />
                <FontEditor section="business" />
              </div>
            </div>
            <div className="space-y-4">
              <div className="bg-emerald-50 p-4 rounded border">
                <label className="block font-bold text-emerald-800 text-sm mb-2">
                  Missão
                  <Tooltip text="Declara o propósito permanente da organização e orienta as decisões estratégicas." />
                </label>
                <textarea 
                  className="w-full p-2 border rounded h-16" 
                  style={{ fontFamily: identity.styles?.mission?.font, fontSize: `${identity.styles?.mission?.size}px`, color: identity.styles?.mission?.color }}
                  value={identity.mission} 
                  onChange={e => handleIdentityChange('mission', e.target.value)} 
                />
                <FontEditor section="mission" />
              </div>
              <div className="bg-purple-50 p-4 rounded border">
                <label className="block font-bold text-purple-800 text-sm mb-2">
                  Visão
                  <Tooltip text="Define onde a organização pretende chegar no futuro." />
                </label>
                <textarea 
                  className="w-full p-2 border rounded h-16" 
                  style={{ fontFamily: identity.styles?.vision?.font, fontSize: `${identity.styles?.vision?.size}px`, color: identity.styles?.vision?.color }}
                  value={identity.vision} 
                  onChange={e => handleIdentityChange('vision', e.target.value)} 
                />
                <FontEditor section="vision" />
              </div>
            </div>
            <div className="md:col-span-2 bg-amber-50 p-4 rounded border">
              <label className="block font-bold text-amber-800 text-sm mb-2">
                Valores
                <Tooltip text="Premissas, contexto ou decisões estratégicas relevantes para o ciclo." />
              </label>
              <textarea 
                className="w-full p-2 border rounded h-16" 
                style={{ fontFamily: identity.styles?.values?.font, fontSize: `${identity.styles?.values?.size}px`, color: identity.styles?.values?.color }}
                value={identity.values} 
                onChange={e => handleIdentityChange('values', e.target.value)} 
              />
              <FontEditor section="values" />
            </div>
          </div>
        </div>
      )}
      
      {activeSubTab === 'timeline' && (
        <div className="bg-white p-6 rounded shadow border animate-fade-in">
          <div className="flex justify-between items-center mb-6">
             <h3 className="font-bold">Roadmap da Visão</h3>
             <Button onClick={addMilestone} variant="secondary">+ Adicionar Ano</Button>
          </div>
          <div className="space-y-4">
             {visionLine.map((item) => (
                <div key={item.id} className="flex gap-4 p-4 border rounded relative group bg-slate-50">
                   <div className="w-24">
                      <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Ano</label>
                      <input type="number" className="w-full p-2 border rounded font-bold" value={item.year} onChange={e => updateMilestone(item.id, 'year', parseInt(e.target.value))} />
                   </div>
                   <div className="flex-1">
                      <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Marcos</label>
                      <textarea 
                        className="w-full p-2 border rounded text-sm h-20" 
                        style={{ fontFamily: item.style?.font, fontSize: `${item.style?.size}px`, color: item.style?.color }}
                        value={item.description} 
                        onChange={e => updateMilestone(item.id, 'description', e.target.value)} 
                      />
                      <div className="flex gap-2 items-center mt-2">
                        <select className="text-[10px] p-1 border rounded" value={item.style?.font} onChange={e => updateMilestoneStyle(item.id, 'font', e.target.value)}>
                          {FONT_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                        <input type="number" className="text-[10px] w-10 p-1 border rounded" value={item.style?.size} onChange={e => updateMilestoneStyle(item.id, 'size', parseInt(e.target.value))} />
                        <input type="color" className="w-5 h-5 p-0 border-none bg-transparent" value={item.style?.color} onChange={e => updateMilestoneStyle(item.id, 'color', e.target.value)} />
                      </div>
                   </div>
                   <button onClick={() => removeMilestone(item.id)} className="text-red-300 hover:text-red-500 absolute top-2 right-2"><i className="ph ph-trash"></i></button>
                </div>
             ))}
          </div>
        </div>
      )}

      {activeSubTab === 'onepage' && (
        <div className="flex justify-center bg-slate-200 p-8 rounded border overflow-auto">
          <div id="one-page-canvas" style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: '1123px', minHeight: '794px' }} className="bg-white shadow-2xl p-12 relative flex flex-col">
                <div className="text-center mb-8"><h1 className="text-3xl font-black uppercase tracking-widest text-blue-900 border-b-4 border-blue-900 inline-block pb-2">Mapa Estratégico One Page</h1></div>
                <div className="flex-1 grid grid-cols-12 gap-8">
                   <div className="col-span-3 flex flex-col gap-6">
                      <div className="border rounded-xl p-4 bg-slate-50 flex items-center gap-4">
                         {identity.logoUrl && <img src={identity.logoUrl} className="w-16 h-16 object-contain" />}
                         <div className="font-extrabold text-blue-900 text-xl truncate">{identity.companyName}</div>
                      </div>
                      <div className="border rounded-xl p-4 bg-white text-center">
                          <span className="text-xs text-slate-400 font-bold uppercase block mb-1">Ciclo Estratégico</span>
                          <span className="text-2xl font-black text-blue-800">{identity.horizonStart} - {identity.horizonEnd}</span>
                      </div>
                      <div className="flex-1 border-2 border-dashed border-blue-300 rounded-2xl p-6 bg-white relative">
                          <span className="absolute -top-3 left-6 bg-blue-900 text-white px-3 py-1 rounded text-xs font-bold uppercase">Valores</span>
                          <div className="whitespace-pre-wrap leading-relaxed" style={{ fontFamily: identity.styles?.values?.font, fontSize: `${identity.styles?.values?.size}px`, color: identity.styles?.values?.color }}>{identity.values}</div>
                      </div>
                   </div>
                   <div className="col-span-6 flex flex-col items-center">
                      <div className="w-full p-8 border-4 border-blue-900 rounded-[50%] bg-white text-center shadow-lg relative z-10 min-h-[150px] flex flex-col justify-center">
                          <span className="text-xs text-blue-400 font-bold uppercase block mb-2">Visão de Futuro</span>
                          <p className="font-bold leading-tight" style={{ fontFamily: identity.styles?.vision?.font, fontSize: `${identity.styles?.vision?.size}px`, color: identity.styles?.vision?.color }}>{identity.vision}</p>
                      </div>
                      <div className="w-full flex-1 border border-blue-100 rounded-b-3xl -mt-8 pt-12 px-12 bg-white flex flex-col gap-4 pb-8 overflow-hidden">
                        {reversedVisionLine.map(m => (
                          <div key={m.id} className="flex gap-6 border-b border-slate-100 last:border-0 py-3">
                            <span className="bg-blue-900 text-white text-xs font-black px-3 py-1 rounded h-fit">{m.year}</span>
                            <span className="leading-snug flex-1" style={{ fontFamily: m.style?.font, fontSize: `${m.style?.size}px`, color: m.style?.color }}>{m.description}</span>
                          </div>
                        ))}
                      </div>
                   </div>
                   <div className="col-span-3 flex flex-col gap-6">
                      <div className="border rounded-xl p-4 bg-white relative shadow-sm"><span className="absolute -top-3 right-6 bg-white px-2 text-[10px] font-black text-blue-900 uppercase">Propósito</span><p className="italic text-center leading-relaxed" style={{ fontFamily: identity.styles?.purpose?.font, fontSize: `${identity.styles?.purpose?.size}px`, color: identity.styles?.purpose?.color }}>{identity.purpose}</p></div>
                      <div className="border rounded-xl p-4 bg-white relative shadow-sm"><span className="absolute -top-3 right-6 bg-white px-2 text-[10px] font-black text-blue-900 uppercase">Negócio</span><p className="font-bold text-center leading-relaxed" style={{ fontFamily: identity.styles?.business?.font, fontSize: `${identity.styles?.business?.size}px`, color: identity.styles?.business?.color }}>{identity.business}</p></div>
                      <div className="flex-1 border-2 border-dashed border-blue-300 rounded-2xl p-6 bg-white relative">
                          <span className="absolute -top-3 right-6 bg-blue-900 text-white px-3 py-1 rounded text-xs font-bold uppercase">Missão</span>
                          <div className="text-center leading-relaxed" style={{ fontFamily: identity.styles?.mission?.font, fontSize: `${identity.styles?.mission?.size}px`, color: identity.styles?.mission?.color }}>{identity.mission}</div>
                      </div>
                   </div>
                </div>
                <div className="text-center mt-6 text-xs font-medium text-slate-300 uppercase tracking-widest">Ano Ref: {identity.referenceYear} | SISCONGE Strategic Canvas</div>
          </div>
        </div>
      )}
    </div>
  );
};
