import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
// @ts-ignore
import html2pdf from 'html2pdf.js';

type Paciente = { 
  id: string; 
  nome_completo: string; 
  cpf: string; 
  data_nascimento: string; 
  telefone: string; 
  email: string; 
  cep: string;
  rua: string;
  numero: string;
  bairro: string;
  cidade: string;
  estado: string;
  data_cadastro: string; 
};

type Campo = { id: string; label: string; tipo: string; opcoes?: string[] };
type Secao = { titulo: string; campos: Campo[] };
type ModeloFicha = { id: string; titulo: string; campos: Secao[] };
type ModeloTermo = { id: string; titulo: string; conteudo: string; campos: Campo[] };
type Midia = { id: string; paciente_id: string; url_arquivo: string; categoria: 'Antes' | 'Durante' | 'Depois'; procedimento: string; data_registro: string; observacoes: string; };

export default function Pacientes() {
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');

  // ESTADOS PARA OS AVISOS BONITOS (Substitui os alerts e confirms)
  const [toast, setToast] = useState<{ show: boolean, msg: string, type: 'success' | 'error' }>({ show: false, msg: '', type: 'success' });
  const [confirmDialog, setConfirmDialog] = useState<{ show: boolean, msg: string, action: (() => void) | null }>({ show: false, msg: '', action: null });

  const [modalAberto, setModalAberto] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState<'dados' | 'anamneses' | 'documentos' | 'midias'>('dados');
  
  const [form, setForm] = useState<Partial<Paciente>>({});

  const [modelosFichas, setModelosFichas] = useState<ModeloFicha[]>([]);
  const [modelosTermos, setModelosTermos] = useState<ModeloTermo[]>([]);
  const [historicoAnamneses, setHistoricoAnamneses] = useState<any[]>([]);
  const [historicoDocumentos, setHistoricoDocumentos] = useState<any[]>([]);
  
  const [fluxoAnamnese, setFluxoAnamnese] = useState<'lista' | 'selecao' | 'preenchendo'>('lista');
  const [fichaSelecionada, setFichaSelecionada] = useState<ModeloFicha | null>(null);
  const [fichaPreenchidaId, setFichaPreenchidaId] = useState<string | null>(null);
  const [respostasAtuais, setRespostasAtuais] = useState<Record<string, any>>({});
  
  const [fluxoDocumento, setFluxoDocumento] = useState<'lista' | 'selecao' | 'preenchendo'>('lista');
  const [termoSelecionado, setTermoSelecionado] = useState<ModeloTermo | null>(null);
  const [termoPreenchidoId, setTermoPreenchidoId] = useState<string | null>(null);
  const [respostasTermo, setRespostasTermo] = useState<Record<string, any>>({});
  const [autorizacaoTermo, setAutorizacaoTermo] = useState<'Sim' | 'Não' | null>(null);
  const [cidadeTermo, setCidadeTermo] = useState('João Monlevade - MG');
  
  const [historicoMidias, setHistoricoMidias] = useState<Midia[]>([]);
  const [fluxoMidia, setFluxoMidia] = useState<'lista' | 'upload'>('lista');
  const [arquivoMidia, setArquivoMidia] = useState<File | null>(null);
  const [uploadingMidia, setUploadingMidia] = useState(false);
  const [formMidia, setFormMidia] = useState({ categoria: 'Antes', procedimento: '', data_registro: new Date().toISOString().split('T')[0], observacoes: '' });

  const [dataAssinatura, setDataAssinatura] = useState(new Date().toISOString().split('T')[0]);
  const [termoAceito, setTermoAceito] = useState(false);
  const [cpfAssinatura, setCpfAssinatura] = useState('');
  const [profAceito, setProfAceito] = useState(false);
  const [registroProfissional, setRegistroProfissional] = useState('');

  const [gerandoPdf, setGerandoPdf] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasClienteRef = useRef<HTMLCanvasElement>(null);
  const canvasProfRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isDrawingCliente, setIsDrawingCliente] = useState(false);
  const [isDrawingProf, setIsDrawingProf] = useState(false);

  // FUNÇÃO PARA EXIBIR O TOAST (Aviso flutuante)
  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ show: true, msg, type });
    setTimeout(() => setToast(t => ({ ...t, show: false })), 3500);
  };

  const formatarCPF = (v: string) => v.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})/, '$1-$2').replace(/(-\d{2})\d+?$/, '$1');
  const formatarTelefone = (v: string) => v.replace(/\D/g, '').replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2').replace(/(-\d{4})\d+?$/, '$1');
  const formatarCEP = (v: string) => v.replace(/\D/g, '').replace(/(\d{5})(\d)/, '$1-$2').replace(/(-\d{3})\d+?$/, '$1');

  const estadosBrasil = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

  const formatarTextoTermo = (texto: string) => texto.split(/\\n|\n/).map((linha, idx) => {
    if (linha.trim() === '') return <br key={idx} />;
    const isHeader = linha === linha.toUpperCase() && linha.length > 5 && !linha.includes('(');
    return <p key={idx} className={`mb-2 leading-relaxed ${isHeader ? 'font-bold text-[#B68B40] mt-6 text-sm tracking-wider uppercase' : 'text-gray-700 text-sm text-justify'}`}>{linha}</p>;
  });

  const obterTextoDeclaracao = (titulo: string) => {
    if (titulo.includes('Facial')) return "Declaro que todas as informações fornecidas nesta ficha são verdadeiras e completas, estando ciente de que a omissão de informações poderá comprometer a segurança e os resultados do tratamento.\n\nDeclaro ainda que fui orientado(a) sobre o protocolo proposto, compreendendo que os procedimentos estéticos isoladamente não garantem os resultados esperados. Estou ciente de que o sucesso do tratamento depende também da realização correta dos cuidados domiciliares, do uso dos produtos indicados, da frequência das sessões e do cumprimento integral do protocolo personalizado estabelecido pela profissional.\n\nConfirmo que todas as minhas dúvidas foram esclarecidas e autorizo o início do tratamento conforme avaliação profissional.";
    if (titulo.includes('Corporal')) return "Declaro que as informações prestadas são verdadeiras e estou ciente dos procedimentos propostos.";
    if (titulo.includes('Lipo Enzimática') || titulo.includes('Microagulhamento') || titulo.includes('Toxina')) return `Declaro que as informações acima são verdadeiras e que não omiti qualquer informação importante sobre minha saúde. Fui informada sobre o procedimento de ${titulo.replace('Anamnese - ', '').toLowerCase()}, seus benefícios, riscos, contraindicações e cuidados necessários.`;
    return "Declaro que as informações acima são verdadeiras e que não omiti qualquer informação importante sobre minha saúde.";
  };

  const baixarPDF = async (tipo: 'ficha' | 'termo', item: any) => {
    setGerandoPdf(true);
    const tituloDoc = tipo === 'ficha' ? item.historico_medico?.tipo_ficha : item.tipo_documento;
    const nomeArquivo = `${form.nome_completo} - ${tituloDoc}.pdf`;

    const enderecoCompleto = [
      form.rua ? `${form.rua}` : '',
      form.numero ? `nº ${form.numero}` : '',
      form.bairro ? `Bairro: ${form.bairro}` : '',
      form.cidade ? `${form.cidade}` : '',
      form.estado ? `- ${form.estado}` : '',
      form.cep ? `(CEP: ${form.cep})` : ''
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
            <div class="title-text"><span class="dot">•</span> ${tituloDoc} <span class="dot">•</span></div>
            <div class="title-line"></div>
          </div>
        </div>
        
        <div class="section-box avoid-cut" style="margin-bottom: 20px;">
          <div class="section-title">DADOS PESSOAIS</div>
          <table class="info-table">
            <tr>
              <td colspan="2"><span class="label">Nome:</span> <span class="val">${form.nome_completo}</span></td>
              <td colspan="1"><span class="label">Nascimento:</span> <span class="val">${form.data_nascimento ? new Date(form.data_nascimento).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : ''}</span></td>
            </tr>
            <tr>
              <td colspan="1" style="width: 40%;"><span class="label">CPF:</span> <span class="val">${form.cpf || ''}</span></td>
              <td colspan="2"><span class="label">Telefone:</span> <span class="val">${form.telefone || ''}</span></td>
            </tr>
            <tr>
              <td colspan="3"><span class="label">E-mail:</span> <span class="val">${form.email || ''}</span></td>
            </tr>
            <tr>
              <td colspan="3"><span class="label">Endereço:</span> <span class="val">${enderecoCompleto}</span></td>
            </tr>
          </table>
        </div>
    `;

    if (tipo === 'ficha') {
      const respostas = item.historico_medico.respostas || {};
      const modelo = modelosFichas.find(m => m.titulo === item.historico_medico.tipo_ficha);
      
      if (modelo && modelo.campos) {
        for (let i = 0; i < modelo.campos.length; i += 2) {
          const secaoEsq = modelo.campos[i];
          const secaoDir = modelo.campos[i + 1];

          html += `<div class="row avoid-cut">`;
          
          html += `<div class="col-left">
            <div class="section-box" style="margin-bottom: 0;">
              <div class="section-title">${secaoEsq.titulo}</div>
              <table class="qa-table">
          `;
          secaoEsq.campos?.forEach(c => {
             let resp = respostas[c.id];
             if (Array.isArray(resp)) resp = resp.join(', ');
             else if (resp === true) resp = 'Sim';
             else if (resp === false) resp = 'Não';
             if (!resp && resp !== false) resp = '---';
             if (c.tipo === 'textarea' || (typeof resp === 'string' && resp.length > 30)) { html += `<tr><td colspan="2"><div class="question" style="width:100%;">${c.label}</div><div class="answer-long">${resp}</div></td></tr>`; } else { html += `<tr><td class="question">${c.label}</td><td class="answer">${resp}</td></tr>`; }
          });
          html += `</table></div></div>`;

          if (secaoDir) {
            html += `<div class="col-right">
              <div class="section-box" style="margin-bottom: 0;">
                <div class="section-title">${secaoDir.titulo}</div>
                <table class="qa-table">
            `;
            secaoDir.campos?.forEach(c => {
               let resp = respostas[c.id];
               if (Array.isArray(resp)) resp = resp.join(', ');
               else if (resp === true) resp = 'Sim';
               else if (resp === false) resp = 'Não';
               if (!resp && resp !== false) resp = '---';
               if (c.tipo === 'textarea' || (typeof resp === 'string' && resp.length > 30)) { html += `<tr><td colspan="2"><div class="question" style="width:100%;">${c.label}</div><div class="answer-long">${resp}</div></td></tr>`; } else { html += `<tr><td class="question">${c.label}</td><td class="answer">${resp}</td></tr>`; }
            });
            html += `</table></div></div>`;
          }
          
          html += `<div class="clear"></div></div>`;
        }
      }
      
      html += `
        <div class="avoid-cut">
          <div class="section-box" style="margin-top: 5px;">
            <div class="section-title">DECLARAÇÃO</div>
            <div class="termo-content">${obterTextoDeclaracao(item.historico_medico.tipo_ficha)}</div>
            
            <table class="info-table" style="margin-top: 15px;">
              <tr><td><span class="label">Data:</span> <span class="val">${item.historico_medico.data_assinatura ? new Date(item.historico_medico.data_assinatura).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : ''}</span></td></tr>
            </table>
            
            <div class="signatures">
              <div class="sig-box" style="width: 100%;">
                <div class="sig-line">
                  ${item.historico_medico.assinatura_desenho ? `<img src="${item.historico_medico.assinatura_desenho}" class="sig-img" />` : ''}
                </div>
                <p class="sig-name">${form.nome_completo}</p>
                <p class="sig-role">Assinatura do(a) Paciente</p>
              </div>
            </div>
          </div>
      `;

      if (item.historico_medico.assinatura_eletronica) {
         const auth = item.historico_medico.assinatura_eletronica;
         html += `<div class="legal-hash"><strong>🔒 AUTENTICAÇÃO ELETRÔNICA (MP 2.200-2/2001)</strong><br/>Data/Hora: ${new Date(auth.data_hora_assinatura).toLocaleString('pt-BR')} | IP: ${auth.ip_dispositivo} | CPF Autenticado: ${auth.cpf_assinante}<br/>Hash SHA-256: ${auth.hash_autenticacao}</div>`;
      }
      html += `</div>`;

    } else {
       const docs = item.url_documento_assinado;
       const modeloOriginal = modelosTermos.find(m => m.titulo === item.tipo_documento);
       
       html += `<div class="section-box" style="margin-top: 10px;"><div class="section-title">TERMO DE CONSENTIMENTO</div><div class="termo-content">${docs.texto_acordado}</div></div><div class="avoid-cut"><div class="section-box">`;
       
       if (docs.respostas_extras && Object.keys(docs.respostas_extras).length > 0) {
           html += `<table class="info-table" style="margin-top:5px; margin-bottom: 15px;">`;
           for(let key in docs.respostas_extras) { let label = key; modeloOriginal?.campos?.forEach(c => { if(c.id === key) label = c.label; }); html += `<tr><td><span class="label">${label}:</span> <span class="val">${docs.respostas_extras[key]}</span></td></tr>`; }
           html += `</table>`;
       }

       html += `<div style="margin-top:10px; padding: 12px; border: 1.5px solid #D4B872; border-radius: 6px; text-align: center; background: #fffcf5; font-size: 11px; letter-spacing: 0.5px; color: #B68B40;"><strong>${docs.autorizacao === 'Sim' ? '✓ AUTORIZO' : '✗ NÃO AUTORIZO'} A REALIZAÇÃO DO PROCEDIMENTO E/OU USO DE MINHA IMAGEM</strong></div><table class="info-table" style="margin-top: 15px;"><tr><td style="width: 70%;"><span class="label">Cidade:</span> <span class="val">${docs.cidade}</span></td><td style="width: 30%;"><span class="label">Data:</span> <span class="val">${new Date(docs.data_assinatura).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</span></td></tr></table><div class="signatures"><div class="sig-box"><div class="sig-line">${docs.assinatura_cliente_desenho ? `<img src="${docs.assinatura_cliente_desenho}" class="sig-img" />` : ''}</div><p class="sig-name">${form.nome_completo}</p><p class="sig-role">Assinatura do(a) Paciente</p></div><div class="sig-box"><div class="sig-line">${docs.assinatura_profissional_desenho ? `<img src="${docs.assinatura_profissional_desenho}" class="sig-img" />` : ''}</div><p class="sig-name">Dra. Emily Barcelos</p><p class="sig-role">Biomédica Esteta</p></div></div></div>`;

       if (docs.assinatura_eletronica) {
         const auth = docs.assinatura_eletronica;
         html += `<div class="legal-hash"><strong>🔒 AUTENTICAÇÃO DUPLA (MP 2.200-2/2001)</strong><br/>Data/Hora: ${new Date(auth.data_hora_assinatura).toLocaleString('pt-BR')} | IP: ${auth.ip_dispositivo}<br/>CPF Paciente: ${auth.cpf_paciente} | Reg. Profissional: ${auth.registro_profissional}<br/>Hash SHA-256: ${auth.hash_autenticacao}</div>`;
      }
      html += `</div>`;
    }
    html += `</div>`;

    const opt = { margin: 15, filename: nomeArquivo, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }, pagebreak: { mode: 'css', avoid: '.avoid-cut' } };
    try { await html2pdf().set(opt).from(html).save(); } catch (error) { showToast("Ocorreu um erro ao gerar o PDF. Tente novamente.", "error"); } finally { setGerandoPdf(false); }
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => { setIsDrawing(true); const ctx = canvasRef.current?.getContext('2d'); if (!ctx) return; const rect = canvasRef.current!.getBoundingClientRect(); const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX; const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY; ctx.beginPath(); ctx.moveTo(clientX - rect.left, clientY - rect.top); };
  const draw = (e: React.MouseEvent | React.TouchEvent) => { if (!isDrawing) return; const ctx = canvasRef.current?.getContext('2d'); if (!ctx) return; const rect = canvasRef.current!.getBoundingClientRect(); const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX; const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY; ctx.lineTo(clientX - rect.left, clientY - rect.top); ctx.stroke(); };
  const stopDrawing = () => setIsDrawing(false);
  const limparAssinatura = () => canvasRef.current?.getContext('2d')?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  const getImgCanvas = () => canvasRef.current?.toDataURL('image/png') || null;

  const startDrawingTermo = (e: React.MouseEvent | React.TouchEvent, tipo: 'cliente' | 'prof') => { const isCliente = tipo === 'cliente'; isCliente ? setIsDrawingCliente(true) : setIsDrawingProf(true); const canvas = isCliente ? canvasClienteRef.current : canvasProfRef.current; const ctx = canvas?.getContext('2d'); if (!canvas || !ctx) return; const rect = canvas.getBoundingClientRect(); const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX; const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY; ctx.beginPath(); ctx.moveTo(clientX - rect.left, clientY - rect.top); };
  const drawTermo = (e: React.MouseEvent | React.TouchEvent, tipo: 'cliente' | 'prof') => { const isDrawingTermo = tipo === 'cliente' ? isDrawingCliente : isDrawingProf; if (!isDrawingTermo) return; const canvas = tipo === 'cliente' ? canvasClienteRef.current : canvasProfRef.current; const ctx = canvas?.getContext('2d'); if (!canvas || !ctx) return; const rect = canvas.getBoundingClientRect(); const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX; const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY; ctx.lineTo(clientX - rect.left, clientY - rect.top); ctx.stroke(); };
  const stopDrawingTermo = (tipo: 'cliente' | 'prof') => tipo === 'cliente' ? setIsDrawingCliente(false) : setIsDrawingProf(false);
  const limparCanvasTermo = (tipo: 'cliente' | 'prof') => { const canvas = tipo === 'cliente' ? canvasClienteRef.current : canvasProfRef.current; canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height); };
  const getImgCanvasTermo = (ref: React.RefObject<HTMLCanvasElement>) => ref.current?.toDataURL('image/png') || null;

  useEffect(() => { buscarPacientes(); buscarModelosDisponiveis(); }, []);

  const buscarPacientes = async () => { setLoading(true); const { data } = await supabase.from('pacientes').select('*'); if (data) setPacientes(data); setLoading(false); };
  const buscarModelosDisponiveis = async () => { const { data: fichas } = await supabase.from('modelos_fichas').select('*').order('titulo', { ascending: true }); if (fichas) setModelosFichas(fichas); const { data: termos } = await supabase.from('modelos_termos').select('*').order('titulo', { ascending: true }); if (termos) setModelosTermos(termos); };
  const buscarHistoricoPaciente = async (pacienteId: string) => { const { data: anamneses } = await supabase.from('fichas_anamnese').select('*').eq('paciente_id', pacienteId).order('created_at', { ascending: false }); if (anamneses) setHistoricoAnamneses(anamneses); const { data: documentos } = await supabase.from('documentos_legais').select('*').eq('paciente_id', pacienteId).order('created_at', { ascending: false }); if (documentos) setHistoricoDocumentos(documentos); const { data: midiasData } = await supabase.from('paciente_midias').select('*').eq('paciente_id', pacienteId).order('data_registro', { ascending: false }); if (midiasData) setHistoricoMidias(midiasData); };
  
  const salvarPaciente = async () => { 
    if (!form.nome_completo) return showToast('O Nome do paciente é obrigatório.', 'error'); 
    
    const payload = { 
      nome_completo: form.nome_completo, 
      cpf: form.cpf || null, 
      data_nascimento: form.data_nascimento || null, 
      telefone: form.telefone || null, 
      email: form.email || null, 
      cep: form.cep || null,
      rua: form.rua || null,
      numero: form.numero || null,
      bairro: form.bairro || null,
      cidade: form.cidade || null,
      estado: form.estado || null
    }; 

    if (isEditing && form.id) { 
      const { error } = await supabase.from('pacientes').update(payload).eq('id', form.id); 
      if (error) { showToast('Erro ao atualizar: ' + error.message, 'error'); return; }
      buscarPacientes(); 
      showToast('Paciente atualizado com sucesso!', 'success'); 
    } else { 
      const { data, error } = await supabase.from('pacientes').insert([{ ...payload, data_cadastro: new Date().toISOString() }]).select().single(); 
      if (error) { showToast('Erro ao cadastrar: Verifique se as colunas foram criadas na base de dados.', 'error'); return; }
      if (data) { 
        buscarPacientes(); 
        setForm(data); 
        setIsEditing(true); 
        showToast('Novo paciente registado com sucesso!', 'success'); 
      } 
    } 
  };

  const deletarPaciente = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDialog({
      show: true,
      msg: 'Tem a certeza que deseja eliminar este paciente e todo o seu histórico? Esta ação é permanente.',
      action: async () => {
        const { error } = await supabase.from('pacientes').delete().eq('id', id);
        if (error) { showToast('Erro ao apagar: ' + error.message, 'error'); } 
        else { setPacientes(prev => prev.filter(p => p.id !== id)); showToast('Paciente eliminado.', 'success'); }
        setConfirmDialog({ show: false, msg: '', action: null });
      }
    });
  };

  const gerarAssinaturaEletronica = async (dupla = false) => { if (!termoAceito) { showToast("É necessário aceitar os termos de compromisso.", "error"); return null; } if (cpfAssinatura.length < 14) { showToast("O CPF do paciente está incompleto.", "error"); return null; } if (dupla) { if (!profAceito) { showToast("A Profissional precisa de confirmar a autenticação.", "error"); return null; } if (registroProfissional.length < 4) { showToast("O Registo da Profissional está incompleto.", "error"); return null; } } let ip = 'IP não identificado'; try { const response = await fetch('https://api.ipify.org?format=json'); const data = await response.json(); ip = data.ip; } catch (e) {} const userAgent = navigator.userAgent; const dataHora = new Date().toISOString(); const stringParaHash = dupla ? `PACIENTE:${cpfAssinatura}-PROF:${registroProfissional}-${dataHora}-${ip}-${userAgent}` : `${cpfAssinatura}-${dataHora}-${ip}-${userAgent}`; const msgBuffer = new TextEncoder().encode(stringParaHash); const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer); const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join(''); return { tipo: dupla ? 'eletronica_avancada_dupla' : 'eletronica_avancada', cpf_assinante: cpfAssinatura, cpf_paciente: cpfAssinatura, registro_profissional: registroProfissional, ip_dispositivo: ip, user_agent: userAgent, data_hora_assinatura: dataHora, hash_autenticacao: hashHex }; };
  const iniciarNovaFicha = (modelo: ModeloFicha) => { setFichaSelecionada(modelo); setRespostasAtuais({}); setDataAssinatura(new Date().toISOString().split('T')[0]); setFichaPreenchidaId(null); setTermoAceito(false); setCpfAssinatura(form.cpf || ''); setProfAceito(false); setRegistroProfissional(''); setFluxoAnamnese('preenchendo'); setTimeout(limparAssinatura, 100); };
  const editarFichaSalva = (fichaSalva: any) => { const modeloOriginal = modelosFichas.find(m => m.titulo === fichaSalva.historico_medico?.tipo_ficha); if (!modeloOriginal) return showToast('Modelo base desta ficha já não existe.', 'error'); setFichaSelecionada(modeloOriginal); setRespostasAtuais(fichaSalva.historico_medico?.respostas || {}); setDataAssinatura(fichaSalva.historico_medico?.data_assinatura || new Date().toISOString().split('T')[0]); setFichaPreenchidaId(fichaSalva.id); setTermoAceito(false); setCpfAssinatura(form.cpf || ''); setProfAceito(false); setRegistroProfissional(''); setFluxoAnamnese('preenchendo'); setTimeout(() => { const ctx = canvasRef.current?.getContext('2d'); if (fichaSalva.historico_medico?.assinatura_desenho && ctx) { const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0); img.src = fichaSalva.historico_medico.assinatura_desenho; } else limparAssinatura(); }, 150); };
  
  const excluirFichaSalva = (id: string) => { 
    setConfirmDialog({
      show: true, msg: 'Pretende mesmo eliminar esta ficha de anamnese?',
      action: async () => {
        await supabase.from('fichas_anamnese').delete().eq('id', id); 
        setHistoricoAnamneses(prev => prev.filter(f => f.id !== id));
        showToast('Ficha eliminada com sucesso.', 'success');
        setConfirmDialog({ show: false, msg: '', action: null });
      }
    });
  };

  const salvarFichaAnamnese = async () => { const imgDesenho = getImgCanvas(); const dadosAssinatura = await gerarAssinaturaEletronica(false); if (!dadosAssinatura) return; const payload = { paciente_id: form.id, historico_medico: { tipo_ficha: fichaSelecionada?.titulo, respostas: respostasAtuais, assinatura_desenho: imgDesenho, assinatura_eletronica: dadosAssinatura, data_assinatura: dataAssinatura, data_preenchimento: new Date().toISOString() } }; if (fichaPreenchidaId) { const { data } = await supabase.from('fichas_anamnese').update(payload).eq('id', fichaPreenchidaId).select().single(); if (data) { setHistoricoAnamneses(prev => prev.map(f => f.id === fichaPreenchidaId ? data : f)); setFluxoAnamnese('lista'); showToast('Ficha atualizada.', 'success'); } } else { const { data } = await supabase.from('fichas_anamnese').insert([payload]).select().single(); if (data) { setHistoricoAnamneses(prev => [data, ...prev]); setFluxoAnamnese('lista'); showToast('Ficha guardada com sucesso.', 'success'); } } };

  const iniciarNovoTermo = (modelo: ModeloTermo) => { setTermoSelecionado(modelo); setRespostasTermo({}); setAutorizacaoTermo(null); setCidadeTermo('João Monlevade - MG'); setDataAssinatura(new Date().toISOString().split('T')[0]); setTermoPreenchidoId(null); setTermoAceito(false); setCpfAssinatura(form.cpf || ''); setProfAceito(false); setRegistroProfissional(''); setFluxoDocumento('preenchendo'); setTimeout(() => { limparCanvasTermo('cliente'); limparCanvasTermo('prof'); }, 100); };
  const editarTermoSalvo = (termoSalvo: any) => { const modeloOriginal = modelosTermos.find(m => m.titulo === termoSalvo.tipo_documento); if (!modeloOriginal) return showToast('Modelo não encontrado.', 'error'); const docs = termoSalvo.url_documento_assinado; setTermoSelecionado(modeloOriginal); setRespostasTermo(docs.respostas_extras || {}); setAutorizacaoTermo(docs.autorizacao || null); setCidadeTermo(docs.cidade || 'João Monlevade - MG'); setDataAssinatura(docs.data_assinatura || new Date().toISOString().split('T')[0]); setTermoPreenchidoId(termoSalvo.id); setTermoAceito(false); setCpfAssinatura(form.cpf || ''); setProfAceito(false); setRegistroProfissional(''); setFluxoDocumento('preenchendo'); setTimeout(() => { const ctxC = canvasClienteRef.current?.getContext('2d'); const ctxP = canvasProfRef.current?.getContext('2d'); if (docs.assinatura_cliente_desenho && ctxC) { const img = new Image(); img.onload = () => ctxC.drawImage(img, 0, 0); img.src = docs.assinatura_cliente_desenho; } else limparCanvasTermo('cliente'); if (docs.assinatura_profissional_desenho && ctxP) { const img = new Image(); img.onload = () => ctxC.drawImage(img, 0, 0); img.src = docs.assinatura_profissional_desenho; } else limparCanvasTermo('prof'); }, 150); };
  
  const excluirTermoSalvo = (id: string) => { 
    setConfirmDialog({
      show: true, msg: 'Excluir definitivamente este Termo de Consentimento?',
      action: async () => {
        await supabase.from('documentos_legais').delete().eq('id', id); 
        setHistoricoDocumentos(prev => prev.filter(d => d.id !== id));
        showToast('Termo excluído com sucesso.', 'success');
        setConfirmDialog({ show: false, msg: '', action: null });
      }
    });
  };

  const salvarDocumentoTermo = async () => { if (!autorizacaoTermo) return showToast("Assinale se o paciente AUTORIZA ou NÃO AUTORIZA no fim do formulário.", "error"); const imgCliente = getImgCanvasTermo(canvasClienteRef); const imgProf = getImgCanvasTermo(canvasProfRef); const dadosAssinatura = await gerarAssinaturaEletronica(true); if (!dadosAssinatura) return; const payload = { paciente_id: form.id, tipo_documento: termoSelecionado?.titulo, status_assinatura: true, url_documento_assinado: { texto_acordado: termoSelecionado?.conteudo, respostas_extras: respostasTermo, autorizacao: autorizacaoTermo, cidade: cidadeTermo, data_assinatura: dataAssinatura, assinatura_cliente_desenho: imgCliente, assinatura_profissional_desenho: imgProf, assinatura_eletronica: dadosAssinatura } }; if (termoPreenchidoId) { const { data } = await supabase.from('documentos_legais').update(payload).eq('id', termoPreenchidoId).select().single(); if (data) { setHistoricoDocumentos(prev => prev.map(d => d.id === termoPreenchidoId ? data : d)); setFluxoDocumento('lista'); showToast('Termo atualizado.', 'success'); } } else { const { data } = await supabase.from('documentos_legais').insert([payload]).select().single(); if (data) { setHistoricoDocumentos(prev => [data, ...prev]); setFluxoDocumento('lista'); showToast('Termo guardado com sucesso.', 'success'); } } };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files && e.target.files.length > 0) setArquivoMidia(e.target.files[0]); };
  
  const salvarNovaMidia = async () => { 
    if (!arquivoMidia) return showToast('Selecione uma fotografia para adicionar.', 'error'); 
    if (!formMidia.procedimento) return showToast('Preencha o nome do procedimento realizado.', 'error'); 
    setUploadingMidia(true); 
    try { 
      const fileExt = arquivoMidia.name.split('.').pop(); 
      const fileName = `${form.id}-${Date.now()}.${fileExt}`; 
      const { error: uploadError } = await supabase.storage.from('midias').upload(fileName, arquivoMidia, { cacheControl: '3600', upsert: false }); 
      if (uploadError) throw new Error(uploadError.message); 
      const { data: publicUrlData } = supabase.storage.from('midias').getPublicUrl(fileName); 
      const payload = { paciente_id: form.id, url_arquivo: publicUrlData.publicUrl, categoria: formMidia.categoria, procedimento: formMidia.procedimento, data_registro: formMidia.data_registro, observacoes: formMidia.observacoes }; 
      const { data, error: dbError } = await supabase.from('paciente_midias').insert([payload]).select().single(); 
      if (dbError) throw new Error(dbError.message); 
      
      showToast('Fotografia registada na evolução.', 'success'); 
      setHistoricoMidias(prev => [data as Midia, ...prev]); 
      setFluxoMidia('lista'); 
      setArquivoMidia(null); 
      setFormMidia({ ...formMidia, procedimento: '', observacoes: '' }); 
    } catch (error: any) { 
      showToast(error.message, 'error'); 
    } finally { 
      setUploadingMidia(false); 
    } 
  };

  const deletarMidia = (id: string, url_arquivo: string) => { 
    setConfirmDialog({
      show: true, msg: 'Tem a certeza que deseja eliminar esta foto de evolução?',
      action: async () => {
        await supabase.from('paciente_midias').delete().eq('id', id); 
        try { 
          const fileName = url_arquivo.split('/').pop(); 
          if (fileName) await supabase.storage.from('midias').remove([fileName]); 
        } catch (e) {} 
        setHistoricoMidias(prev => prev.filter(m => m.id !== id));
        showToast('Foto removida.', 'success');
        setConfirmDialog({ show: false, msg: '', action: null });
      }
    });
  };

  const abrirPerfilPaciente = (paciente: Paciente) => { setForm(paciente); setIsEditing(true); setAbaAtiva('dados'); setFluxoAnamnese('lista'); setFluxoDocumento('lista'); setFluxoMidia('lista'); setHistoricoAnamneses([]); setHistoricoDocumentos([]); setHistoricoMidias([]); buscarHistoricoPaciente(paciente.id); buscarModelosDisponiveis(); setModalAberto(true); };
  const pacientesProcessados = pacientes.filter(p => p.nome_completo.toLowerCase().includes(busca.toLowerCase())).sort((a, b) => a.nome_completo.localeCompare(b.nome_completo));

  return (
    <div className="w-full h-full p-4 md:p-8 mx-auto flex flex-col overflow-x-hidden box-border max-w-7xl relative">
      
      {/* TOAST CUSTOMIZADO (Aviso Flutuante) */}
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

      {/* MODAL DE CONFIRMAÇÃO CUSTOMIZADO (Substitui window.confirm) */}
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

      {/* CABEÇALHO DA PÁGINA */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 w-full shrink-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-light text-gray-800">Pacientes</h1>
          <p className="text-sm md:text-base text-gray-500 mt-1">Gestão de prontuários 100% digitais</p>
        </div>
        <button 
          onClick={() => { setForm({}); setIsEditing(false); setAbaAtiva('dados'); setModalAberto(true); }} 
          className="bg-[#B68B40] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#9a7330] w-full sm:w-auto shadow-sm shrink-0"
        >
          + Novo Paciente
        </button>
      </header>

      {gerandoPdf && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-[9999] flex flex-col items-center justify-center">
          <div className="w-16 h-16 border-4 border-[#B68B40] border-t-transparent rounded-full animate-spin mb-6"></div>
          <h2 className="text-2xl font-serif text-[#B68B40]">Gerando Documento Oficial</h2>
          <p className="text-gray-500 mt-2 font-medium text-center px-4">Aguarde, formatando o PDF para download automático...</p>
        </div>
      )}

      {/* CAIXA BRANCA PRINCIPAL */}
      <div className="bg-white rounded-xl border border-[#B68B40]/30 shadow-sm flex-1 flex flex-col overflow-hidden w-full">
        
        {/* BARRA DE PESQUISA */}
        <div className="p-4 border-b border-[#B68B40]/20 bg-[#FDFCFB] shrink-0">
          <input type="text" placeholder="Procurar paciente..." value={busca} onChange={(e) => setBusca(e.target.value)} className="w-full md:max-w-md border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:border-[#B68B40]"/>
        </div>
        
        {/* ÁREA DA LISTA */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden w-full">
          
          {/* LAYOUT PARA TELEMÓVEL */}
          <div className="block sm:hidden divide-y divide-gray-100 w-full">
            {pacientesProcessados.map(paciente => (
              <div key={paciente.id} className="p-4 flex items-center justify-between hover:bg-[#B68B40]/5 cursor-pointer transition-colors" onClick={() => abrirPerfilPaciente(paciente)}>
                <div className="flex-1 min-w-0 pr-3 overflow-hidden">
                  <p className="text-sm font-medium text-gray-800 truncate" title={paciente.nome_completo}>{paciente.nome_completo}</p>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{paciente.telefone || 'Sem telefone'}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={(e) => deletarPaciente(paciente.id, e)} className="text-red-400 p-2 hover:bg-red-50 rounded-full transition-colors" title="Eliminar Paciente">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                  <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </div>
              </div>
            ))}
          </div>

          {/* LAYOUT PARA COMPUTADOR */}
          <table className="hidden sm:table w-full text-left table-fixed">
            <thead className="bg-gray-50/50 text-gray-500 text-xs uppercase sticky top-0 border-b border-gray-200">
              <tr>
                <th className="p-4 w-[45%] font-bold tracking-wider">Paciente</th>
                <th className="p-4 w-[35%] font-bold tracking-wider">Contato</th>
                <th className="p-4 text-right w-[20%] font-bold tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pacientesProcessados.map(paciente => (
                <tr key={paciente.id} className="hover:bg-[#B68B40]/5 cursor-pointer transition-colors" onClick={() => abrirPerfilPaciente(paciente)}>
                  <td className="p-4 font-medium text-gray-800 truncate">{paciente.nome_completo}</td>
                  <td className="p-4 text-sm text-gray-600 truncate">{paciente.telefone || '---'}</td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-3">
                      <button onClick={(e) => deletarPaciente(paciente.id, e)} className="text-red-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors shrink-0" title="Eliminar Paciente">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                      <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

        </div>
      </div>

      {/* MODAL DE PERFIL/NOVO PACIENTE */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden mx-auto">
            <div className="p-4 md:p-5 border-b border-gray-100 flex justify-between items-center bg-[#FDFCFB] shrink-0">
              <h2 className="text-lg md:text-xl font-medium text-[#B68B40] truncate pr-4">{isEditing ? `Prontuário: ${form.nome_completo}` : 'Novo Paciente'}</h2>
              <button onClick={() => setModalAberto(false)} className="text-gray-400 text-2xl shrink-0 hover:text-gray-600">&times;</button>
            </div>

            {isEditing && (
              <div className="flex border-b border-gray-200 bg-gray-50 overflow-x-auto whitespace-nowrap shrink-0">
                <button onClick={() => setAbaAtiva('dados')} className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${abaAtiva === 'dados' ? 'border-[#B68B40] text-[#B68B40]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Dados Pessoais</button>
                <button onClick={() => { setAbaAtiva('anamneses'); setFluxoAnamnese('lista'); }} className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${abaAtiva === 'anamneses' ? 'border-[#B68B40] text-[#B68B40]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Fichas de Anamnese</button>
                <button onClick={() => { setAbaAtiva('documentos'); setFluxoDocumento('lista'); }} className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${abaAtiva === 'documentos' ? 'border-[#B68B40] text-[#B68B40]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Documentos & Termos</button>
                <button onClick={() => { setAbaAtiva('midias'); setFluxoMidia('lista'); }} className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${abaAtiva === 'midias' ? 'border-[#B68B40] text-[#B68B40]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Mídias & Evolução</button>
              </div>
            )}
            
            <div className="flex-1 overflow-y-auto overflow-x-hidden bg-white">
              
              {abaAtiva === 'dados' && (
                <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
                  <div><label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Nome Completo *</label><input type="text" value={form.nome_completo || ''} onChange={e => setForm({...form, nome_completo: e.target.value})} className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:border-[#B68B40] outline-none" required /></div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div><label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">CPF</label><input type="text" value={form.cpf || ''} onChange={e => setForm({...form, cpf: formatarCPF(e.target.value)})} maxLength={14} className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:border-[#B68B40] outline-none" /></div>
                    <div><label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Data de Nascimento</label><input type="date" value={form.data_nascimento || ''} onChange={e => setForm({...form, data_nascimento: e.target.value})} className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:border-[#B68B40] outline-none text-gray-700" /></div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div><label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Telefone (WhatsApp)</label><input type="text" value={form.telefone || ''} onChange={e => setForm({...form, telefone: formatarTelefone(e.target.value)})} maxLength={15} className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:border-[#B68B40] outline-none" /></div>
                    <div><label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">E-mail</label><input type="email" value={form.email || ''} onChange={e => setForm({...form, email: e.target.value})} className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:border-[#B68B40] outline-none" /></div>
                  </div>

                  {/* CAMPOS DE ENDEREÇO SEPARADOS */}
                  <div className="space-y-4 pt-2 border-t border-gray-100">
                    <h3 className="text-xs font-bold text-[#B68B40] uppercase tracking-wider">Endereço</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                      <div><label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">CEP</label><input type="text" value={form.cep || ''} onChange={e => setForm({...form, cep: formatarCEP(e.target.value)})} maxLength={9} placeholder="00000-000" className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:border-[#B68B40] outline-none" /></div>
                      <div className="md:col-span-2"><label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Rua / Logradouro</label><input type="text" value={form.rua || ''} onChange={e => setForm({...form, rua: e.target.value})} placeholder="Ex: Av. Principal" className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:border-[#B68B40] outline-none" /></div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                      <div><label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Número</label><input type="text" value={form.numero || ''} onChange={e => setForm({...form, numero: e.target.value})} placeholder="Ex: 123" className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:border-[#B68B40] outline-none" /></div>
                      <div><label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Bairro</label><input type="text" value={form.bairro || ''} onChange={e => setForm({...form, bairro: e.target.value})} placeholder="Ex: Centro" className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:border-[#B68B40] outline-none" /></div>
                      <div><label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Cidade</label><input type="text" value={form.cidade || ''} onChange={e => setForm({...form, cidade: e.target.value})} placeholder="Ex: João Monlevade" className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:border-[#B68B40] outline-none" /></div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Estado (UF)</label>
                      <select 
                        value={form.estado || ''} 
                        onChange={e => setForm({...form, estado: e.target.value})} 
                        className="w-full md:w-48 border border-gray-300 rounded-lg p-3 text-sm focus:border-[#B68B40] outline-none bg-white uppercase"
                      >
                        <option value="">Selecione...</option>
                        {estadosBrasil.map(estado => (
                          <option key={estado} value={estado}>{estado}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4"><button onClick={salvarPaciente} className="bg-[#B68B40] text-white px-8 py-3 rounded-lg text-sm font-medium hover:bg-[#9a7330] shadow-sm w-full md:w-auto transition-colors">Guardar Dados</button></div>
                </div>
              )}

              {abaAtiva === 'anamneses' && (
                <div className="p-4 md:p-6 h-full flex flex-col">
                  {fluxoAnamnese === 'lista' && (
                    <>
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6"><h3 className="text-lg font-medium text-gray-800">Histórico de Fichas</h3><button onClick={() => setFluxoAnamnese('selecao')} className="bg-[#B68B40] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#9a7330]">+ Nova Ficha Digital</button></div>
                      <div className="space-y-3">
                        {historicoAnamneses.length === 0 ? ( <p className="text-gray-400 text-sm text-center py-12 border-2 border-dashed rounded-xl bg-gray-50">Nenhuma ficha salva para este paciente.</p> ) : (
                          historicoAnamneses.map((f, index) => (
                            <div key={f.id || index} className="p-4 border border-gray-200 rounded-xl flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-gray-50/80 hover:bg-white transition-colors">
                              <div><p className="font-medium text-[#B68B40] text-base">{f.historico_medico?.tipo_ficha || 'Ficha de Anamnese'}</p><p className="text-xs text-gray-500 mt-1">Data: {f.historico_medico?.data_assinatura ? new Date(f.historico_medico.data_assinatura).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : new Date(f.created_at).toLocaleDateString('pt-BR')}</p></div>
                              <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 hidden md:inline-block">Autenticado</span>
                                <button onClick={() => baixarPDF('ficha', f)} className="text-[#B68B40] text-sm font-medium hover:underline px-2 sm:border-l border-gray-300">Baixar PDF</button>
                                <button onClick={() => editarFichaSalva(f)} className="text-[#B68B40] text-sm font-medium hover:underline px-2 border-l border-gray-300">Ver / Editar</button>
                                <button onClick={() => excluirFichaSalva(f.id)} className="text-red-500 text-sm font-medium hover:underline px-2 border-l border-gray-300">Excluir</button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </>
                  )}
                  {fluxoAnamnese === 'selecao' && (
                    <div>
                      <button onClick={() => setFluxoAnamnese('lista')} className="text-[#B68B40] text-sm hover:underline mb-6 block">← Voltar</button>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {modelosFichas.map(modelo => (
                          <div key={modelo.id} onClick={() => iniciarNovaFicha(modelo)} className="p-5 border border-gray-200 rounded-xl hover:border-[#B68B40] cursor-pointer text-center bg-white transition-colors"><div className="w-12 h-12 bg-[#B68B40]/10 text-[#B68B40] rounded-full flex items-center justify-center mx-auto mb-3 text-xl">📋</div><h4 className="font-medium text-gray-800">{modelo.titulo}</h4></div>
                        ))}
                      </div>
                    </div>
                  )}
                  {fluxoAnamnese === 'preenchendo' && fichaSelecionada && (
                    <div className="max-w-3xl mx-auto w-full pb-10">
                      <button onClick={() => setFluxoAnamnese('lista')} className="text-[#B68B40] text-sm hover:underline mb-6 block">← Voltar</button>
                      <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-8 shadow-sm overflow-x-hidden">
                        <h2 className="text-xl md:text-2xl font-light text-[#B68B40] text-center mb-2">{fichaSelecionada.titulo}</h2>
                        <p className="text-center text-xs text-gray-400 mb-8">Paciente: {form.nome_completo}</p>
                        <div className="space-y-8">
                          {fichaSelecionada.campos?.map((secao, idx) => (
                            <div key={idx} className="border-b border-gray-100 pb-6">
                              <h3 className="text-sm font-bold text-[#B68B40] uppercase tracking-wider mb-4 bg-[#B68B40]/5 p-2 rounded">{secao.titulo}</h3>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {secao.campos?.map((campo) => (
                                  <div key={campo.id} className={campo.tipo === 'textarea' ? 'col-span-1 md:col-span-2' : ''}>
                                    <label className="block text-sm text-gray-700 mb-1.5 font-medium">{campo.label}</label>
                                    {campo.tipo === 'text' && (<input type="text" value={respostasAtuais[campo.id] || ''} onChange={e => setRespostasAtuais({...respostasAtuais, [campo.id]: e.target.value})} className="w-full border border-gray-300 p-2.5 text-sm rounded-lg outline-none focus:border-[#B68B40]" />)}
                                    {campo.tipo === 'textarea' && (<textarea value={respostasAtuais[campo.id] || ''} onChange={e => setRespostasAtuais({...respostasAtuais, [campo.id]: e.target.value})} className="w-full border border-gray-300 p-2.5 text-sm rounded-lg outline-none focus:border-[#B68B40] h-24" />)}
                                    {campo.tipo === 'select' && campo.opcoes?.length === 2 && campo.opcoes.includes('Não') && campo.opcoes.includes('Sim') ? (
                                      <div className="flex items-center gap-6 mt-2"><label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700"><input type="radio" name={campo.id} value="Sim" checked={respostasAtuais[campo.id] === 'Sim'} onChange={(e) => setRespostasAtuais({...respostasAtuais, [campo.id]: e.target.value})} className="accent-[#B68B40] w-4 h-4" /> SIM</label><label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700"><input type="radio" name={campo.id} value="Não" checked={respostasAtuais[campo.id] === 'Não'} onChange={(e) => setRespostasAtuais({...respostasAtuais, [campo.id]: e.target.value})} className="accent-[#B68B40] w-4 h-4" /> NÃO</label></div>
                                    ) : campo.tipo === 'select' ? (
                                      <select value={respostasAtuais[campo.id] || ''} onChange={e => setRespostasAtuais({...respostasAtuais, [campo.id]: e.target.value})} className="w-full border border-gray-300 p-2.5 text-sm rounded-lg outline-none focus:border-[#B68B40] bg-white"><option value="">Selecione...</option>{campo.opcoes?.map((op) => <option key={op} value={op}>{op}</option>)}</select>
                                    ) : null}
                                    {campo.tipo === 'checkbox' && (<div className="flex items-center gap-2 mt-2"><input type="checkbox" checked={!!respostasAtuais[campo.id]} onChange={e => setRespostasAtuais({...respostasAtuais, [campo.id]: e.target.checked})} className="accent-[#B68B40] w-4 h-4 cursor-pointer" /><span className="text-sm text-gray-700">Sim / Confirmado</span></div>)}
                                    {campo.tipo === 'multiselect' && (
                                      <div className="grid grid-cols-2 gap-2 mt-2">{campo.opcoes?.map((op) => { const checked = (respostasAtuais[campo.id] || []).includes(op); return (<label key={op} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer"><input type="checkbox" checked={checked} className="accent-[#B68B40]" onChange={(e) => { const anteriores = respostasAtuais[campo.id] || []; const novos = e.target.checked ? [...anteriores, op] : anteriores.filter((item: string) => item !== op); setRespostasAtuais({...respostasAtuais, [campo.id]: novos}); }}/> {op}</label>); })}</div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="mt-8 border-t border-gray-200 pt-8">
                          <h3 className="text-lg font-medium text-[#B68B40] mb-4 uppercase">Declaração</h3>
                          <div className="bg-gray-50 p-4 md:p-6 rounded-lg border border-gray-100 mb-6 text-sm">{formatarTextoTermo(obterTextoDeclaracao(fichaSelecionada.titulo))}</div>
                          <div className="flex flex-col sm:flex-row gap-4 mb-8">
                            <div className="flex-1"><label className="block text-xs font-bold text-gray-600 uppercase mb-1">Cidade</label><input type="text" value={cidadeTermo} onChange={e => setCidadeTermo(e.target.value)} className="w-full border-b border-gray-300 p-2 text-sm outline-none focus:border-[#B68B40]" /></div>
                            <div className="sm:w-1/3"><label className="block text-xs font-bold text-gray-600 uppercase mb-1">Data</label><input type="date" value={dataAssinatura} onChange={e => setDataAssinatura(e.target.value)} className="w-full border-b border-gray-300 p-2 text-sm outline-none focus:border-[#B68B40]" /></div>
                          </div>

                          <div className="border border-gray-200 rounded-xl p-4 md:p-5 bg-gray-50/50 mb-6">
                            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-700 mb-2">Assinatura do(a) Paciente</h3>
                            <div className="border-2 border-dashed border-gray-300 bg-white rounded-lg overflow-hidden touch-none h-32 w-full"><canvas ref={canvasRef} width={800} height={128} className="w-full h-full cursor-crosshair" onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseOut={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} /></div>
                            <button onClick={limparAssinatura} className="text-xs text-gray-500 hover:text-red-500 underline mt-2 block ml-auto">Limpar</button>
                          </div>

                          <div className="border border-emerald-500/30 rounded-xl p-4 md:p-6 bg-emerald-50/20 shadow-sm">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-800 mb-4 flex items-center gap-2">🔒 Assinatura Eletrônica</h3>
                            <div className="space-y-5">
                              <label className="flex items-start gap-3 cursor-pointer"><input type="checkbox" checked={termoAceito} onChange={e => setTermoAceito(e.target.checked)} className="mt-1 accent-emerald-600 w-5 h-5 cursor-pointer shrink-0" /><span className="text-sm text-gray-700 leading-relaxed">Declaro que li e concordo integralmente com as informações. Reconheço a validade desta assinatura eletrônica.</span></label>
                              <div><label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Confirme o CPF do Paciente *</label><input type="text" value={cpfAssinatura} onChange={e => setCpfAssinatura(formatarCPF(e.target.value))} maxLength={14} placeholder="000.000.000-00" className="w-full max-w-sm border border-gray-300 rounded-lg p-3 text-sm focus:border-emerald-500 outline-none bg-white shadow-inner" /></div>
                            </div>
                          </div>
                        </div>
                        <div className="flex justify-end mt-8"><button onClick={salvarFichaAnamnese} className="bg-[#B68B40] text-white px-8 py-3 rounded-lg font-bold text-sm hover:bg-[#9a7330] shadow-sm w-full md:w-auto transition-colors">{fichaPreenchidaId ? 'Atualizar e Re-assinar Ficha' : 'Assinar Digitalmente e Salvar'}</button></div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {abaAtiva === 'documentos' && (
                <div className="p-4 md:p-6 h-full flex flex-col">
                  {fluxoDocumento === 'lista' && (
                    <>
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6"><h3 className="text-lg font-medium text-gray-800">Termos de Consentimento</h3><button onClick={() => setFluxoDocumento('selecao')} className="bg-[#B68B40] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#9a7330]">+ Novo Termo</button></div>
                      <div className="space-y-3">
                        {historicoDocumentos.length === 0 ? ( <p className="text-gray-400 text-sm text-center py-12 border-2 border-dashed rounded-xl bg-gray-50">Nenhum termo assinado.</p> ) : (
                          historicoDocumentos.map((d) => (
                            <div key={d.id} className="p-4 border border-gray-200 rounded-xl flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-gray-50/80 hover:bg-white transition-colors">
                              <div><p className="font-medium text-[#B68B40] text-base">{d.tipo_documento}</p><p className="text-xs text-gray-500 mt-1">Data: {new Date(d.url_documento_assinado.data_assinatura || d.created_at).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</p></div>
                              <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 hidden md:inline-block">Autenticado</span>
                                <button onClick={() => baixarPDF('termo', d)} className="text-[#B68B40] text-sm font-medium hover:underline px-2 sm:border-l border-gray-300">Baixar PDF</button>
                                <button onClick={() => editarTermoSalvo(d)} className="text-[#B68B40] text-sm font-medium hover:underline px-2 border-l border-gray-300">Ver / Editar</button>
                                <button onClick={() => excluirTermoSalvo(d.id)} className="text-red-500 text-sm font-medium hover:underline px-2 border-l border-gray-300">Excluir</button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </>
                  )}
                  {fluxoDocumento === 'selecao' && (
                    <div>
                      <button onClick={() => setFluxoDocumento('lista')} className="text-[#B68B40] text-sm hover:underline mb-6">← Voltar</button>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {modelosTermos.map(termo => (
                          <div key={termo.id} onClick={() => iniciarNovoTermo(termo)} className="p-5 border border-gray-200 rounded-xl hover:border-[#B68B40] cursor-pointer text-center group transition-colors"><div className="text-2xl mb-2">🖋️</div><h4 className="font-medium text-gray-800 group-hover:text-[#B68B40] transition-colors">{termo.titulo}</h4></div>
                        ))}
                      </div>
                    </div>
                  )}
                  {fluxoDocumento === 'preenchendo' && termoSelecionado && (
                    <div className="max-w-3xl mx-auto w-full pb-10">
                      <button onClick={() => setFluxoDocumento('lista')} className="text-[#B68B40] text-sm hover:underline mb-6">← Voltar</button>
                      <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-8 shadow-sm overflow-x-hidden">
                        <h2 className="text-xl md:text-2xl font-serif text-center text-[#B68B40] mb-8 uppercase border-b border-gray-100 pb-4">{termoSelecionado.titulo}</h2>
                        <div className="mb-8 bg-gray-50 p-4 md:p-6 rounded-lg border border-gray-100 text-sm">{formatarTextoTermo(termoSelecionado.conteudo)}</div>
                        
                        {termoSelecionado.campos && termoSelecionado.campos.length > 0 && (
                          <div className="bg-gray-50 p-4 md:p-6 rounded-lg border border-gray-200 mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                            {termoSelecionado.campos.map(campo => (
                              <div key={campo.id} className={campo.tipo === 'textarea' ? 'col-span-1 md:col-span-2' : ''}>
                                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">{campo.label}</label>
                                {campo.tipo === 'textarea' ? (<textarea value={respostasTermo[campo.id] || ''} onChange={e => setRespostasTermo({...respostasTermo, [campo.id]: e.target.value})} className="w-full border border-gray-300 p-2.5 text-sm rounded outline-none focus:border-[#B68B40] h-16"/>) : (<input type={campo.tipo} value={respostasTermo[campo.id] || ''} onChange={e => setRespostasTermo({...respostasTermo, [campo.id]: e.target.value})} className="w-full border border-gray-300 p-2.5 text-sm rounded outline-none focus:border-[#B68B40]"/>)}
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="border border-gray-200 rounded-lg p-4 md:p-5 mb-8">
                          <p className="text-gray-800 font-medium mb-4 text-sm md:text-base">Estou ciente de que os resultados podem variar de acordo com cada organismo e que a realização do procedimento não representa garantia de resultado específico.</p>
                          <div className="flex flex-col gap-3">
                            <label className="flex items-center gap-3 cursor-pointer text-sm font-bold text-gray-700"><input type="radio" name="autorizacao" value="Sim" checked={autorizacaoTermo === 'Sim'} onChange={() => setAutorizacaoTermo('Sim')} className="w-5 h-5 accent-[#B68B40] shrink-0"/> AUTORIZO a realização do procedimento / uso de imagem</label>
                            <label className="flex items-center gap-3 cursor-pointer text-sm font-bold text-gray-700"><input type="radio" name="autorizacao" value="Não" checked={autorizacaoTermo === 'Não'} onChange={() => setAutorizacaoTermo('Não')} className="w-5 h-5 accent-red-500 shrink-0"/> NÃO AUTORIZO a realização do procedimento / uso de imagem</label>
                          </div>
                        </div>

                        <div className="mt-8 border-t border-gray-200 pt-8">
                          <div className="flex flex-col sm:flex-row gap-4 mb-8">
                            <div className="flex-1"><label className="block text-xs font-bold text-gray-600 uppercase mb-1">Cidade</label><input type="text" value={cidadeTermo} onChange={e => setCidadeTermo(e.target.value)} className="w-full border-b border-gray-300 p-2 text-sm outline-none focus:border-[#B68B40]" /></div>
                            <div className="sm:w-1/3"><label className="block text-xs font-bold text-gray-600 uppercase mb-1">Data</label><input type="date" value={dataAssinatura} onChange={e => setDataAssinatura(e.target.value)} className="w-full border-b border-gray-300 p-2 text-sm outline-none focus:border-[#B68B40]" /></div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
                            <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50"><h3 className="text-sm font-bold uppercase tracking-wider text-gray-700 mb-2">Assinatura do(a) Paciente</h3><div className="border-2 border-dashed border-gray-300 bg-white rounded-lg overflow-hidden touch-none h-32 w-full"><canvas ref={canvasClienteRef} width={400} height={128} className="w-full h-full cursor-crosshair" onMouseDown={(e) => startDrawingTermo(e, 'cliente')} onMouseMove={(e) => drawTermo(e, 'cliente')} onMouseUp={() => stopDrawingTermo('cliente')} onMouseOut={() => stopDrawingTermo('cliente')} onTouchStart={(e) => startDrawingTermo(e, 'cliente')} onTouchMove={(e) => drawTermo(e, 'cliente')} onTouchEnd={() => stopDrawingTermo('cliente')} /></div><button onClick={() => limparCanvasTermo('cliente')} className="text-xs text-gray-500 hover:text-red-500 underline mt-2 block ml-auto">Limpar</button></div>
                            <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50"><h3 className="text-sm font-bold uppercase tracking-wider text-[#B68B40] mb-2">Assinatura da Profissional</h3><div className="border-2 border-dashed border-[#B68B40]/50 bg-white rounded-lg overflow-hidden touch-none h-32 w-full"><canvas ref={canvasProfRef} width={400} height={128} className="w-full h-full cursor-crosshair" onMouseDown={(e) => startDrawingTermo(e, 'prof')} onMouseMove={(e) => drawTermo(e, 'prof')} onMouseUp={() => stopDrawingTermo('prof')} onMouseOut={() => stopDrawingTermo('prof')} onTouchStart={(e) => startDrawingTermo(e, 'prof')} onTouchMove={(e) => drawTermo(e, 'prof')} onTouchEnd={() => stopDrawingTermo('prof')} /></div><button onClick={() => limparCanvasTermo('prof')} className="text-xs text-gray-500 hover:text-red-500 underline mt-2 block ml-auto">Limpar</button></div>
                          </div>

                          <div className="border border-emerald-500/30 rounded-xl p-4 md:p-6 bg-emerald-50/20 shadow-sm">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-800 mb-4 flex items-center gap-2">🔒 Assinatura Eletrônica Dupla</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="space-y-4"><label className="flex items-start gap-3 cursor-pointer"><input type="checkbox" checked={termoAceito} onChange={e => setTermoAceito(e.target.checked)} className="mt-1 accent-emerald-600 w-5 h-5 cursor-pointer shrink-0" /><span className="text-sm text-gray-700 leading-relaxed">Eu, Paciente, concordo com os termos.</span></label><div><label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">CPF do Paciente *</label><input type="text" value={cpfAssinatura} onChange={e => setCpfAssinatura(formatarCPF(e.target.value))} maxLength={14} placeholder="000.000.000-00" className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:border-emerald-500 outline-none bg-white shadow-inner" /></div></div>
                              <div className="space-y-4"><label className="flex items-start gap-3 cursor-pointer"><input type="checkbox" checked={profAceito} onChange={e => setProfAceito(e.target.checked)} className="mt-1 accent-emerald-600 w-5 h-5 cursor-pointer shrink-0" /><span className="text-sm text-gray-700 leading-relaxed">Eu, Profissional, atesto a conformidade.</span></label><div><label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Registro/CPF Profissional *</label><input type="text" value={registroProfissional} onChange={e => setRegistroProfissional(e.target.value)} placeholder="CRBM ou CPF" className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:border-emerald-500 outline-none bg-white shadow-inner" /></div></div>
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-end mt-10"><button onClick={salvarDocumentoTermo} className="bg-[#B68B40] text-white px-8 py-3 rounded-lg font-bold text-sm hover:bg-[#9a7330] shadow-sm w-full md:w-auto transition-colors">{termoPreenchidoId ? 'Atualizar Termo' : 'Assinar Termo Oficialmente'}</button></div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {abaAtiva === 'midias' && (
                <div className="p-4 md:p-6 h-full flex flex-col">
                  {fluxoMidia === 'lista' && (
                    <>
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6"><h3 className="text-lg font-medium text-gray-800">Galeria de Mídias</h3><button onClick={() => setFluxoMidia('upload')} className="bg-[#B68B40] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#9a7330]">+ Adicionar Foto</button></div>
                      {historicoMidias.length === 0 ? ( <p className="text-gray-400 text-sm text-center py-12 border-2 border-dashed rounded-xl bg-gray-50">O paciente ainda não possui fotos.</p> ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 overflow-y-auto">
                          {historicoMidias.map(midia => (
                            <div key={midia.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all group relative">
                              <div className={`absolute top-2 left-2 px-3 py-1 rounded-full text-xs font-bold text-white shadow-sm z-10 ${ midia.categoria === 'Antes' ? 'bg-gray-600' : midia.categoria === 'Depois' ? 'bg-[#B68B40]' : 'bg-emerald-600'}`}>{midia.categoria}</div>
                              <div className="h-40 w-full bg-gray-100 relative"><img src={midia.url_arquivo} alt="Evolução" className="w-full h-full object-cover" /><div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><button onClick={() => window.open(midia.url_arquivo, '_blank')} className="text-white text-xs font-medium border border-white px-3 py-1.5 rounded hover:bg-white hover:text-black transition-colors">Ampliar Foto</button></div></div>
                              <div className="p-3"><p className="text-sm font-bold text-gray-800 truncate">{midia.procedimento}</p><p className="text-[11px] text-gray-500 mt-1 truncate">{midia.observacoes || 'Sem observações extras'}</p><div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-100"><span className="text-[10px] text-gray-400 font-medium">Data: {new Date(midia.data_registro).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</span><button onClick={() => deletarMidia(midia.id, midia.url_arquivo)} className="text-red-400 hover:text-red-600 text-xs">Excluir</button></div></div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                  {fluxoMidia === 'upload' && (
                    <div className="max-w-xl mx-auto w-full pb-10">
                      <button onClick={() => setFluxoMidia('lista')} className="text-[#B68B40] text-sm hover:underline mb-6 block">← Voltar para a galeria</button>
                      <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-6 shadow-sm space-y-5">
                        <h2 className="text-xl font-light text-[#B68B40] text-center mb-4">Adicionar Nova Foto</h2>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div><label className="block text-xs font-bold text-gray-600 uppercase mb-1">Etapa (Evolução) *</label><select value={formMidia.categoria} onChange={e => setFormMidia({...formMidia, categoria: e.target.value as any})} className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:border-[#B68B40] outline-none bg-white"><option value="Antes">Antes do Procedimento</option><option value="Durante">Durante o Tratamento</option><option value="Depois">Depois (Resultado Final)</option></select></div>
                          <div><label className="block text-xs font-bold text-gray-600 uppercase mb-1">Data da Foto *</label><input type="date" value={formMidia.data_registro} onChange={e => setFormMidia({...formMidia, data_registro: e.target.value})} className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:border-[#B68B40] outline-none" /></div>
                        </div>
                        
                        <div><label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">Procedimento *</label><input type="text" value={formMidia.procedimento} onChange={e => setFormMidia({...formMidia, procedimento: e.target.value})} placeholder="Ex: Lipo Enzimática de Papada" className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:border-[#B68B40] outline-none" /></div>
                        
                        {/* OPÇÕES DUPLAS PARA A CÂMARA OU GALERIA */}
                        <div>
                          <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Imagem da Evolução *</label>
                          
                          {/* Inputs invisíveis originais */}
                          <input type="file" accept="image/*" capture="environment" id="cameraInput" onChange={handleFileChange} className="hidden" />
                          <input type="file" accept="image/*" id="galleryInput" onChange={handleFileChange} className="hidden" />
                          
                          <div className="flex flex-col sm:flex-row gap-3">
                            <label htmlFor="cameraInput" className="flex-1 flex items-center justify-center gap-2 bg-[#B68B40]/10 text-[#B68B40] hover:bg-[#B68B40]/20 border border-[#B68B40]/30 rounded-lg p-3 cursor-pointer transition-colors text-sm font-bold">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                              Tirar Foto na Hora
                            </label>
                            
                            <label htmlFor="galleryInput" className="flex-1 flex items-center justify-center gap-2 bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200 rounded-lg p-3 cursor-pointer transition-colors text-sm font-medium">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                              Escolher da Galeria
                            </label>
                          </div>

                          {/* Mensagem de sucesso quando a foto for selecionada */}
                          {arquivoMidia && (
                            <div className="mt-3 flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 border border-emerald-100 p-2.5 rounded-lg">
                              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                              <span className="truncate font-medium">Imagem selecionada: {arquivoMidia.name}</span>
                            </div>
                          )}
                        </div>

                        <div><label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">Observações Técnicas</label><textarea value={formMidia.observacoes} onChange={e => setFormMidia({...formMidia, observacoes: e.target.value})} placeholder="Ex: Paciente apresentou leve edema..." className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:border-[#B68B40] outline-none h-20" /></div>
                        
                        <div className="flex justify-end pt-4"><button onClick={salvarNovaMidia} disabled={uploadingMidia} className="bg-[#B68B40] text-white px-8 py-3 rounded-lg font-bold text-sm hover:bg-[#9a7330] shadow-sm disabled:opacity-50 w-full sm:w-auto transition-colors">{uploadingMidia ? 'Enviando...' : 'Salvar Foto na Galeria'}</button></div>
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
}