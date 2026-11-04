import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { mascararNome } from '../lib/lgpd';

export default function Dashboard() {
  const [atendimentosHoje, setAtendimentosHoje] = useState(0);
  const [pacientesAtivos, setPacientesAtivos] = useState(0);
  const [fichasPendentes, setFichasPendentes] = useState(0);
  const [consultasHoje, setConsultasHoje] = useState<any[]>([]);

  const [modalAberto, setModalAberto] = useState(false);
  const [pacientes, setPacientes] = useState<any[]>([]);
  const [formAgenda, setFormAgenda] = useState({
    paciente_id: '',
    data: new Date().toISOString().split('T')[0],
    hora: '09:00',
    procedimento: ''
  });

  const [mostrarDadosSensiveis, setMostrarDadosSensiveis] = useState(false);

  // ESTADO PARA OS AVISOS BONITOS (Toasts modernos)
  const [toast, setToast] = useState<{ show: boolean, msg: string, type: 'success' | 'error' }>({ show: false, msg: '', type: 'success' });

  useEffect(() => {
    buscarDadosGerais();
    buscarPacientes();
  }, []);

  // FUNÇÃO PARA EXIBIR O TOAST (Aviso flutuante)
  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ show: true, msg, type });
    setTimeout(() => setToast(t => ({ ...t, show: false })), 3500);
  };

  const buscarDadosGerais = async () => {
    const { count } = await supabase.from('pacientes').select('*', { count: 'exact', head: true });
    if (count !== null) setPacientesAtivos(count);

    // Intervalo exato do dia local no Supabase
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const dia = String(hoje.getDate()).padStart(2, '0');
    
    const inicioDia = `${ano}-${mes}-${dia}T00:00:00`; const fimDia = `${ano}-${mes}-${dia}T23:59:59`;

    const { data: agendamentosData } = await supabase
      .from('agendamentos')
      .select('*, pacientes(nome_completo)')
      .gte('data_hora', inicioDia)
      .lte('data_hora', fimDia)
      .order('data_hora', { ascending: true });

    if (agendamentosData) {
      setConsultasHoje(agendamentosData);
      setAtendimentosHoje(agendamentosData.length);
    }
  };

  const buscarPacientes = async () => {
    const { data } = await supabase.from('pacientes').select('id, nome_completo').order('nome_completo');
    if (data) setPacientes(data);
  };

  const salvarAgendamento = async () => {
    if (!formAgenda.paciente_id || !formAgenda.data || !formAgenda.hora) {
      return showToast('Preencha o Paciente, Data e Hora para agendar.', 'error');
    }
    
    // Grava exatamente a string local no formato ISO sem conversão automática de fuso
    const dataHoraLocal = `${formAgenda.data}T${formAgenda.hora}:00`;

    // VALIDAÇÃO PARA IMPEDIR AGENDAMENTOS NO PASSADO
    const dataSelecionada = new Date(dataHoraLocal);
    const dataAtual = new Date();
    
    if (dataSelecionada < dataAtual) {
      return showToast('Não é possível agendar uma consulta numa data ou horário que já passou.', 'error');
    }

    const payload = {
      paciente_id: formAgenda.paciente_id,
      data_hora: dataHoraLocal,
      procedimento: formAgenda.procedimento || 'Consulta Estética',
      status: 'agendado'
    };

    const { error } = await supabase.from('agendamentos').insert([payload]);
    
    if (error) {
      showToast('Erro ao marcar agendamento: ' + error.message, 'error');
    } else {
      showToast('Consulta agendada com sucesso!', 'success');
      setModalAberto(false);
      setFormAgenda({ paciente_id: '', data: new Date().toISOString().split('T')[0], hora: '09:00', procedimento: '' });
      buscarDadosGerais();
    }
  };

  const dataHojeIso = new Date().toISOString().split('T')[0];

  return (
    <div className="p-4 md:p-8 w-full max-w-7xl mx-auto flex flex-col h-full overflow-y-auto overflow-x-hidden box-border relative">
      
      {toast.show && (
        <div className={`fixed top-6 right-6 z-[99999] flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-2xl text-sm font-medium text-white border transition-all duration-300 transform translate-y-0 opacity-100 ${toast.type === 'success' ? 'bg-emerald-500 border-emerald-600' : 'bg-red-500 border-red-600'}`}> {toast.type === 'success' ? ( <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> ) : ( <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> )} <span>{toast.msg}</span> </div> )}  <header className="mb-6 md:mb-8 shrink-0"> <h1 className="text-2xl md:text-3xl font-light text-gray-800">Visão Geral</h1> <p className="text-sm md:text-base text-gray-500 mt-1">Bem-vinda ao seu painel, Dra. Emily.</p> </header>  <div className="grid grid-cols-3 gap-2 sm:gap-6 mb-6 md:mb-8 shrink-0"> <div className="bg-white border border-[#B68B40]/20 rounded-xl p-3 sm:p-6 shadow-sm flex flex-col items-center sm:items-start text-center sm:text-left justify-center"> <h3 className="text-[9px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 sm:mb-2 leading-tight">Atendimentos <br className="sm:hidden" /> Hoje</h3> <p className="text-xl sm:text-4xl font-serif text-[#B68B40] leading-none mt-1 sm:mt-0">{atendimentosHoje}</p> </div> <div className="bg-white border border-[#B68B40]/20 rounded-xl p-3 sm:p-6 shadow-sm flex flex-col items-center sm:items-start text-center sm:text-left justify-center"> <h3 className="text-[9px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 sm:mb-2 leading-tight">Pacientes <br className="sm:hidden" /> Ativos</h3> <p className="text-xl sm:text-4xl font-serif text-[#B68B40] leading-none mt-1 sm:mt-0">{pacientesAtivos}</p> </div> <div className="bg-white border border-[#B68B40]/20 rounded-xl p-3 sm:p-6 shadow-sm flex flex-col items-center sm:items-start text-center sm:text-left justify-center"> <h3 className="text-[9px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 sm:mb-2 leading-tight">Fichas <br className="sm:hidden" /> Pendentes</h3> <p className="text-xl sm:text-4xl font-serif text-[#B68B40] leading-none mt-1 sm:mt-0">{fichasPendentes}</p> </div> </div>  <div className="bg-white border border-[#B68B40]/20 rounded-xl p-4 sm:p-6 shadow-sm flex-1 flex flex-col min-h-[300px]"> <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4 sm:mb-6 border-b border-gray-100 pb-3 sm:pb-4 gap-3"> <div className="flex items-center justify-between sm:justify-start w-full sm:w-auto gap-4"> <h2 className="text-base sm:text-lg font-medium text-gray-800 truncate">Agenda de Hoje</h2>  <button onClick={() => setMostrarDadosSensiveis(!mostrarDadosSensiveis)} className="text-gray-400 hover:text-[#B68B40] text-sm flex items-center gap-1 transition-colors" title={mostrarDadosSensiveis ? "Ocultar nomes" : "Revelar nomes (LGPD)"} > {mostrarDadosSensiveis ? '👁️ Ocultar' : '👁️‍🗨️ Revelar'} </button>  <button onClick={() => setModalAberto(true)} className="bg-[#B68B40] text-white px-3 py-1.5 rounded-md text-xs font-medium hover:bg-[#9a7330] shadow-sm shrink-0 transition-colors"> + Novo Agendamento </button> </div> <Link to="/agenda" className="text-xs sm:text-sm font-medium text-[#B68B40] hover:text-[#9a7330] hover:underline shrink-0 text-left sm:text-right"> Ver agenda completa &rarr; </Link> </div>  {consultasHoje.length === 0 ? ( <div className="flex-1 flex flex-col items-center justify-center text-gray-400 opacity-70 py-10"> <svg className="w-12 h-12 sm:w-14 sm:h-14 mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /> </svg> <p className="text-sm">Nenhum agendamento para hoje.</p> </div> ) : ( <div className="space-y-3 overflow-y-auto flex-1"> {consultasHoje.map(c => { const partesData = c.data_hora.split('T'); const horaMinuto = partesData[1] ? partesData[1].substring(0, 5) : '';  const nomeExibicao = c.pacientes?.nome_completo ? (mostrarDadosSensiveis ? c.pacientes.nome_completo : mascararNome(c.pacientes.nome_completo)) : 'Paciente';  return ( <div key={c.id} className="p-4 border border-gray-100 rounded-xl bg-gray-50/50 flex justify-between items-center"> <div> <p className="font-semibold text-gray-800 text-sm">{nomeExibicao}</p> <p className="text-xs text-[#B68B40] font-medium mt-0.5">{c.procedimento \vert{}\vert{} 'Consulta Estética'}</p> </div> <div className="bg-[#B68B40]/10 text-[#B68B40] px-3 py-1 rounded-full text-xs font-bold"> {horaMinuto} </div> </div> ); })} </div> )} </div>  {modalAberto && ( <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4" onClick={() => setModalAberto(false)}> <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col mx-auto" onClick={e => e.stopPropagation()}> <div className="p-4 sm:p-5 border-b border-gray-100 flex justify-between items-center bg-[#FDFCFB]"> <h2 className="text-lg font-medium text-[#B68B40]">Novo Agendamento</h2> <button onClick={() => setModalAberto(false)} className="text-gray-400 text-2xl hover:text-gray-700">&times;</button> </div>  <div className="p-4 sm:p-6 space-y-4 flex-1 overflow-y-auto"> <div> <label className="block text-[10px] sm:text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Paciente *</label> <select value={formAgenda.paciente_id} onChange={e => setFormAgenda({...formAgenda, paciente_id: e.target.value})} className="w-full border border-gray-300 rounded-lg p-2.5 sm:p-3 text-sm focus:border-[#B68B40] outline-none bg-white"> <option value="">Selecione o paciente...</option> {pacientes.map(p => <option key={p.id} value={p.id}>{p.nome_completo}</option>)} </select> </div> <div className="grid grid-cols-2 gap-3 sm:gap-4"> <div> <label className="block text-[10px] sm:text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Data *</label> <input type="date" min={dataHojeIso} value={formAgenda.data} onChange={e => setFormAgenda({...formAgenda, data: e.target.value})} className="w-full border border-gray-300 rounded-lg p-2.5 sm:p-3 text-sm focus:border-[#B68B40] outline-none bg-white" /> </div> <div> <label className="block text-[10px] sm:text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Hora *</label> <input type="time" value={formAgenda.hora} onChange={e => setFormAgenda({...formAgenda, hora: e.target.value})} className="w-full border border-gray-300 rounded-lg p-2.5 sm:p-3 text-sm focus:border-[#B68B40] outline-none bg-white" /> </div> </div> <div> <label className="block text-[10px] sm:text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Procedimento (Opcional)</label> <input type="text" value={formAgenda.procedimento} onChange={e => setFormAgenda({...formAgenda, procedimento: e.target.value})} placeholder="Ex: Limpeza de Pele" className="w-full border border-gray-300 rounded-lg p-2.5 sm:p-3 text-sm focus:border-[#B68B40] outline-none" /> </div> </div>  <div className="p-4 sm:p-5 border-t border-gray-100 bg-gray-50 flex justify-end gap-3"> <button onClick={() => setModalAberto(false)} className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 bg-gray-200 sm:bg-transparent rounded-lg sm:rounded-none transition-colors">Cancelar</button> <button onClick={salvarAgendamento} className="bg-[#B68B40] text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-[#9a7330] shadow-sm transition-colors">Confirmar</button> </div> </div> </div> )} </div> ); } ```  ---  ### 3. `src/pages/Pacientes.tsx`  ```tsx import React, { useState, useEffect, useRef } from 'react'; import { supabase } from '../lib/supabase'; // @ts-ignore import html2pdf from 'html2pdf.js'; import { BUCKET_MIDIAS, cpfValido, escapeHtml, extrairCaminhoStorage, gerarCaminhoMidia, gerarUrlAssinada, gerarUrlsAssinadas, imagemAssinaturaSegura, jsonCanonico, prepararImagemSegura, sanitizarNomeArquivo, sha256Hex, mascararNome, mascararTelefone, registrarLogAuditoria } from '../lib/lgpd';  type Paciente = { id: string; nome_completo: string; cpf: string; data_nascimento: string; telefone: string; email: string; cep: string; rua: string; numero: string; bairro: string; cidade: string; estado: string; data_cadastro: string; };  type Campo = { id: string; label: string; tipo: string; opcoes?: string[] }; type Secao = { titulo: string; campos: Campo[] }; type ModeloFicha = { id: string; titulo: string; campos: Secao[] }; type ModeloTermo = { id: string; titulo: string; conteudo: string; campos: Campo[] }; // url_arquivo guarda apenas o CAMINHO no bucket privado (nunca uma URL pública) type Midia = { id: string; paciente_id: string; url_arquivo: string; categoria: 'Antes' \vert{} 'Durante' \vert{} 'Depois'; procedimento: string; data_registro: string; observacoes: string; };  export default function Pacientes() { const [pacientes, setPacientes] = useState<Paciente[]>([]); const [loading, setLoading] = useState(true); const [busca, setBusca] = useState('');  const [mostrarDadosSensiveis, setMostrarDadosSensiveis] = useState(false);  // ESTADOS PARA OS AVISOS BONITOS (Substitui os alerts e confirms) const [toast, setToast] = useState<{ show: boolean, msg: string, type: 'success' \vert{} 'error' }>({ show: false, msg: '', type: 'success' }); const [confirmDialog, setConfirmDialog] = useState<{ show: boolean, msg: string, action: (() => void) \vert{} null }>({ show: false, msg: '', action: null });  const [modalAberto, setModalAberto] = useState(false); const [isEditing, setIsEditing] = useState(false); const [abaAtiva, setAbaAtiva] = useState<'dados' \vert{} 'anamneses' \vert{} 'documentos' \vert{} 'midias'>('dados');  const [form, setForm] = useState<Partial<Paciente>>({});  const [modelosFichas, setModelosFichas] = useState<ModeloFicha[]>([]); const [modelosTermos, setModelosTermos] = useState<ModeloTermo[]>([]); const [historicoAnamneses, setHistoricoAnamneses] = useState<any[]>([]); const [historicoDocumentos, setHistoricoDocumentos] = useState<any[]>([]);  const [fluxoAnamnese, setFluxoAnamnese] = useState<'lista' \vert{} 'selecao' \vert{} 'preenchendo'>('lista'); const [fichaSelecionada, setFichaSelecionada] = useState<ModeloFicha \vert{} null>(null); const [fichaPreenchidaId, setFichaPreenchidaId] = useState<string \vert{} null>(null); const [respostasAtuais, setRespostasAtuais] = useState<Record<string, any>>({});  const [fluxoDocumento, setFluxoDocumento] = useState<'lista' \vert{} 'selecao' \vert{} 'preenchendo'>('lista'); const [termoSelecionado, setTermoSelecionado] = useState<ModeloTermo \vert{} null>(null); const [termoPreenchidoId, setTermoPreenchidoId] = useState<string \vert{} null>(null); const [respostasTermo, setRespostasTermo] = useState<Record<string, any>>({}); const [autorizacaoTermo, setAutorizacaoTermo] = useState<'Sim' \vert{} 'Não' \vert{} null>(null); // Consentimento de uso de imagem SEPARADO do consentimento do procedimento (LGPD art. 8º §4º e art. 11, I) const [autorizacaoImagem, setAutorizacaoImagem] = useState<'Sim' \vert{} 'Não' \vert{} null>(null); const [cidadeTermo, setCidadeTermo] = useState('João Monlevade - MG');  const [historicoMidias, setHistoricoMidias] = useState<Midia[]>([]); const [urlsMidias, setUrlsMidias] = useState<Record<string, string>>({}); const [fluxoMidia, setFluxoMidia] = useState<'lista' \vert{} 'upload'>('lista'); const [arquivoMidia, setArquivoMidia] = useState<File \vert{} null>(null); const [uploadingMidia, setUploadingMidia] = useState(false); const [formMidia, setFormMidia] = useState({ categoria: 'Antes', procedimento: '', data_registro: new Date().toISOString().split('T')[0], observacoes: '' });  const [dataAssinatura, setDataAssinatura] = useState(new Date().toISOString().split('T')[0]); const [termoAceito, setTermoAceito] = useState(false); const [cpfAssinatura, setCpfAssinatura] = useState(''); const [profAceito, setProfAceito] = useState(false); const [registroProfissional, setRegistroProfissional] = useState('');  const [gerandoPdf, setGerandoPdf] = useState(false);  const canvasRef = useRef<HTMLCanvasElement>(null); const canvasClienteRef = useRef<HTMLCanvasElement>(null); const canvasProfRef = useRef<HTMLCanvasElement>(null); const [isDrawing, setIsDrawing] = useState(false); const [isDrawingCliente, setIsDrawingCliente] = useState(false); const [isDrawingProf, setIsDrawingProf] = useState(false);  // FUNÇÃO PARA EXIBIR O TOAST (Aviso flutuante) const showToast = (msg: string, type: 'success' \vert{} 'error' = 'success') => { setToast({ show: true, msg, type }); setTimeout(() => setToast(t => ({ ...t, show: false })), 3500); };  const formatarCPF = (v: string) => v.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})/, '$1-$2').replace(/(-\d{2})\d+?$/, '$1'); const formatarTelefone = (v: string) => v.replace(/\D/g, '').replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2').replace(/(-\d{4})\d+?$/, '$1'); const formatarCEP = (v: string) => v.replace(/\D/g, '').replace(/(\d{5})(\d)/, '$1-$2').replace(/(-\d{3})\d+?$/, '$1');  const estadosBrasil = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];  const formatarTextoTermo = (texto: string) => texto.split(/\\n\vert{}\n/).map((linha, idx) => { if (linha.trim() === '') return <br key={idx} />; const isHeader = linha === linha.toUpperCase() && linha.length > 5 && !linha.includes('('); return <p key={idx} className={`mb-2 leading-relaxed ${isHeader ? 'font-bold text-[#B68B40] mt-6 text-sm tracking-wider uppercase' : 'text-gray-700 text-sm text-justify'}`}>{linha}</p>;
  });

  const obterTextoDeclaracao = (titulo: string) => {
    if (titulo.includes('Facial')) return "Declaro que todas as informações fornecidas nesta ficha são verdadeiras e completas, estando ciente de que a omissão de informações poderá comprometer a segurança e os resultados do tratamento.\n\nDeclaro ainda que fui orientado(a) sobre o protocolo proposto, compreendendo que os procedimentos estéticos isoladamente não garantem os resultados esperados. Estou ciente de que o sucesso do tratamento depende também da realização correta dos cuidados domiciliares, do uso dos produtos indicados, da frequência das sessões e do cumprimento integral do protocolo personalizado estabelecido pela profissional.\n\nConfirmo que todas as minhas dúvidas foram esclarecidas e autorizo o início do tratamento conforme avaliação profissional.";
    if (titulo.includes('Corporal')) return "Declaro que as informações prestadas são verdadeiras e estou ciente dos procedimentos propostos.";
    if (titulo.includes('Lipo Enzimática') || titulo.includes('Microagulhamento') || titulo.includes('Toxina')) return `Declaro que as informações acima são verdadeiras e que não omiti qualquer informação importante sobre minha saúde. Fui informada sobre o procedimento de ${titulo.replace('Anamnese - ', '').toLowerCase()}, seus benefícios, riscos, contraindicações e cuidados necessários.`;
    return "Declaro que as informações acima são verdadeiras e que não omiti qualquer informação importante sobre minha saúde.";
  };

  const blocoAutenticacao = (auth: any, dupla: boolean) => {
    const e = escapeHtml;
    const servidor = auth?.registro_servidor;
    const dataHora = servidor?.data_hora || auth?.data_hora_assinatura;
    const ip = servidor?.ip || auth?.ip_dispositivo;
    const linhaIp = ip ? ` | IP: ${e(ip)}` : '';
    const linhaCpf = dupla
      ? `CPF Paciente: ${e(auth?.cpf_paciente)} \vert{} Reg. Profissional: ${e(auth?.registro_profissional)}`
      : `CPF Autenticado: ${e(auth?.cpf_assinante)}`;
    const hashConteudo = auth?.hash_conteudo ? `<br/>Hash do conteúdo (SHA-256): ${e(auth.hash_conteudo)}` : '';
    return `<div class="legal-hash"><strong>🔒 ${dupla ? 'AUTENTICAÇÃO DUPLA' : 'AUTENTICAÇÃO ELETRÔNICA'}</strong><br/>Data/Hora: ${dataHora ? e(new Date(dataHora).toLocaleString('pt-BR')) : ''}${linhaIp}<br/>${linhaCpf}<br/>Hash SHA-256:${e(auth?.hash_autenticacao)}${hashConteudo}</div>`; };  const baixarPDF = async (tipo: 'ficha' \vert{} 'termo', item: any) => { setGerandoPdf(true); const tituloDoc = tipo === 'ficha' ? item.historico_medico?.tipo_ficha : item.tipo_documento; const nomeArquivo = `${sanitizarNomeArquivo(`${form.nome_completo || 'paciente'} - ${tituloDoc || 'documento'}`)}.pdf`;
    const e = escapeHtml;

    const enderecoCompleto = [
      form.rua ? `${form.rua}` : '', form.numero ? `nº ${form.numero}` : '',
      form.bairro ? `Bairro: ${form.bairro}` : '', form.cidade ? `${form.cidade}` : '',
      form.estado ? `- ${form.estado}` : '', form.cep ? `(CEP: ${form.cep})` : ''
    ].filter(Boolean).join(', ');

    let html = `
      <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #222; line-height: 1.4; font-size: 11px; width: 100%; max-width: 800px; margin: 0 auto; background: white;">
        <style>
          * { box-sizing: border-box; }
          .header { text-align: center; margin-bottom: 25px; width: 100%; }
          .header img { display: block; margin: 0 auto 12px auto; width: 170px; }
          .contact-info { color: #B68B40; font-size: 11px; margin-bottom: 20px; font-weight: 500; text-align: center; letter-spacing: 0.5px; }
          .title-container { display: table; width: 100%; margin-bottom: 25px; }
          .title-line { display: table-cell; width: 35%; border-bottom: 1.5px solid rgba(182, 139, 64, 0.3); vertical-align: middle; }
          .title-text { display: table-cell; width: 30%; color: #222; font-size: 14px; font-weight: bold; text-transform: uppercase; text-align: center; letter-spacing: 1.5px; white-space: nowrap; vertical-align: middle; padding: 0 10px; }
          .dot { color: #B68B40; font-size: 16px; margin: 0 4px; vertical-align: middle; }
          .avoid-cut { page-break-inside: avoid !important; break-inside: avoid !important; display: block !important; }
          .section-box { border: 1.5px solid #D4B872; border-radius: 8px; padding: 15px; margin-bottom: 15px; position: relative; background: white; }
          .section-title { color: #B68B40; text-transform: uppercase; font-weight: bold; font-size: 12px; position: absolute; top: -9px; left: 15px; background: white; padding: 0 8px; letter-spacing: 0.5px; }
          .row { width: 100%; display: block; margin-bottom: 15px; }
          .col-left { float: left; width: 48.5%; }
          .col-right { float: right; width: 48.5%; }
          .clear { clear: both; width: 100%; height: 0; }
          .info-table { width: 100%; border-collapse: separate; border-spacing: 10px 5px; margin-top: 5px; }
          .info-table td { border-bottom: 1px dotted #ccc; padding-bottom: 4px; vertical-align: bottom; }
          .label { color: #555; font-size: 10px; text-transform: uppercase; margin-right: 5px; }
          .val { font-weight: bold; color: #111; font-size: 11px; }
          .qa-table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          .qa-table td { border-bottom: 1px dotted #e5e7eb; padding: 6px 0; vertical-align: bottom; }
          .question { color: #333; font-size: 10px; padding-right: 15px; }
          .answer { text-align: right; font-weight: bold; font-size: 10px; color: #B68B40; text-transform: uppercase; width: 30%; }
          .answer-long { font-weight: 500; color: #222; font-size: 11px; padding-top: 4px; display: block; }
          .termo-content { white-space: pre-wrap; text-align: justify; font-size: 10.5px; line-height: 1.6; color: #333; margin-top: 8px; }
          .signatures { display: table; width: 100%; margin-top: 25px; }
          .sig-box { display: table-cell; text-align: center; width: 50%; padding: 0 20px; }
          .sig-line { border-bottom: 1px solid #333; height: 60px; margin-bottom: 5px; text-align: center; vertical-align: bottom; display: table-cell; width: 100%; }
          .sig-img { max-height: 55px; max-width: 100%; object-fit: contain; vertical-align: bottom; }
          .sig-name { font-weight: bold; font-size: 11px; margin: 5px 0 0 0; }
          .sig-role { font-size: 9px; margin: 0; color: #666; }
          .legal-hash { font-family: monospace; font-size: 8px; color: #777; margin-top: 20px; text-align: center; padding-top: 10px; border-top: 1px dashed #ccc; }
        </style>
        
        <div class="header avoid-cut">
          <img src="${window.location.origin}/logo.jpeg" onerror="this.style.display='none'" />
          <div class="contact-info">(31) 97224-1476 &nbsp;&nbsp;|&nbsp;&nbsp; dra.emilybarcelos</div>
          <div class="title-container">
            <div class="title-line"></div>
            <div class="title-text"><span class="dot">•</span> ${e(tituloDoc)} <span class="dot">•</span></div>
            <div class="title-line"></div>
          </div>
        </div>
        
        <div class="section-box avoid-cut" style="margin-bottom: 20px;">
          <div class="section-title">DADOS PESSOAIS</div>
          <table class="info-table">
            <tr>
              <td colspan="2"><span class="label">Nome:</span> <span class="val">${e(form.nome_completo)}</span></td>
              <td colspan="1"><span class="label">Nascimento:</span> <span class="val">${form.data_nascimento ? new Date(form.data_nascimento).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : ''}</span></td>
            </tr>
            <tr>
              <td colspan="1" style="width: 40%;"><span class="label">CPF:</span> <span class="val">${e(form.cpf)}</span></td>
              <td colspan="2"><span class="label">Telefone:</span> <span class="val">${e(form.telefone)}</span></td>
            </tr>
            <tr>