import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

// Tipagens para o motor dinâmico
type Campo = { id: string; label: string; tipo: string; opcoes?: string[] };
type Secao = { titulo: string; campos: Campo[] };
type ModeloFicha = { id: string; titulo: string; campos: Secao[]; created_at: string };

// --- MODELOS PADRÃO (SÃO CARREGADOS AUTOMATICAMENTE SE O BANCO ESTIVER VAZIO) ---
const MODELOS_PADRAO: Record<string, Secao[]> = {
  'Anamnese Facial': [
    { titulo: 'Queixa Principal', campos: [
      { id: 'facial_queixa', label: 'O que mais incomoda na sua pele?', tipo: 'text' },
      { id: 'facial_tempo', label: 'Há quanto tempo percebe essa alteração?', tipo: 'text' },
      { id: 'facial_trat_ant', label: 'Já realizou algum tratamento estético anteriormente? Qual?', tipo: 'text' }
    ]},
    { titulo: 'Hábitos de Vida', campos: [
      { id: 'facial_fuma', label: 'Fuma', tipo: 'checkbox' },
      { id: 'facial_alcool', label: 'Consome bebida alcoólica', tipo: 'checkbox' },
      { id: 'facial_agua', label: 'Ingere água regularmente', tipo: 'checkbox' },
      { id: 'facial_skincare', label: 'Faz rotina de skincare? Produtos utilizados:', tipo: 'text' }
    ]},
    { titulo: 'Histórico de Saúde', campos: [
      { id: 'facial_doencas', label: 'Possui alguma doença?', tipo: 'text' },
      { id: 'facial_medic', label: 'Faz uso contínuo de medicamentos?', tipo: 'text' },
      { id: 'facial_alergias', label: 'Possui alergias?', tipo: 'text' },
      { id: 'facial_gestante', label: 'Está gestante ou amamentando?', tipo: 'select', opcoes: ['Não', 'Sim'] }
    ]},
    { titulo: 'Avaliação Profissional', campos: [
      { id: 'facial_pele', label: 'Tipo de Pele', tipo: 'select', opcoes: ['Normal', 'Seca', 'Oleosa', 'Mista', 'Sensível'] },
      { id: 'facial_foto', label: 'Fototipo', tipo: 'text' },
      { id: 'facial_obs', label: 'Avaliação Clínica (Acne, Manchas, Flacidez, etc.)', tipo: 'textarea' }
    ]}
  ],
  'Anamnese Corporal': [
    { titulo: 'Queixa Principal', campos: [
      { id: 'corp_queixas', label: 'Selecione as queixas principais:', tipo: 'multiselect', opcoes: ['Gordura localizada', 'Flacidez', 'Celulite', 'Estrias', 'Retenção de líquidos', 'Modelagem corporal'] },
    ]},
    { titulo: 'Avaliação Corporal & Medidas', campos: [
      { id: 'corp_biotipo', label: 'Biotipo', tipo: 'select', opcoes: ['Ectomorfo', 'Mesomorfo', 'Endomorfo'] },
      { id: 'corp_peso', label: 'Peso (kg)', tipo: 'text' },
      { id: 'corp_altura', label: 'Altura (m)', tipo: 'text' },
      { id: 'corp_cintura', label: 'Cintura (cm)', tipo: 'text' },
      { id: 'corp_abdomen', label: 'Abdômen (cm)', tipo: 'text' },
      { id: 'corp_quadril', label: 'Quadril (cm)', tipo: 'text' }
    ]},
    { titulo: 'Histórico de Saúde', campos: [
      { id: 'corp_saude', label: 'Hipertensão / Diabetes / Problemas circulatórios?', tipo: 'textarea' },
      { id: 'corp_cirur', label: 'Já realizou cirurgias? Quais?', tipo: 'text' }
    ]}
  ],
  'Anamnese - Microvasos': [
    { titulo: 'Histórico de Saúde Vascular', campos: [
      { id: 'vasos_hiper', label: 'Você tem hipertensão arterial?', tipo: 'select', opcoes: ['Não', 'Sim'] },
      { id: 'vasos_circ', label: 'Possui algum problema circulatório ou histórico de trombose?', tipo: 'select', opcoes: ['Não', 'Sim'] },
      { id: 'vasos_anti', label: 'Faz uso de anticoagulantes?', tipo: 'select', opcoes: ['Não', 'Sim'] },
      { id: 'vasos_hist', label: 'Tem histórico familiar de varizes?', tipo: 'select', opcoes: ['Não', 'Sim'] }
    ]},
    { titulo: 'Avaliação Vascular', campos: [
      { id: 'vasos_pres', label: 'Presença de telangiectasias (vasinhos superficiais)?', tipo: 'select', opcoes: ['Não', 'Sim'] },
      { id: 'vasos_edema', label: 'Apresenta edema ou manchas?', tipo: 'select', opcoes: ['Não', 'Sim'] },
      { id: 'vasos_obs', label: 'Observações profissionais', tipo: 'textarea' }
    ]}
  ]
};

