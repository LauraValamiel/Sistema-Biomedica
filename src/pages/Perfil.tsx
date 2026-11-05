import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const SENHA_MINIMA = 6; // O padrão mínimo do Supabase costuma ser 6 caracteres

const somenteNumeros = (v: string) => v.replace(/\D/g, '').slice(0, 11);
const formatarTelefone = (v: string) =>
  somenteNumeros(v)
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2');

export default function Perfil() {
  const [emailAtual, setEmailAtual] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [telefoneAtual, setTelefoneAtual] = useState('');
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  
  const [mostrarSenhaAtual, setMostrarSenhaAtual] = useState(false);
  const [mostrarNovaSenha, setMostrarNovaSenha] = useState(false);
  const [mostrarConfirmarSenha, setMostrarConfirmarSenha] = useState(false);

  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState<{ texto: string; tipo: 'sucesso' | 'erro' } | null>(null);

  useEffect(() => {
    carregarDadosUsuario();
  }, []);

  const carregarDadosUsuario = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setEmail(user.email || '');
      setEmailAtual(user.email || '');
      const { data } = await supabase.from('perfis_usuario').select('telefone').eq('id', user.id).single();
      if (data) {
        const telFormatado = formatarTelefone(data.telefone || '');
        setTelefone(telFormatado);
        setTelefoneAtual(telFormatado);
      }
    }
  };

  const mudouEmail = email.trim().toLowerCase() !== emailAtual.toLowerCase();
  const mudouSenha = novaSenha.length > 0;
  const mudouTelefone = somenteNumeros(telefone) !== somenteNumeros(telefoneAtual);
  const vaiAlterarCredenciais = mudouEmail || mudouSenha;

  const atualizarDados = async (e: React.FormEvent) => {
    e.preventDefault();
    setCarregando(true);
    setMensagem(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !user.email) throw new Error('Sessão expirada. Entre novamente no sistema.');

      const novoEmail = email.trim().toLowerCase();
      const telefoneLimpo = somenteNumeros(telefone);

      if (telefoneLimpo && telefoneLimpo.length < 10) throw new Error('Telefone incompleto. Informe DDD e número.');

      if (mudouSenha) {
        if (novaSenha.length < SENHA_MINIMA) throw new Error(`A nova senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`);
        if (novaSenha !== confirmarSenha) throw new Error('A confirmação não corresponde à nova senha.');
      }

      let emailConfirmadoAgora = !mudouEmail;

      // SÓ executa o signInWithPassword e updateUser se realmente houver alteração de e-mail ou senha
      if (vaiAlterarCredenciais) {
        if (!senhaAtual) throw new Error('Informe a sua senha atual para alterar e-mail ou senha.');
        
        // Reautentica para confirmar identidade
        const { error: reauthError } = await supabase.auth.signInWithPassword({ email: user.email, password: senhaAtual });
        if (reauthError) throw new Error('Senha atual incorreta.');

        // ATUALIZAÇÃO DE SENHA E EMAIL SEPARADAS PARA EVITAR CONFLITOS NA API DO SUPABASE
        if (mudouSenha) {
            const { error: passwordError } = await supabase.auth.updateUser({ password: novaSenha });
            if (passwordError) {
                console.error("Erro ao atualizar senha:", passwordError);
                throw new Error(passwordError.message === "New password should be different from the old password." 
                    ? "A nova senha deve ser diferente da antiga." 
                    : `Erro na nova senha: ${passwordError.message}`);
            }
        }

        if (mudouEmail) {
            const { data: authData, error: emailError } = await supabase.auth.updateUser({ email: novoEmail });
            if (emailError) {
                console.error("Erro ao atualizar e-mail:", emailError);
                throw new Error(`Não foi possível alterar o e-mail: ${emailError.message}`);
            }
            emailConfirmadoAgora = authData.user?.email?.toLowerCase() === novoEmail;
        }
      }

      // Atualiza o perfil na tabela perfis_usuario se houver mudança de telefone ou e-mail confirmado
      if (mudouTelefone || (mudouEmail && emailConfirmadoAgora)) {
        const atualizacaoPerfil: { id: string; telefone: string | null; email?: string } = { 
          id: user.id, 
          telefone: telefoneLimpo || null 
        };
        if (mudouEmail && emailConfirmadoAgora) atualizacaoPerfil.email = novoEmail;

        const { error: perfilError } = await supabase
          .from('perfis_usuario')
          .upsert(atualizacaoPerfil, { onConflict: 'id' });

        if (perfilError) throw new Error('Não foi possível atualizar o número de telefone.');
      }

      if (mudouEmail && !emailConfirmadoAgora) {
        setMensagem({ texto: 'Senha e telefone atualizados! Enviámos um link de confirmação para o novo e-mail: a troca só passa a valer depois de confirmada lá.', tipo: 'sucesso' });
        setEmail(user.email);
      } else {
        setMensagem({ texto: 'Dados atualizados com sucesso!', tipo: 'sucesso' });
        setEmailAtual(novoEmail);
        setTelefoneAtual(telefone);
      }
      setSenhaAtual('');
      setNovaSenha('');
      setConfirmarSenha('');
    } catch (err: any) {
      setMensagem({ texto: err?.message || 'Erro ao atualizar dados.', tipo: 'erro' });
    } finally {
      setCarregando(false);
    }
  };

  const classeInput = 'w-full border border-gray-300 rounded-lg p-3 pr-10 text-sm focus:border-[#B68B40] outline-none bg-white';
  const classeLabel = 'block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2';

  return (
    <div className="p-4 md:p-8 w-full max-w-4xl mx-auto flex flex-col h-full overflow-y-auto">
      <header className="mb-6 md:mb-8 shrink-0">
        <h1 className="text-2xl md:text-3xl font-light text-gray-800">Meu Perfil e Dados</h1>
        <p className="text-sm md:text-base text-gray-500 mt-1">Atualize as suas credenciais de acesso ao sistema</p>
      </header>

      <div className="bg-white rounded-xl border border-[#B68B40]/30 shadow-sm p-6 md:p-8">
        {mensagem && (
          <div role="alert" className={`p-4 rounded-lg mb-6 text-sm font-medium border ${
            mensagem.tipo === 'sucesso' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-600'
          }`}>
            {mensagem.texto}
          </div>
        )}

        <form onSubmit={atualizarDados} className="space-y-6 max-w-xl">
          <div>
            <label htmlFor="email" className={classeLabel}>E-mail de Acesso</label>
            <input 
              id="email"
              type="email" 
              required
              autoComplete="email"
              value={email} 
              onChange={e => setEmail(e.target.value)}
              className={classeInput.replace('pr-10', '')}
            />
          </div>

          <div>
            <label htmlFor="telefone" className={classeLabel}>Telefone (Login Alternativo)</label>
            <input 
              id="telefone"
              type="tel" 
              inputMode="numeric"
              autoComplete="tel"
              value={telefone} 
              onChange={e => setTelefone(formatarTelefone(e.target.value))}
              placeholder="(31) 90000-0000"
              className={classeInput.replace('pr-10', '')}
            />
          </div>

          <div className="pt-2 border-t border-gray-100 space-y-6">
            <div>
              <label htmlFor="nova-senha" className={classeLabel}>Nova Senha (Deixe em branco para manter a atual)</label>
              <div className="relative">
                <input 
                  id="nova-senha"
                  type={mostrarNovaSenha ? "text" : "password"} 
                  autoComplete="new-password"
                  value={novaSenha} 
                  onChange={e => setNovaSenha(e.target.value)}
                  placeholder={`Mínimo de ${SENHA_MINIMA} caracteres`}
                  className={classeInput}
                />
                <button
                  type="button"
                  onClick={() => setMostrarNovaSenha(!mostrarNovaSenha)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                  title={mostrarNovaSenha ? "Ocultar senha" : "Ver senha"}
                >
                  {mostrarNovaSenha ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  )}
                </button>
              </div>
            </div>

            {novaSenha && (
              <div>
                <label htmlFor="confirmar-senha" className={classeLabel}>Confirmar Nova Senha</label>
                <div className="relative">
                  <input 
                    id="confirmar-senha"
                    type={mostrarConfirmarSenha ? "text" : "password"} 
                    autoComplete="new-password"
                    value={confirmarSenha} 
                    onChange={e => setConfirmarSenha(e.target.value)}
                    placeholder="••••••••"
                    className={classeInput}
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarConfirmarSenha(!mostrarConfirmarSenha)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                    title={mostrarConfirmarSenha ? "Ocultar senha" : "Ver senha"}
                  >
                    {mostrarConfirmarSenha ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    )}
                  </button>
                </div>
              </div>
            )}

            {vaiAlterarCredenciais && (
              <div className="bg-[#B68B40]/5 border border-[#B68B40]/20 rounded-lg p-4">
                <label htmlFor="senha-atual" className={classeLabel}>Senha Atual *</label>
                <div className="relative">
                  <input 
                    id="senha-atual"
                    type={mostrarSenhaAtual ? "text" : "password"} 
                    autoComplete="current-password"
                    value={senhaAtual} 
                    onChange={e => setSenhaAtual(e.target.value)}
                    placeholder="Confirme a sua senha atual"
                    className={classeInput}
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarSenhaAtual(!mostrarSenhaAtual)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                    title={mostrarSenhaAtual ? "Ocultar senha" : "Ver senha"}
                  >
                    {mostrarSenhaAtual ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">Por segurança, a troca de e-mail ou senha exige a senha atual.</p>
              </div>
            )}
          </div>

          <div className="pt-4">
            <button 
              type="submit" 
              disabled={carregando}
              className="bg-[#B68B40] text-white px-8 py-3 rounded-lg font-bold text-sm hover:bg-[#9a7330] shadow-sm transition-colors disabled:opacity-50"
            >
              {carregando ? 'A guardar...' : 'Guardar Alterações'}
            </button>
          </div>
        </form>
      </div>

      <div className="mt-8 bg-white rounded-xl border border-gray-200 shadow-sm p-6 md:p-8 mb-10">
        <h2 className="text-xl font-medium text-gray-800 mb-2">Privacidade e Direitos (LGPD)</h2>
        <p className="text-sm text-gray-500 mb-6 leading-relaxed">
          Conforme estabelecido pela Lei Geral de Proteção de Dados, você tem o direito de acessar os seus dados registrados neste sistema ou solicitar a sua eliminação (respeitando os prazos legais de guarda de prontuários médicos).
        </p>

        <div className="flex flex-col sm:flex-row gap-4">
          <button 
            onClick={async () => {
              const { data: { user } } = await supabase.auth.getUser();
              const dadosExportacao = {
                id_conta: user?.id,
                email: user?.email,
                telefone: telefone,
                data_solicitacao: new Date().toISOString()
              };
              const blob = new Blob([JSON.stringify(dadosExportacao, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'meus_dados_lgpd.json';
              a.click();
              setMensagem({ texto: 'Download dos seus dados iniciado.', tipo: 'sucesso' });
            }}
            className="flex items-center justify-center gap-2 bg-gray-50 text-gray-700 border border-gray-300 px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
          >
            <svg className="w-4 h-4 text-[#B68B40]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Exportar Meus Dados
          </button>

          <button 
            onClick={async () => {
              if (window.confirm('Tem a certeza que deseja solicitar a exclusão da sua conta? Isso inativará seu acesso. A exclusão definitiva pode aguardar o tempo legal de retenção de prontuários.')) {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                  await supabase.from('perfis_usuario').update({ deleted_at: new Date().toISOString() }).eq('id', user.id);
                  await supabase.auth.signOut();
                  window.location.reload();
                }
              }
            }}
            className="flex items-center justify-center gap-2 bg-red-50 text-red-600 border border-red-200 px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors"
          >
            <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            Solicitar Exclusão da Conta
          </button>
        </div>
      </div>

    </div>
  );
}