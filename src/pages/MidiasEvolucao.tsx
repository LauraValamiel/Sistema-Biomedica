import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

type Paciente = { id: string; nome_completo: string; };
type Midia = {
  id: string;
  paciente_id: string;
  url_arquivo: string;
  categoria: 'Antes' | 'Durante' | 'Depois';
  procedimento: string;
  data_registro: string;
  observacoes: string;
  pacientes: { nome_completo: string }; // Join do Supabase
};

export default function MidiasEvolucao() {
  const [midias, setMidias] = useState<Midia[]>([]);
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filtros
  const [filtroPaciente, setFiltroPaciente] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');

  // Upload Modal
  const [modalAberto, setModalAberto] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);

  // Lightbox (Visualizador de Imagem)
  const [midiaAmpliada, setMidiaAmpliada] = useState<string | null>(null);
  
  // Form Upload
  const [form, setForm] = useState({
    paciente_id: '',
    categoria: 'Antes',
    procedimento: '',
    data_registro: new Date().toISOString().split('T')[0],
    observacoes: ''
  });

  useEffect(() => {
    buscarDados();
  }, []);

  const buscarDados = async () => {
    setLoading(true);
    const { data: midiasData, error: midiasError } = await supabase
      .from('paciente_midias')
      .select('*, pacientes(nome_completo)')
      .order('data_registro', { ascending: false });
      
    if (midiasData) setMidias(midiasData as any);
    if (midiasError) console.error('Erro ao buscar mídias:', midiasError);

    const { data: pacData } = await supabase.from('pacientes').select('id, nome_completo').order('nome_completo');
    if (pacData) setPacientes(pacData);
    
    setLoading(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setArquivo(e.target.files[0]);
    }
  };

  const salvarMidia = async () => {
    if (!arquivo) return alert('Selecione uma foto para enviar.');
    if (!form.paciente_id) return alert('Selecione o paciente correspondente.');
    if (!form.procedimento) return alert('Informe o nome do procedimento.');

    setUploading(true);

    try {
      const fileExt = arquivo.name.split('.').pop();
      const fileName = `${form.paciente_id}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage.from('midias').upload(fileName, arquivo, {
        cacheControl: '3600',
        upsert: false
      });

      if (uploadError) throw new Error(`Erro no upload: ${uploadError.message}`);

      const { data: publicUrlData } = supabase.storage.from('midias').getPublicUrl(fileName);

      const payload = {
        paciente_id: form.paciente_id,
        url_arquivo: publicUrlData.publicUrl,
        categoria: form.categoria,
        procedimento: form.procedimento,
        data_registro: form.data_registro,
        observacoes: form.observacoes
      };

      const { error: dbError } = await supabase.from('paciente_midias').insert([payload]);
      
      if (dbError) throw new Error(`Erro ao salvar no banco: ${dbError.message}`);

      alert('Foto salva com sucesso!');
      setModalAberto(false);
      setArquivo(null);
      setForm({ ...form, procedimento: '', observacoes: '' });
      buscarDados();

    } catch (error: any) {
      alert(error.message);
    } finally {
      setUploading(false);
    }
  };

  const deletarMidia = async (id: string, url_arquivo: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta foto permanentemente?')) {
      await supabase.from('paciente_midias').delete().eq('id', id);
      try {
        const fileName = url_arquivo.split('/').pop();
        if (fileName) await supabase.storage.from('midias').remove([fileName]);
      } catch (e) {}
      buscarDados();
    }
  };

  const baixarImagem = async (url: string, nomePaciente: string, categoria: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      // Adicionado a "categoria" ao nome do ficheiro gerado
      link.download = `Evolucao_${categoria}_${nomePaciente.replace(/\s+/g, '_')}_${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      // Fallback: se o navegador bloquear o download direto por causa do CORS, abre num separador novo
      window.open(url, '_blank');
    }
  };

  const midiasFiltradas = midias.filter(m => {
    const matchPaciente = filtroPaciente ? m.paciente_id === filtroPaciente : true;
    const matchCategoria = filtroCategoria ? m.categoria === filtroCategoria : true;
    return matchPaciente && matchCategoria;
  });

  return (
    <div className="w-full h-full flex flex-col mx-auto overflow-x-hidden box-border sm:p-8 max-w-7xl">
      
      {/* CABEÇALHO RESPONSIVO: Empilha no telemóvel */}
      <header className="px-4 pt-6 pb-4 sm:p-0 flex flex-col sm:flex-row justify-between sm:items-center gap-4 w-full shrink-0 mb-4 sm:mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-light text-gray-800">Mídias e Evolução</h1>
          <p className="text-sm md:text-base text-gray-500 mt-1">Galeria de acompanhamento clínico de resultados</p>
        </div>
        <button onClick={() => setModalAberto(true)} className="bg-[#B68B40] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#9a7330] shadow-sm flex items-center justify-center gap-2 w-full sm:w-auto shrink-0">
          + Adicionar Foto
        </button>
      </header>

      {/* CAIXA BRANCA E FILTROS: Edge-to-Edge no mobile */}
      <div className="bg-white sm:rounded-lg border-y sm:border border-[#B68B40]/30 shadow-sm flex-1 flex flex-col overflow-hidden w-full">
        
        {/* BARRA DE FILTROS */}
        <div className="p-4 sm:p-6 border-b border-[#B68B40]/20 bg-[#FDFCFB] flex flex-col sm:flex-row gap-4 shrink-0 w-full">
          <div className="flex-1 sm:max-w-xs">
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Filtrar por Paciente</label>
            <select value={filtroPaciente} onChange={e => setFiltroPaciente(e.target.value)} className="w-full border border-gray-300 p-2.5 text-sm rounded-lg outline-none focus:border-[#B68B40] bg-white">
              <option value="">Todos os pacientes</option>
              {pacientes.map(p => <option key={p.id} value={p.id}>{p.nome_completo}</option>)}
            </select>
          </div>
          <div className="flex-1 sm:max-w-[200px]">
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Evolução</label>
            <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)} className="w-full border border-gray-300 p-2.5 text-sm rounded-lg outline-none focus:border-[#B68B40] bg-white">
              <option value="">Todas as fotos</option>
              <option value="Antes">Antes do Procedimento</option>
              <option value="Durante">Durante o Tratamento</option>
              <option value="Depois">Depois (Resultado Final)</option>
            </select>
          </div>
        </div>

        {/* GALERIA (GRID) */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 bg-gray-50/30">
          {loading ? (
            <p className="text-center text-gray-400 py-10">Carregando galeria...</p>
          ) : midiasFiltradas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-4">
              <div className="text-5xl mb-4 opacity-30">📸</div>
              <h3 className="text-lg font-medium text-gray-800 mb-2">Nenhuma foto encontrada</h3>
              <p className="text-gray-500 text-sm max-w-md">Faça o upload das imagens dos seus procedimentos para acompanhar a evolução dos seus pacientes.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
              {midiasFiltradas.map(midia => (
                <div key={midia.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all group relative flex flex-col h-full">
                  
                  {/* Etiqueta Flutuante de Categoria */}
                  <div className={`absolute top-3 left-3 px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold text-white shadow-sm z-10 uppercase tracking-wider ${
                    midia.categoria === 'Antes' ? 'bg-gray-600' : 
                    midia.categoria === 'Depois' ? 'bg-[#B68B40]' : 'bg-emerald-600'
                  }`}>
                    {midia.categoria}
                  </div>

                  {/* Imagem Clicável (Abre no Visualizador Interno) */}
                  <div 
                    className="h-48 sm:h-56 w-full bg-gray-100 relative shrink-0 cursor-pointer"
                    onClick={() => setMidiaAmpliada(midia.url_arquivo)}
                  >
                    <img src={midia.url_arquivo} alt="Evolução" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <svg className="w-8 h-8 text-white drop-shadow-md" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /></svg>
                    </div>
                  </div>
                  
                  {/* Rodapé da Foto */}
                  <div className="p-4 flex flex-col flex-1">
                    <p className="font-bold text-gray-800 text-sm truncate" title={midia.pacientes?.nome_completo}>{midia.pacientes?.nome_completo || 'Paciente Desconhecido'}</p>
                    <p className="text-xs text-[#B68B40] font-medium mt-1 truncate">{midia.procedimento}</p>
                    
                    <div className="flex justify-between items-center mt-auto pt-4 border-t border-gray-100">
                      <span className="text-[10px] text-gray-400 font-medium">Data: {new Date(midia.data_registro).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</span>
                      <div className="flex items-center gap-1 sm:gap-2">
                        {/* Ícone de Download */}
                        <button 
                          onClick={() => baixarImagem(midia.url_arquivo, midia.pacientes?.nome_completo || 'paciente', midia.categoria)} 
                          className="text-[#B68B40] hover:text-[#9a7330] p-1.5 rounded-md hover:bg-[#B68B40]/10 transition-colors" 
                          title="Baixar Foto"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        </button>
                        {/* Ícone de Lixeira */}
                        <button 
                          onClick={() => deletarMidia(midia.id, midia.url_arquivo)} 
                          className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-md transition-colors" 
                          title="Excluir Foto"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* --- MODAL DE UPLOAD DE NOVA MÍDIA --- */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-2 sm:p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg h-[95vh] sm:h-auto sm:max-h-[90vh] overflow-hidden flex flex-col mx-auto">
            <div className="p-4 sm:p-5 border-b border-gray-100 flex justify-between items-center bg-[#FDFCFB] shrink-0">
              <h2 className="text-lg sm:text-xl font-medium text-[#B68B40]">Adicionar Nova Foto</h2>
              <button onClick={() => setModalAberto(false)} className="text-gray-400 text-2xl hover:text-gray-700" disabled={uploading}>&times;</button>
            </div>
            
            <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 flex-1 overflow-y-auto overflow-x-hidden">
              
              <div>
                <label className="block text-[10px] sm:text-xs font-bold text-gray-600 uppercase tracking-wider mb-1 sm:mb-2">Paciente *</label>
                <select value={form.paciente_id} onChange={e => setForm({...form, paciente_id: e.target.value})} className="w-full border border-gray-300 rounded-lg p-2.5 sm:p-3 text-sm focus:border-[#B68B40] outline-none bg-white">
                  <option value="">Selecione o paciente...</option>
                  {pacientes.map(p => <option key={p.id} value={p.id}>{p.nome_completo}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-[10px] sm:text-xs font-bold text-gray-600 uppercase tracking-wider mb-1 sm:mb-2">Etapa *</label>
                  <select value={form.categoria} onChange={e => setForm({...form, categoria: e.target.value as any})} className="w-full border border-gray-300 rounded-lg p-2.5 sm:p-3 text-sm focus:border-[#B68B40] outline-none bg-white">
                    <option value="Antes">Antes</option>
                    <option value="Durante">Durante</option>
                    <option value="Depois">Depois</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] sm:text-xs font-bold text-gray-600 uppercase tracking-wider mb-1 sm:mb-2">Data da Foto *</label>
                  <input type="date" value={form.data_registro} onChange={e => setForm({...form, data_registro: e.target.value})} className="w-full border border-gray-300 rounded-lg p-2.5 sm:p-3 text-sm focus:border-[#B68B40] outline-none bg-white" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] sm:text-xs font-bold text-gray-600 uppercase tracking-wider mb-1 sm:mb-2">Procedimento *</label>
                <input type="text" value={form.procedimento} onChange={e => setForm({...form, procedimento: e.target.value})} placeholder="Ex: Lipo Enzimática de Papada" className="w-full border border-gray-300 rounded-lg p-2.5 sm:p-3 text-sm focus:border-[#B68B40] outline-none" />
              </div>

              {/* OPÇÕES DUPLAS PARA A CÂMARA OU GALERIA */}
              <div>
                <label className="block text-[10px] sm:text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Imagem da Evolução *</label>
                
                {/* Inputs invisíveis */}
                <input type="file" accept="image/*" capture="environment" id="cameraInputGlobal" onChange={handleFileChange} className="hidden" />
                <input type="file" accept="image/*" id="galleryInputGlobal" onChange={handleFileChange} className="hidden" />
                
                <div className="flex flex-col sm:flex-row gap-3">
                  <label htmlFor="cameraInputGlobal" className="flex-1 flex items-center justify-center gap-2 bg-[#B68B40]/10 text-[#B68B40] hover:bg-[#B68B40]/20 border border-[#B68B40]/30 rounded-lg p-3 cursor-pointer transition-colors text-sm font-bold">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    Tirar Foto na Hora
                  </label>
                  
                  <label htmlFor="galleryInputGlobal" className="flex-1 flex items-center justify-center gap-2 bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200 rounded-lg p-3 cursor-pointer transition-colors text-sm font-medium">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    Escolher da Galeria
                  </label>
                </div>

                {/* Mensagem de sucesso quando a foto for selecionada */}
                {arquivo && (
                  <div className="mt-3 flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 border border-emerald-100 p-2.5 rounded-lg">
                    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    <span className="truncate font-medium">Imagem selecionada: {arquivo.name}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[10px] sm:text-xs font-bold text-gray-600 uppercase tracking-wider mb-1 sm:mb-2">Observações Técnicas</label>
                <textarea value={form.observacoes} onChange={e => setForm({...form, observacoes: e.target.value})} placeholder="Ex: Paciente apresentou leve edema lateral..." className="w-full border border-gray-300 rounded-lg p-2.5 sm:p-3 text-sm focus:border-[#B68B40] outline-none h-20 sm:h-24" />
              </div>

            </div>

            <div className="p-4 sm:p-5 border-t border-gray-100 bg-gray-50 flex flex-col sm:flex-row justify-end gap-3 sm:gap-4 shrink-0">
              <button onClick={() => setModalAberto(false)} disabled={uploading} className="px-6 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 bg-gray-200 sm:bg-transparent rounded-lg sm:rounded-none disabled:opacity-50">Cancelar</button>
              <button onClick={salvarMidia} disabled={uploading} className="bg-[#B68B40] text-white px-8 py-2.5 rounded-lg text-sm font-medium hover:bg-[#9a7330] shadow-sm disabled:opacity-50 flex items-center justify-center gap-2">
                {uploading ? 'Enviando foto...' : 'Fazer Upload'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- LIGHTBOX (VISUALIZADOR DE FOTO EM ECRÃ INTEIRO) --- */}
      {midiaAmpliada && (
        <div 
          className="fixed inset-0 bg-black/95 flex items-center justify-center z-[9999] p-2 sm:p-8 backdrop-blur-sm"
          onClick={() => setMidiaAmpliada(null)}
        >
          <button 
            onClick={() => setMidiaAmpliada(null)} 
            className="absolute top-4 right-4 text-white hover:text-gray-300 p-2 z-50 bg-black/50 rounded-full"
            title="Fechar Imagem"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 sm:h-8 sm:w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          <img 
            src={midiaAmpliada} 
            alt="Mídia Ampliada" 
            className="max-w-full max-h-full object-contain rounded-md shadow-2xl" 
            onClick={(e) => e.stopPropagation()} 
          />
        </div>
      )}

    </div>
  );
}