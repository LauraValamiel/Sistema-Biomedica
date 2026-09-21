import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

// Tipagens
type Campo = { id: string; label: string; tipo: string; opcoes?: string[] };
type ModeloTermo = { id: string; titulo: string; conteudo: string; campos: Campo[] };

export default function DocumentosTermos() {
  const [modelos, setModelos] = useState<ModeloTermo[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Controle de Telas (Lista vs Edição/Criação vs Visualização)
  const [modo, setModo] = useState<'lista' | 'criando' | 'visualizando'>('lista');
  const [modeloVisualizar, setModeloVisualizar] = useState<ModeloTermo | null>(null);

  // Estados do Construtor de Termos
  const [formId, setFormId] = useState<string | null>(null);
  const [formTitulo, setFormTitulo] = useState('');
  const [formConteudo, setFormConteudo] = useState('');
  const [formCampos, setFormCampos] = useState<Campo[]>([]);

  // ESTADOS PARA OS AVISOS BONITOS (Toasts e Confirmações)
  const [toast, setToast] = useState<{ show: boolean, msg: string, type: 'success' | 'error' }>({ show: false, msg: '', type: 'success' });
  const [confirmDialog, setConfirmDialog] = useState<{ show: boolean, msg: string, action: (() => void) | null }>({ show: false, msg: '', action: null });

  useEffect(() => {
    buscarModelos();
  }, []);

  // FUNÇÃO PARA EXIBIR O TOAST
  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ show: true, msg, type });
    setTimeout(() => setToast(t => ({ ...t, show: false })), 3500);
  };

  const buscarModelos = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('modelos_termos')
      .select('*')
      .order('titulo', { ascending: true });

    if (error) {
      console.error('Erro ao buscar termos:', error);
      showToast(`Erro ao buscar documentos: ${error.message}`, 'error');
    } else if (data) {
      setModelos(data);
    }
    setLoading(false);
  };

  const deletarModelo = (id: string) => {
    setConfirmDialog({
      show: true,
      msg: 'Tem a certeza que deseja excluir este modelo de termo? Os documentos já assinados pelos pacientes não serão afetados.',
      action: async () => {
        const { error } = await supabase.from('modelos_termos').delete().eq('id', id);
        if (error) {
          showToast(`Erro ao excluir: ${error.message}`, 'error');
        } else {
          showToast('Termo excluído com sucesso.', 'success');
          if (modeloVisualizar?.id === id) setModo('lista');
          buscarModelos();
        }
        setConfirmDialog({ show: false, msg: '', action: null });
      }
    });
  };

  const salvarModelo = async () => {
    if (!formTitulo) return showToast('Dê um título para o documento (ex: TCLE - Lipo Enzimática).', 'error');
    if (!formConteudo) return showToast('O conteúdo do documento não pode estar vazio.', 'error');

    const payload = { 
      titulo: formTitulo, 
      conteudo: formConteudo,
      campos: formCampos 
    };
    
    if (formId) {
      const { error } = await supabase.from('modelos_termos').update(payload).eq('id', formId);
      if (error) {
        showToast(`Erro ao atualizar termo: ${error.message}`, 'error');
      } else {
        showToast('Termo atualizado com sucesso!', 'success');
        setModo('lista');
        buscarModelos();
      }
    } else {
      const { error } = await supabase.from('modelos_termos').insert([payload]);
      if (error) {
        showToast(`Erro ao salvar termo: ${error.message}`, 'error');
      } else {
        showToast('Novo Termo salvo com sucesso!', 'success');
        setModo('lista');
        buscarModelos();
      }
    }
  };

  const visualizarModelo = (modelo: ModeloTermo) => {
    setModeloVisualizar(modelo);
    setModo('visualizando');
  };

  const editarModelo = (modelo: ModeloTermo) => {
    setFormId(modelo.id);
    setFormTitulo(modelo.titulo);
    setFormConteudo(modelo.conteudo);
    setFormCampos(modelo.campos || []);
    setModo('criando');
  };

  // --- FUNÇÕES DE CAMPOS EXTRAS (Lote, Região, etc) ---
  const adicionarCampo = () => {
    const idCampo = `campo_extra_${Date.now()}`;
    setFormCampos([...formCampos, { id: idCampo, label: '', tipo: 'text' }]);
  };

  const atualizarCampo = (index: number, chave: keyof Campo, valor: any) => {
    const novosCampos = [...formCampos];
    novosCampos[index] = { ...novosCampos[index], [chave]: valor };
    setFormCampos(novosCampos);
  };

  const removerCampo = (index: number) => {
    const novosCampos = [...formCampos];
    novosCampos.splice(index, 1);
    setFormCampos(novosCampos);
  };

  const abrirNovoModelo = () => {
    setFormId(null);
    setFormTitulo('');
    setFormConteudo('');
    setFormCampos([]);
    setModo('criando');
  };

  return (
    <div className="w-full h-full flex flex-col mx-auto overflow-x-hidden box-border sm:p-8 max-w-7xl relative">
      
      {/* TOAST CUSTOMIZADO (Aviso Flutuante Moderno) */}
      {toast.show && (
        <div className={`fixed top-6 right-6 z-[99999] flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-2xl text-sm font-medium text-white border transition-all duration-300 transform translate-y-0 opacity-100 ${toast.type === 'success' ? 'bg-emerald-500 border-emerald-600' : 'bg-red-500 border-red-600'}`}>
          {toast.type === 'success' ? (
             <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          ) : (
             <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          )}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO CUSTOMIZADO */}
      {confirmDialog.show && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[99999] p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 md:p-8 max-w-sm w-full text-center transform transition-all">
            <div className="w-14 h-14 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-5">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Atenção!</h3>
            <p className="text-sm text-gray-500 mb-8 px-2">{confirmDialog.msg}</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setConfirmDialog({ show: false, msg: '', action: null })} className="px-5 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors w-1/2">Cancelar</button>
              <button onClick={() => confirmDialog.action && confirmDialog.action()} className="px-5 py-2.5 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors w-1/2 shadow-sm">Confirmar</button>
            </div>
          </div>
        </div>
      )}

      <header className="px-4 pt-6 pb-4 sm:p-0 flex flex-col sm:flex-row justify-between sm:items-center gap-4 w-full shrink-0 mb-4 sm:mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-light text-gray-800">Documentos e Termos Legais</h1>
          <p className="text-sm md:text-base text-gray-500 mt-1">Gestão de textos para Autorizações e TCLEs</p>
        </div>
        
        {modo === 'lista' ? (
          <button onClick={abrirNovoModelo} className="bg-[#B68B40] text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-[#9a7330] transition-colors shadow-sm w-full sm:w-auto">
            + Criar Novo Termo
          </button>
        ) : (
          <button onClick={() => setModo('lista')} className="text-gray-500 hover:text-gray-800 font-medium text-sm w-full sm:w-auto text-left sm:text-right transition-colors">
            ← Voltar para a Lista
          </button>
        )}
      </header>

      <div className="bg-white sm:rounded-xl border-y sm:border border-[#B68B40]/30 shadow-sm flex-1 flex flex-col overflow-hidden w-full">
        
        {/* --- TELA DA LISTA DE TERMOS --- */}
        {modo === 'lista' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-gray-50/30">
            {loading ? (
              <p className="text-center text-gray-400 py-10">A carregar documentos...</p>
            ) : modelos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                <svg className="w-12 h-12 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                <h3 className="text-lg font-medium text-gray-800 mb-2">Nenhum termo encontrado</h3>
                <p className="text-gray-500 text-sm max-w-md mb-6">Você ainda não possui termos ou autorizações cadastradas.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {modelos.map(modelo => (
                  <div 
                    key={modelo.id} 
                    onClick={() => visualizarModelo(modelo)}
                    className="p-5 sm:p-6 border border-gray-200 rounded-xl hover:border-[#B68B40] transition-all bg-white flex flex-col h-full shadow-sm hover:shadow-md cursor-pointer"
                  >
                    <div className="flex-1">
                      {/* Ícone Minimalista de Caneta/Documento */}
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#B68B40]/10 text-[#B68B40] rounded-full flex items-center justify-center mb-4">
                        <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      </div>
                      <h3 className="font-medium text-gray-800 text-lg mb-1">{modelo.titulo}</h3>
                      <p className="text-xs text-gray-500 mb-4 line-clamp-2 leading-relaxed">{modelo.conteudo}</p>
                    </div>
                    
                    <div className="flex justify-between items-center pt-4 border-t border-gray-100 mt-auto">
                      <span className="text-[10px] sm:text-xs text-[#B68B40] font-bold uppercase tracking-wider">{modelo.campos?.length || 0} Extras</span>
                      <div className="flex gap-4">
                        <button onClick={(e) => { e.stopPropagation(); editarModelo(modelo); }} className="flex items-center gap-1 text-[#B68B40] font-bold text-xs hover:underline transition-colors">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                          Editar
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); deletarModelo(modelo.id); }} className="flex items-center gap-1 text-red-500 font-bold text-xs hover:underline transition-colors">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          Excluir
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* --- TELA DE VISUALIZAÇÃO --- */}
        {modo === 'visualizando' && modeloVisualizar && (
          <div className="flex-1 flex flex-col h-full bg-gray-50/50 overflow-x-hidden">
            <div className="p-4 sm:p-6 border-b border-gray-200 bg-white flex justify-between items-center shrink-0">
              <h2 className="text-xl sm:text-2xl font-serif text-[#B68B40] truncate pr-4">{modeloVisualizar.titulo}</h2>
              <button onClick={() => editarModelo(modeloVisualizar)} className="flex items-center gap-1.5 text-sm font-medium text-[#B68B40] hover:underline shrink-0 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                Editar Termo
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
              
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 sm:p-6 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                {modeloVisualizar.conteudo}
              </div>

              {modeloVisualizar.campos && modeloVisualizar.campos.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 sm:p-6">
                  <h3 className="text-sm font-bold text-[#B68B40] uppercase tracking-wider mb-4">Campos Extras Solicitados no Preenchimento</h3>
                  <div className="space-y-3">
                    {modeloVisualizar.campos.map((campo) => (
                      <div key={campo.id} className="pb-3 border-b border-gray-50 last:border-0 last:pb-0 flex flex-col sm:flex-row sm:items-center gap-1">
                        <span className="font-medium text-gray-800 text-sm">{campo.label}</span>
                        <span className="text-xs text-gray-400 capitalize sm:ml-2">({campo.tipo})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- TELA DE CRIAÇÃO OU EDIÇÃO --- */}
        {modo === 'criando' && (
          <div className="flex-1 flex flex-col h-full bg-gray-50/50 overflow-x-hidden">
            <div className="p-4 sm:p-6 border-b border-gray-200 bg-white shrink-0">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                {formId ? 'Editar Título do Termo' : 'Título do Novo Termo'}
              </label>
              <input 
                type="text" 
                placeholder="Ex: TCLE - Preenchimento Labial" 
                value={formTitulo}
                onChange={e => setFormTitulo(e.target.value)}
                className="w-full max-w-2xl border border-gray-300 rounded-lg p-3 text-base sm:text-lg font-medium focus:outline-none focus:border-[#B68B40]"
                autoFocus
              />
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 sm:space-y-8">
              
              {/* TEXTO DO DOCUMENTO */}
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden p-4 sm:p-6">
                <label className="block text-xs sm:text-sm font-bold text-[#B68B40] uppercase tracking-wider mb-3 sm:mb-4">Corpo do Documento (Texto Jurídico)</label>
                <p className="text-xs text-gray-500 mb-3 leading-relaxed">
                  Digite ou cole o texto completo do termo de consentimento. Este texto aparecerá para o paciente ler antes de assinar. 
                  (A declaração padrão de aceitação, data e assinaturas serão adicionadas automaticamente pelo sistema no final).
                </p>
                <textarea 
                  value={formConteudo}
                  onChange={e => setFormConteudo(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-3 sm:p-4 text-sm focus:outline-none focus:border-[#B68B40] h-64 sm:h-96 leading-relaxed text-gray-700"
                  placeholder="Por meio deste termo, declaro que fui devidamente informado(a)..."
                />
              </div>

              {/* CAMPOS EXTRAS ESPECÍFICOS */}
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden p-4 sm:p-6">
                <label className="block text-xs sm:text-sm font-bold text-[#B68B40] uppercase tracking-wider mb-3 sm:mb-4">Campos Extras Específicos</label>
                <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                  Adicione campos que precisam ser preenchidos especificamente para este termo (Ex: Lote, Validade, Produto Utilizado, Região Tratada).
                </p>

                <div className="space-y-4">
                  {formCampos.map((campo, cIdx) => (
                    <div key={campo.id} className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-center p-4 border border-gray-100 rounded-lg bg-gray-50/50 relative">
                      <div className="flex-1 w-full pr-6 sm:pr-0">
                        <label className="block text-xs text-gray-500 mb-1 font-medium">Nome do Campo (Label)</label>
                        <input type="text" value={campo.label} onChange={e => atualizarCampo(cIdx, 'label', e.target.value)} placeholder="Ex: Lote do Produto" className="w-full border border-gray-300 rounded p-2.5 text-sm focus:border-[#B68B40] outline-none bg-white"/>
                      </div>
                      <div className="w-full sm:w-1/3">
                        <label className="block text-xs text-gray-500 mb-1 font-medium">Tipo de Resposta</label>
                        <select value={campo.tipo} onChange={e => atualizarCampo(cIdx, 'tipo', e.target.value)} className="w-full border border-gray-300 rounded p-2.5 text-sm focus:border-[#B68B40] outline-none bg-white">
                          <option value="text">Texto Curto</option>
                          <option value="textarea">Texto Longo</option>
                          <option value="date">Data</option>
                        </select>
                      </div>
                      <button onClick={() => removerCampo(cIdx)} className="absolute top-4 right-4 sm:static text-gray-400 hover:text-red-500 sm:mt-5 transition-colors" title="Remover Campo">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  ))}
                  
                  <button onClick={adicionarCampo} className="border border-dashed border-[#B68B40] text-[#B68B40] px-6 py-2 rounded-lg text-sm font-bold hover:bg-[#B68B40]/5 transition-colors w-full sm:w-auto mt-2">
                    + Adicionar Campo Extra
                  </button>
                </div>
              </div>

            </div>

            <div className="p-4 sm:p-5 border-t border-gray-200 bg-white flex flex-col sm:flex-row justify-end gap-3 sm:gap-4 shrink-0">
              <button onClick={() => setModo('lista')} className="px-6 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 bg-gray-100 sm:bg-transparent rounded-lg sm:rounded-none transition-colors">
                Cancelar
              </button>
              <button onClick={salvarModelo} className="bg-[#B68B40] text-white px-8 py-2.5 rounded-lg text-sm font-medium hover:bg-[#9a7330] shadow-sm transition-colors">
                {formId ? 'Atualizar Documento' : 'Salvar Novo Documento'}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}