import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function Agenda() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [agendamentosMes, setAgendamentosMes] = useState<any[]>([]);
  const [visao, setVisao] = useState<'mes' | 'semana'>('mes');
  
  // Estados do Modal de Novo/Editar Agendamento
  const [modalAberto, setModalAberto] = useState(false);
  const [isEditingAgenda, setIsEditingAgenda] = useState(false);
  const [agendamentoEditId, setAgendamentoEditId] = useState<string | null>(null);
  const [pacientes, setPacientes] = useState<any[]>([]);
  const [formAgenda, setFormAgenda] = useState({
    paciente_id: '',
    data: new Date().toISOString().split('T')[0],
    hora: '09:00',
    procedimento: ''
  });

  // Estados do Modal de Detalhes do Dia Clicado
  const [modalDiaAberto, setModalDiaAberto] = useState(false);
  const [diaSelecionado, setDiaSelecionado] = useState<{ dataStr: string; consultas: any[] }>({ dataStr: '', consultas: [] });

  // ESTADOS PARA OS AVISOS BONITOS (Toasts e Confirmações)
  const [toast, setToast] = useState<{ show: boolean, msg: string, type: 'success' | 'error' }>({ show: false, msg: '', type: 'success' });
  const [confirmDialog, setConfirmDialog] = useState<{ show: boolean, msg: string, action: (() => void) | null }>({ show: false, msg: '', action: null });

  useEffect(() => {
    buscarAgendamentosMes();
    buscarPacientes();
  }, [currentDate]);

  // FUNÇÃO PARA EXIBIR O TOAST (Aviso flutuante)
  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ show: true, msg, type });
    setTimeout(() => setToast(t => ({ ...t, show: false })), 3500);
  };

  const buscarAgendamentosMes = async () => {
    const ano = currentDate.getFullYear();
    const mes = String(currentDate.getMonth() + 1).padStart(2, '0');
    
    const primeiroDia = `${ano}-${mes}-01T00:00:00`;
    const ultimoDia = `${ano}-${mes}-${new Date(ano, Number(mes), 0).getDate()}T23:59:59`;

    const { data } = await supabase
      .from('agendamentos')
      .select('*, pacientes(nome_completo, telefone)')
      .gte('data_hora', primeiroDia)
      .lte('data_hora', ultimoDia)
      .order('data_hora', { ascending: true });

    if (data) setAgendamentosMes(data);
  };

  const buscarPacientes = async () => {
    const { data } = await supabase.from('pacientes').select('id, nome_completo').order('nome_completo');
    if (data) setPacientes(data);
  };

  const fecharModalAgendamento = () => {
    setModalAberto(false);
    setIsEditingAgenda(false);
    setAgendamentoEditId(null);
    setFormAgenda({ paciente_id: '', data: new Date().toISOString().split('T')[0], hora: '09:00', procedimento: '' });
  };

  const salvarAgendamento = async () => {
    if (!formAgenda.paciente_id || !formAgenda.data || !formAgenda.hora) {
      return showToast('Preencha o Paciente, Data e Hora para agendar.', 'error');
    }

    const dataHoraLocal = `${formAgenda.data}T${formAgenda.hora}:00`;
    
    // VALIDAÇÃO: Impede de agendar no passado (apenas se for um NOVO agendamento)
    if (!isEditingAgenda) {
      const dataSelecionada = new Date(dataHoraLocal);
      const dataAtual = new Date();
      if (dataSelecionada < dataAtual) {
        return showToast('Não é possível agendar uma consulta numa data ou horário que já passou.', 'error');
      }
    }

    const payload = {
      paciente_id: formAgenda.paciente_id,
      data_hora: dataHoraLocal,
      procedimento: formAgenda.procedimento || 'Consulta Estética',
      status: 'agendado'
    };

    if (isEditingAgenda && agendamentoEditId) {
      const { error } = await supabase.from('agendamentos').update(payload).eq('id', agendamentoEditId);
      if (error) {
        showToast('Erro ao atualizar agendamento: ' + error.message, 'error');
      } else {
        showToast('Consulta atualizada com sucesso!', 'success');
        fecharModalAgendamento();
        buscarAgendamentosMes();
        setModalDiaAberto(false); // Fecha o modal do dia para que o usuário veja a agenda atualizada
      }
    } else {
      const { error } = await supabase.from('agendamentos').insert([payload]);
      if (error) {
        showToast('Erro ao marcar agendamento: ' + error.message, 'error');
      } else {
        showToast('Consulta agendada com sucesso!', 'success');
        fecharModalAgendamento();
        buscarAgendamentosMes();
        setModalDiaAberto(false);
      }
    }
  };

  // EXCLUIR AGENDAMENTO
  const deletarAgendamento = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDialog({
      show: true,
      msg: 'Tem a certeza que deseja cancelar e excluir permanentemente este agendamento?',
      action: async () => {
        const { error } = await supabase.from('agendamentos').delete().eq('id', id);
        if (error) { 
          showToast('Erro ao apagar: ' + error.message, 'error'); 
        } else { 
          showToast('Agendamento excluído.', 'success'); 
          buscarAgendamentosMes();
          setModalDiaAberto(false); // Fecha o modal para refrescar a view
        }
        setConfirmDialog({ show: false, msg: '', action: null });
      }
    });
  };

  // EDITAR AGENDAMENTO
  const abrirEditarAgendamento = (consulta: any, e: React.MouseEvent) => {
    e.stopPropagation();
    const partesData = consulta.data_hora.split('T');
    const dataStr = partesData[0];
    const horaStr = partesData[1] ? partesData[1].substring(0, 5) : '09:00';
    
    setFormAgenda({
      paciente_id: consulta.paciente_id,
      data: dataStr,
      hora: horaStr,
      procedimento: consulta.procedimento || ''
    });
    
    setIsEditingAgenda(true);
    setAgendamentoEditId(consulta.id);
    setModalDiaAberto(false); // Fecha o modal do dia para mostrar o de edição
    setModalAberto(true);
  };

  const irParaHoje = () => setCurrentDate(new Date());
  
  const navegarPeriodo = (direcao: 'ante' | 'proximo') => {
    const ano = currentDate.getFullYear();
    const mes = currentDate.getMonth();
    if (visao === 'mes') {
      setCurrentDate(new Date(ano, direcao === 'ante' ? mes - 1 : mes + 1, 1));
    } else {
      const novoDia = new Date(currentDate);
      novoDia.setDate(novoDia.getDate() + (direcao === 'ante' ? -7 : 7));
      setCurrentDate(novoDia);
    }
  };

  const abrirDetalhesDia = (dataStr: string, consultas: any[]) => {
    setDiaSelecionado({ dataStr, consultas });
    setModalDiaAberto(true);
  };

  // Função para abrir o modal de agendamento já com a data pré-preenchida pelo dia clicado
  const abrirAgendarParaData = (dataStr: string) => {
    setModalDiaAberto(false);
    
    // Se o usuário clicar em um dia que já passou pelo calendário, avisa logo de cara
    const dataEscolhida = new Date(`${dataStr}T23:59:59`);
    const hoje = new Date();
    if (dataEscolhida < hoje) {
      return showToast('Este dia já passou. Escolha uma data futura.', 'error');
    }

    setIsEditingAgenda(false);
    setAgendamentoEditId(null);
    setFormAgenda(prev => ({ ...prev, data: dataStr, paciente_id: '', procedimento: '' }));
    setModalAberto(true);
  };

  const abrirNovoAgendamentoGeral = () => {
    setIsEditingAgenda(false);
    setAgendamentoEditId(null);
    setFormAgenda({ paciente_id: '', data: new Date().toISOString().split('T')[0], hora: '09:00', procedimento: '' });
    setModalAberto(true);
  };

  const renderDiasMes = () => {
    const ano = currentDate.getFullYear();
    const mes = currentDate.getMonth();
    const primeiroDiaMes = new Date(ano, mes, 1).getDay(); 
    const totalDiasMes = new Date(ano, mes + 1, 0).getDate();
    
    const dias = [];
    
    for (let i = 0; i < primeiroDiaMes; i++) {
      dias.push(<div key={`empty-${i}`} className="border-b border-r border-gray-100 bg-gray-50/30 p-1 sm:p-2 min-h-[90px] sm:min-h-[120px]"></div>);
    }
    
    for (let d = 1; d <= totalDiasMes; d++) {
      const dataAtualLoop = new Date(ano, mes, d);
      const mesStr = String(mes + 1).padStart(2, '0');
      const diaStr = String(d).padStart(2, '0');
      const dataStr = `${ano}-${mesStr}-${diaStr}`;
      
      const hoje = new Date();
      const isHoje = dataAtualLoop.getDate() === hoje.getDate() && 
                     dataAtualLoop.getMonth() === hoje.getMonth() && 
                     dataAtualLoop.getFullYear() === hoje.getFullYear();

      const consultasDoDia = agendamentosMes.filter(a => {
        if (!a.data_hora) return false;
        const dataApenas = a.data_hora.split('T')[0];
        return dataApenas === dataStr;
      });
      
      dias.push(
        <div 
          key={d} 
          onClick={() => abrirDetalhesDia(dataStr, consultasDoDia)}
          className="border-b border-r border-gray-100 p-1 sm:p-2 min-h-[90px] sm:min-h-[120px] hover:bg-[#B68B40]/10 transition-colors cursor-pointer flex flex-col"
        >
          <div className={`text-[10px] sm:text-sm font-medium w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center rounded-full mb-1 ${isHoje ? 'bg-[#B68B40] text-white shadow-md' : 'text-gray-700'}`}>
            {d}
          </div>
          <div className="flex-1 space-y-1 overflow-y-auto max-w-full">
            {consultasDoDia.map(c => {
              const partesData = c.data_hora.split('T');
              const horaMinuto = partesData[1] ? partesData[1].substring(0, 5) : '';
              return (
                <div key={c.id} className="bg-[#B68B40]/15 border border-[#B68B40]/30 rounded px-1.5 py-0.5 text-[9px] sm:text-xs text-[#B68B40] truncate" title={`${horaMinuto} - ${c.pacientes?.nome_completo}`}>
                  <strong className="font-semibold">{horaMinuto}</strong> {c.pacientes?.nome_completo}
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    return dias;
  };

  const renderDiasSemana = () => {
    const curr = new Date(currentDate);
    const primeiroDiaSemana = curr.getDate() - curr.getDay();
    
    const dias = [];
    for (let i = 0; i < 7; i++) {
      const diaDaSemana = new Date(curr.setDate(primeiroDiaSemana + i));
      const ano = diaDaSemana.getFullYear();
      const mes = diaDaSemana.getMonth();
      const d = diaDaSemana.getDate();
      const dataStr = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      
      const hoje = new Date();
      const isHoje = diaDaSemana.getDate() === hoje.getDate() && 
                     diaDaSemana.getMonth() === hoje.getMonth() && 
                     diaDaSemana.getFullYear() === hoje.getFullYear();

      const consultasDoDia = agendamentosMes.filter(a => {
        if (!a.data_hora) return false;
        const dataApenas = a.data_hora.split('T')[0];
        return dataApenas === dataStr;
      });

      dias.push(
        <div 
          key={i} 
          onClick={() => abrirDetalhesDia(dataStr, consultasDoDia)}
          className="border-b border-r border-gray-100 p-2 min-h-[300px] hover:bg-[#B68B40]/10 transition-colors cursor-pointer flex flex-col bg-white"
        >
          <div className="text-center pb-2 mb-2 border-b border-gray-100">
            <span className="text-[10px] font-bold text-gray-400 uppercase">
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][i]}
            </span>
            <div className={`text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full mx-auto mt-0.5 ${isHoje ? 'bg-[#B68B40] text-white shadow-md' : 'text-gray-700'}`}>
              {d}
            </div>
          </div>
          <div className="flex-1 space-y-1.5 overflow-y-auto">
            {consultasDoDia.map(c => {
              const partesData = c.data_hora.split('T');
              const horaMinuto = partesData[1] ? partesData[1].substring(0, 5) : '';
              return (
                <div key={c.id} className="bg-[#B68B40]/15 border border-[#B68B40]/30 rounded p-1.5 text-xs text-[#B68B40]">
                  <strong className="block font-bold">{horaMinuto}</strong>
                  <span className="truncate block">{c.pacientes?.nome_completo}</span>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    return dias;
  };

  // Obtém a data de hoje formatada em ISO (AAAA-MM-DD) para bloquear os dias passados no calendário HTML
  const dataHojeIso = new Date().toISOString().split('T')[0];

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

      <header className="px-4 pt-6 pb-4 sm:p-0 flex flex-col sm:flex-row justify-between sm:items-center gap-4 w-full shrink-0 mb-2 sm:mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-light text-gray-800">Agenda Completa</h1>
          <p className="text-sm md:text-lg text-[#B68B40] font-medium mt-1 capitalize">
            {currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            <button onClick={irParaHoje} className="text-xs sm:text-sm font-medium text-gray-500 hover:text-[#B68B40] whitespace-nowrap px-2">Ir para Hoje</button>
            <div className="flex border border-gray-200 rounded-lg overflow-hidden shrink-0 shadow-sm">
              <button onClick={() => navegarPeriodo('ante')} className="px-3 py-1.5 sm:px-4 sm:py-2 bg-white hover:bg-gray-50 text-gray-600 border-r border-gray-200 text-sm transition-colors">&lt;</button>
              <button onClick={() => navegarPeriodo('proximo')} className="px-3 py-1.5 sm:px-4 sm:py-2 bg-white hover:bg-gray-50 text-gray-600 text-sm transition-colors">&gt;</button>
            </div>
            <select 
              value={visao} 
              onChange={e => setVisao(e.target.value as 'mes' | 'semana')}
              className="bg-[#B68B40]/10 text-[#B68B40] border-none text-xs sm:text-sm font-medium px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg outline-none cursor-pointer shrink-0"
            >
              <option value="mes">Mês</option>
              <option value="semana">Semana</option>
            </select>
          </div>
          
          <button onClick={abrirNovoAgendamentoGeral} className="bg-[#B68B40] text-white px-5 py-2 sm:py-2.5 rounded-lg text-sm font-medium hover:bg-[#9a7330] w-full sm:w-auto shadow-sm shrink-0 transition-colors">
            + Agendar Consulta
          </button>
        </div>
      </header>

      {/* CALENDÁRIO */}
      <div className="bg-white sm:rounded-lg border-y sm:border border-[#B68B40]/30 shadow-sm flex-1 flex flex-col overflow-hidden w-full">
        {visao === 'mes' && (
          <div className="grid grid-cols-7 border-b border-[#B68B40]/20 bg-[#FDFCFB]">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(dia => (
              <div key={dia} className="py-2 sm:py-3 text-center text-[9px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider border-r border-transparent last:border-none">
                {dia}
              </div>
            ))}
          </div>
        )}
        
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {visao === 'mes' ? (
            <div className="grid grid-cols-7 auto-rows-fr">
              {renderDiasMes()}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-7 h-full">
              {renderDiasSemana()}
            </div>
          )}
        </div>
      </div>

      {/* MODAL DETALHES DO DIA CLICADO */}
      {modalDiaAberto && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4" onClick={() => setModalDiaAberto(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col mx-auto" onClick={e => e.stopPropagation()}>
            <div className="p-4 sm:p-5 border-b border-gray-100 flex justify-between items-center bg-[#FDFCFB]">
              <h2 className="text-lg font-medium text-[#B68B40]">
                Consultas de {new Date(diaSelecionado.dataStr + 'T00:00:00').toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: 'long', year: 'numeric' })}
              </h2>
              <button onClick={() => setModalDiaAberto(false)} className="text-gray-400 text-2xl hover:text-gray-700">&times;</button>
            </div>
            
            <div className="p-4 sm:p-6 space-y-4 flex-1 overflow-y-auto max-h-[60vh]">
              {diaSelecionado.consultas.length === 0 ? (
                <div className="text-center py-8 text-gray-400 flex flex-col items-center">
                  <svg className="w-12 h-12 mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  <p className="text-sm mb-4">Nenhum agendamento para este dia.</p>
                  <button 
                    onClick={() => abrirAgendarParaData(diaSelecionado.dataStr)}
                    className="bg-[#B68B40] text-white px-5 py-2 rounded-lg text-xs font-semibold hover:bg-[#9a7330] shadow-sm transition-colors"
                  >
                    + Agendar para este dia
                  </button>
                </div>
              ) : (
                diaSelecionado.consultas.map(c => {
                  const partesData = c.data_hora.split('T');
                  const horaMinuto = partesData[1] ? partesData[1].substring(0, 5) : '';
                  return (
                    <div key={c.id} className="p-4 border border-gray-200 rounded-xl bg-gray-50 flex flex-col gap-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold text-gray-800 text-base">{c.pacientes?.nome_completo || 'Paciente'}</p>
                          <p className="text-xs text-[#B68B40] font-medium mt-0.5">Procedimento: {c.procedimento || 'Consulta Estética'}</p>
                          {c.pacientes?.telefone && <p className="text-xs text-gray-500 mt-1">Tel: {c.pacientes.telefone}</p>}
                        </div>
                        <div className="bg-[#B68B40] text-white px-3.5 py-1.5 rounded-lg text-sm font-bold shadow-sm">
                          {horaMinuto}
                        </div>
                      </div>
                      
                      {/* BOTOES DE AÇÃO (EDITAR E EXCLUIR COM ÍCONES PROFISSIONAIS) */}
                      <div className="flex justify-end gap-2 border-t border-gray-200 pt-3 mt-1">
                        <button onClick={(e) => abrirEditarAgendamento(c, e)} className="flex items-center gap-1.5 text-[#B68B40] bg-white hover:bg-[#B68B40]/10 border border-[#B68B40]/20 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-sm">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                          Editar
                        </button>
                        <button onClick={(e) => deletarAgendamento(c.id, e)} className="flex items-center gap-1.5 text-red-500 bg-white hover:bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-sm">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          Excluir
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-4 sm:p-5 border-t border-gray-100 bg-gray-50 flex justify-between items-center">
              {diaSelecionado.consultas.length > 0 && (
                <button 
                  onClick={() => abrirAgendarParaData(diaSelecionado.dataStr)}
                  className="bg-[#B68B40] text-white px-4 py-2 rounded-lg text-xs font-semibold hover:bg-[#9a7330] shadow-sm transition-colors"
                >
                  + Agendar novo horário neste dia
                </button>
              )}
              <button onClick={() => setModalDiaAberto(false)} className="bg-gray-200 text-gray-700 px-5 py-2 rounded-lg text-xs font-medium hover:bg-gray-300 ml-auto transition-colors">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE NOVO / EDITAR AGENDAMENTO */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4" onClick={fecharModalAgendamento}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col mx-auto" onClick={e => e.stopPropagation()}>
            <div className="p-4 sm:p-5 border-b border-gray-100 flex justify-between items-center bg-[#FDFCFB]">
              <h2 className="text-lg font-medium text-[#B68B40]">
                {isEditingAgenda ? 'Editar Agendamento' : 'Novo Agendamento'}
              </h2>
              <button onClick={fecharModalAgendamento} className="text-gray-400 text-2xl hover:text-gray-700">&times;</button>
            </div>
            
            <div className="p-4 sm:p-6 space-y-4 flex-1 overflow-y-auto">
              <div>
                <label className="block text-[10px] sm:text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Paciente *</label>
                <select value={formAgenda.paciente_id} onChange={e => setFormAgenda({...formAgenda, paciente_id: e.target.value})} className="w-full border border-gray-300 rounded-lg p-2.5 sm:p-3 text-sm focus:border-[#B68B40] outline-none bg-white">
                  <option value="">Selecione o paciente...</option>
                  {pacientes.map(p => <option key={p.id} value={p.id}>{p.nome_completo}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-[10px] sm:text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Data *</label>
                  <input 
                    type="date" 
                    min={!isEditingAgenda ? dataHojeIso : undefined} // Só bloqueia o calendário se for um novo agendamento
                    value={formAgenda.data} 
                    onChange={e => setFormAgenda({...formAgenda, data: e.target.value})} 
                    className="w-full border border-gray-300 rounded-lg p-2.5 sm:p-3 text-sm focus:border-[#B68B40] outline-none bg-white" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] sm:text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Hora *</label>
                  <input 
                    type="time" 
                    value={formAgenda.hora} 
                    onChange={e => setFormAgenda({...formAgenda, hora: e.target.value})} 
                    className="w-full border border-gray-300 rounded-lg p-2.5 sm:p-3 text-sm focus:border-[#B68B40] outline-none bg-white" 
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] sm:text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Procedimento (Opcional)</label>
                <input type="text" value={formAgenda.procedimento} onChange={e => setFormAgenda({...formAgenda, procedimento: e.target.value})} placeholder="Ex: Limpeza de Pele" className="w-full border border-gray-300 rounded-lg p-2.5 sm:p-3 text-sm focus:border-[#B68B40] outline-none" />
              </div>
            </div>

            <div className="p-4 sm:p-5 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button onClick={fecharModalAgendamento} className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 bg-gray-200 sm:bg-transparent rounded-lg sm:rounded-none transition-colors">Cancelar</button>
              <button onClick={salvarAgendamento} className="bg-[#B68B40] text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-[#9a7330] shadow-sm transition-colors">
                {isEditingAgenda ? 'Atualizar Consulta' : 'Confirmar Agendamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}