export default function FichasAnamnese() {
  const [modelos, setModelos] = useState<ModeloFicha[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Controle de Modo (Lista vs Edição/Criação vs Visualização)
  const [modo, setModo] = useState<'lista' | 'criando' | 'visualizando'>('lista');
  const [modeloVisualizar, setModeloVisualizar] = useState<ModeloFicha | null>(null);

  // Estados do Formulário de Edição/Criação
  const [formId, setFormId] = useState<string | null>(null);
  const [formTitulo, setFormTitulo] = useState('');
  const [formSecoes, setFormSecoes] = useState<Secao[]>([]);

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
      .from('modelos_fichas')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar modelos:', error);
      setLoading(false);
      return;
    }

    if (data && data.length === 0) {
      const promessas = Object.entries(MODELOS_PADRAO).map(([titulo, campos]) => {
        return supabase.from('modelos_fichas').insert([{ titulo, campos }]);
      });
      await Promise.all(promessas);

      const { data: dadosNovos } = await supabase
        .from('modelos_fichas')
        .select('*')
        .order('created_at', { ascending: false });

      if (dadosNovos) setModelos(dadosNovos);
    } else if (data) {
      setModelos(data);
    }

    setLoading(false);
  };

  const deletarModelo = (id: string) => {
    setConfirmDialog({
      show: true,
      msg: 'Tem a certeza que deseja excluir este modelo de ficha? As fichas de pacientes já preenchidas não serão afetadas.',
      action: async () => {
        const { error } = await supabase.from('modelos_fichas').delete().eq('id', id);
        if (error) {
          showToast(`Erro ao excluir: ${error.message}`, 'error');
        } else {
          showToast('Modelo excluído com sucesso.', 'success');
          if (modeloVisualizar?.id === id) setModo('lista');
          buscarModelos();
        }
        setConfirmDialog({ show: false, msg: '', action: null });
      }
    });
  };

  const salvarModelo = async () => {
    if (!formTitulo) return showToast('Dê um título para a ficha (ex: Anamnese Facial).', 'error');
    if (formSecoes.length === 0) return showToast('Adicione pelo menos uma seção à ficha.', 'error');

    const payload = { titulo: formTitulo, campos: formSecoes };
    
    if (formId) {
      const { error } = await supabase.from('modelos_fichas').update(payload).eq('id', formId);
      if (error) {
        showToast(`Erro ao atualizar modelo: ${error.message}`, 'error');
      } else {
        showToast('Modelo de ficha atualizado com sucesso!', 'success');
        setModo('lista');
        buscarModelos();
      }
    } else {
      const { error } = await supabase.from('modelos_fichas').insert([payload]);
      if (error) {
        showToast(`Erro ao salvar modelo: ${error.message}`, 'error');
      } else {
        showToast('Novo modelo de ficha salvo com sucesso!', 'success');
        setModo('lista');
        buscarModelos();
      }
    }
  };

  const visualizarModelo = (modelo: ModeloFicha) => {
    setModeloVisualizar(modelo);
    setModo('visualizando');
  };

  const editarModelo = (modelo: ModeloFicha) => {
    setFormId(modelo.id);
    setFormTitulo(modelo.titulo);
    setFormSecoes(modelo.campos);
    setModo('criando');
  };

  // --- FUNÇÕES DO CONSTRUTOR ---
  const adicionarSecao = () => setFormSecoes([...formSecoes, { titulo: '', campos: [] }]);
  const atualizarTituloSecao = (index: number, valor: string) => {
    const novasSecoes = [...formSecoes];
    novasSecoes[index].titulo = valor;
    setFormSecoes(novasSecoes);
  };
  const removerSecao = (index: number) => {
    const novasSecoes = [...formSecoes];
    novasSecoes.splice(index, 1);
    setFormSecoes(novasSecoes);
  };
  const adicionarCampo = (secaoIndex: number) => {
    const novasSecoes = [...formSecoes];
    const idCampo = `campo_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    novasSecoes[secaoIndex].campos.push({ id: idCampo, label: '', tipo: 'text' });
    setFormSecoes(novasSecoes);
  };
  const atualizarCampo = (secaoIndex: number, campoIndex: number, chave: keyof Campo, valor: any) => {
    const novasSecoes = [...formSecoes];
    if (chave === 'opcoes') novasSecoes[secaoIndex].campos[campoIndex].opcoes = valor.split(',').map((op: string) => op.trim());
    else novasSecoes[secaoIndex].campos[campoIndex] = { ...novasSecoes[secaoIndex].campos[campoIndex], [chave]: valor };
    setFormSecoes(novasSecoes);
  };
  const removerCampo = (secaoIndex: number, campoIndex: number) => {
    const novasSecoes = [...formSecoes];
    novasSecoes[secaoIndex].campos.splice(campoIndex, 1);
    setFormSecoes(novasSecoes);
  };

  const abrirNovoModelo = () => {
    setFormId(null);
    setFormTitulo('');
    setFormSecoes([
      {
        titulo: 'Queixa Principal',
        campos: [
          { id: `q_1_${Date.now()}`, label: 'Qual a sua queixa principal?', tipo: 'textarea' },
          { id: `q_2_${Date.now()}`, label: 'Há quanto tempo percebe isso?', tipo: 'text' }
        ]
      },
      {
        titulo: 'Histórico de Saúde',
        campos: [
          { id: `s_1_${Date.now()}`, label: 'Possui alguma doença pré-existente?', tipo: 'text' },
          { id: `s_2_${Date.now()}`, label: 'Possui alergia a alguma substância?', tipo: 'text' },
          { id: `s_3_${Date.now()}`, label: 'Faz uso contínuo de algum medicamento?', tipo: 'text' }
        ]
      }
    ]);
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
          <h1 className="text-2xl md:text-3xl font-light text-gray-800">Fichas de Anamnese</h1>
          <p className="text-sm md:text-base text-gray-500 mt-1">Gestão e personalização de modelos</p>
        </div>
        
        {modo === 'lista' ? (
          <button onClick={abrirNovoModelo} className="bg-[#B68B40] text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-[#9a7330] transition-colors shadow-sm w-full sm:w-auto">
            + Criar Novo Modelo
          </button>
        ) : (
          <button onClick={() => setModo('lista')} className="text-gray-500 hover:text-gray-800 font-medium text-sm w-full sm:w-auto text-left sm:text-right transition-colors">
            ← Voltar para a Lista
          </button>
        )}
      </header>

      <div className="bg-white sm:rounded-xl border-y sm:border border-[#B68B40]/30 shadow-sm flex-1 flex flex-col overflow-hidden w-full">
        
        {/* --- TELA DA LISTA DE FICHAS --- */}
        {modo === 'lista' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-gray-50/30">
            {loading ? (
              <p className="text-center text-gray-400 py-10">A carregar fichas...</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {modelos.map(modelo => (
                  <div 
                    key={modelo.id} 
                    onClick={() => visualizarModelo(modelo)}
                    className="p-5 sm:p-6 border border-gray-200 rounded-xl hover:border-[#B68B40] transition-all bg-white flex flex-col h-full shadow-sm hover:shadow-md cursor-pointer"
                  >
                    <div className="flex-1">
                      {/* Ícone de prancheta profissional substituindo o emoji */}
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#B68B40]/10 text-[#B68B40] rounded-full flex items-center justify-center mb-4">
                        <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      </div>
                      <h3 className="font-medium text-gray-800 text-lg mb-1">{modelo.titulo}</h3>
                      <p className="text-xs text-gray-500 mb-4">{modelo.campos.length} Seções configuradas</p>
                    </div>
                    
                    <div className="flex justify-between items-center pt-4 border-t border-gray-100 mt-auto">
                      <span className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wider font-medium">Modelo Ativo</span>
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
              <h2 className="text-xl sm:text-2xl font-light text-[#B68B40] truncate pr-4">{modeloVisualizar.titulo}</h2>
              <button onClick={() => editarModelo(modeloVisualizar)} className="flex items-center gap-1.5 text-sm font-medium text-[#B68B40] hover:underline shrink-0 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                Editar Ficha
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
              {modeloVisualizar.campos.map((secao, sIdx) => (
                <div key={sIdx} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                  <div className="bg-[#B68B40]/5 px-4 py-3 sm:px-5 border-b border-gray-200">
                    <h3 className="text-sm font-bold text-[#B68B40] uppercase tracking-wider">{secao.titulo}</h3>
                  </div>
                  <div className="p-4 sm:p-5 space-y-3">
                    {secao.campos.map((campo) => (
                      <div key={campo.id} className="pb-3 border-b border-gray-50 last:border-0 last:pb-0 flex flex-col">
                        <span className="text-sm text-gray-800 font-medium mb-1">{campo.label}</span>
                        <span className="text-xs text-gray-400 capitalize">
                          Tipo: {campo.tipo === 'textarea' ? 'Texto Longo' : campo.tipo} 
                          {campo.opcoes && campo.opcoes.length > 0 ? ` (${campo.opcoes.join(', ')})` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- TELA DE CRIAÇÃO OU EDIÇÃO --- */}
        {modo === 'criando' && (
          <div className="flex-1 flex flex-col h-full bg-gray-50/50 overflow-x-hidden">
            <div className="p-4 sm:p-6 border-b border-gray-200 bg-white shrink-0">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                {formId ? 'Editar Título da Ficha' : 'Título da Nova Ficha'}
              </label>
              <input 
                type="text" 
                placeholder="Ex: Anamnese Capilar" 
                value={formTitulo}
                onChange={e => setFormTitulo(e.target.value)}
                className="w-full max-w-2xl border border-gray-300 rounded-lg p-3 text-base sm:text-lg font-medium focus:outline-none focus:border-[#B68B40]"
                autoFocus
              />
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 sm:space-y-8">
              {formSecoes.map((secao, sIdx) => (
                <div key={sIdx} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                  
                  <div className="bg-[#B68B40]/5 px-4 py-3 sm:px-5 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                    <div className="flex-1">
                      <label className="block text-[10px] font-bold text-[#B68B40] uppercase tracking-wider mb-1">Nome da Seção</label>
                      <input type="text" placeholder="Ex: Histórico de Saúde" value={secao.titulo} onChange={e => atualizarTituloSecao(sIdx, e.target.value)} className="w-full bg-transparent border-b border-gray-300 focus:border-[#B68B40] outline-none text-sm font-medium py-1"/>
                    </div>
                    <button onClick={() => removerSecao(sIdx)} className="text-red-400 hover:text-red-600 text-xs sm:text-sm font-medium mt-2 sm:mt-4 text-left sm:text-right transition-colors">Remover Seção</button>
                  </div>

                  <div className="p-4 sm:p-5 space-y-4">
                    {secao.campos.map((campo, cIdx) => (
                      <div key={campo.id} className="flex flex-col sm:flex-row gap-4 sm:items-start p-4 border border-gray-100 rounded-lg bg-gray-50/50 relative">
                        <div className="flex-1 space-y-3 w-full pr-6 sm:pr-0">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1 font-medium">Pergunta / Rótulo do Campo</label>
                            <input type="text" value={campo.label} onChange={e => atualizarCampo(sIdx, cIdx, 'label', e.target.value)} placeholder="Ex: Possui alguma alergia?" className="w-full border border-gray-300 rounded p-2.5 text-sm focus:border-[#B68B40] outline-none bg-white"/>
                          </div>
                          
                          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full">
                            <div className="w-full sm:w-1/3">
                              <label className="block text-xs text-gray-500 mb-1 font-medium">Tipo de Resposta</label>
                              <select value={campo.tipo} onChange={e => atualizarCampo(sIdx, cIdx, 'tipo', e.target.value)} className="w-full border border-gray-300 rounded p-2.5 text-sm focus:border-[#B68B40] outline-none bg-white">
                                <option value="text">Texto Curto</option>
                                <option value="textarea">Texto Longo (Parágrafo)</option>
                                <option value="select">Lista de Seleção (Dropdown)</option>
                                <option value="checkbox">Caixa de Marcação (Sim/Não)</option>
                                <option value="multiselect">Múltipla Escolha</option>
                              </select>
                            </div>

                            {(campo.tipo === 'select' || campo.tipo === 'multiselect') && (
                              <div className="flex-1">
                                <label className="block text-xs text-gray-500 mb-1 font-medium">Opções (separe por vírgula)</label>
                                <input type="text" value={campo.opcoes?.join(', ') || ''} onChange={e => atualizarCampo(sIdx, cIdx, 'opcoes', e.target.value)} placeholder="Ex: Normal, Seca, Oleosa, Mista" className="w-full border border-gray-300 rounded p-2.5 text-sm focus:border-[#B68B40] outline-none bg-white"/>
                              </div>
                            )}
                          </div>
                        </div>
                        {/* Ícone de lixeira profissional no botão de remover pergunta */}
                        <button onClick={() => removerCampo(sIdx, cIdx)} className="absolute top-4 right-4 sm:static text-gray-400 hover:text-red-500 sm:mt-6 transition-colors" title="Remover Pergunta">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    ))}
                    
                    <button onClick={() => adicionarCampo(sIdx)} className="text-sm font-bold text-[#B68B40] hover:underline flex items-center gap-1 mt-2">
                      + Adicionar Pergunta nesta Seção
                    </button>
                  </div>
                </div>
              ))}

              <div className="flex justify-center pt-4">
                <button onClick={adicionarSecao} className="border-2 border-dashed border-[#B68B40]/50 text-[#B68B40] w-full sm:w-auto px-8 py-3 rounded-xl hover:bg-[#B68B40]/5 transition-colors font-bold text-sm">
                  + Adicionar Nova Seção
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-5 border-t border-gray-200 bg-white flex flex-col sm:flex-row justify-end gap-3 sm:gap-4 shrink-0">
              <button onClick={() => setModo('lista')} className="px-6 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 bg-gray-100 sm:bg-transparent rounded-lg sm:rounded-none transition-colors">
                Cancelar
              </button>
              <button onClick={salvarModelo} className="bg-[#B68B40] text-white px-8 py-2.5 rounded-lg text-sm font-medium hover:bg-[#9a7330] shadow-sm transition-colors">
                {formId ? 'Atualizar Modelo' : 'Salvar Novo Modelo'}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}