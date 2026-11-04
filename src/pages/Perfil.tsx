import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const SENHA_MINIMA = 8;

// Guarda o telefone só com números (é assim que o login por telefone compara) e exibe formatado
const somenteNumeros = (v: string) => v.replace(/\D/g, '').slice(0, 11);
const formatarTelefone = (v: string) =>
  somenteNumeros(v)
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2');

export default function Perfil() {
  const [emailAtual, setEmailAtual] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
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
      // A policy "Ler o próprio perfil" só permite ler a linha do próprio usuário
      const { data } = await supabase.from('perfis_usuario').select('telefone').eq('id', user.id).single();
      if (data) setTelefone(formatarTelefone(data.telefone || ''));
    }
  };

  const vaiAlterarCredenciais = email.trim().toLowerCase() !== emailAtual.toLowerCase() || novaSenha.length > 0;

  const atualizarDados = async (e: React.FormEvent) => {
    e.preventDefault();
    setCarregando(true);
    setMensagem(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !user.email) throw new Error('Sessão expirada. Entre novamente no sistema.');

      const novoEmail = email.trim().toLowerCase();
      const telefoneLimpo = somenteNumeros(telefone);
      const mudouEmail = novoEmail !== user.email.toLowerCase();
      const mudouSenha = novaSenha.length > 0;

      if (telefoneLimpo && telefoneLimpo.length < 10) throw new Error('Telefone incompleto. Informe DDD e número.');

      if (mudouSenha) {
        if (novaSenha.length < SENHA_MINIMA) throw new Error(`A nova senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`);
        if (novaSenha !== confirmarSenha) throw new Error('A confirmação não corresponde à nova senha.');
      }

      let emailConfirmadoAgora = !mudouEmail;

      if (mudouEmail || mudouSenha) {
        // Confirma a senha atual antes de trocar e-mail ou senha: impede que alguém
        // com acesso a uma sessão aberta (ex.: tablet da clínica) tome a conta
        if (!senhaAtual) throw new Error('Informe a sua senha atual para alterar e-mail ou senha.');
        const { error: reauthError } = await supabase.auth.signInWithPassword({ email: user.email, password: senhaAtual });
        if (reauthError) throw new Error('Senha atual incorreta.');

        const atualizacoesAuth: { email?: string; password?: string } = {};
        if (mudouEmail) atualizacoesAuth.email = novoEmail;
        if (mudouSenha) atualizacoesAuth.password = novaSenha;

        const { data: authData, error: authError } = await supabase.auth.updateUser(atualizacoesAuth);
        if (authError) throw new Error('Não foi possível atualizar as credenciais. Tente novamente.');

        // Se o Supabase exigir confirmação por e-mail, a troca só vale depois de confirmada
        emailConfirmadoAgora = !mudouEmail || authData.user?.email?.toLowerCase() === novoEmail;
      }

      // 2. Atualiza o perfil (só UPDATE da própria linha; criar perfis pelo app não é permitido)
      const atualizacaoPerfil: { telefone: string | null; email?: string } = { telefone: telefoneLimpo || null };
      if (mudouEmail && emailConfirmadoAgora) atualizacaoPerfil.email = novoEmail;

      const { error: perfilError } = await supabase
        .from('perfis_usuario')
        .update(atualizacaoPerfil)
        .eq('id', user.id);

      if (perfilError) throw new Error('Não foi possível atualizar o telefone. Tente novamente.');

      if (mudouEmail && !emailConfirmadoAgora) {
        setMensagem({ texto: 'Dados guardados. Enviámos um link de confirmação para o novo e-mail: a troca só passa a valer depois de confirmada.', tipo: 'sucesso' });
        setEmail(user.email);
      } else {
        setMensagem({ texto: 'Dados atualizados com sucesso!', tipo: 'sucesso' });
        setEmailAtual(novoEmail);
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

  const classeInput = 'w-full border border-gray-300 rounded-lg p-3 text-sm focus:border-[#B68B40] outline-none bg-white';
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
              className={classeInput}
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
              className={classeInput}
            />
          </div>

          <div className="pt-2 border-t border-gray-100 space-y-6">
            <div>
              <label htmlFor="nova-senha" className={classeLabel}>Nova Senha (Deixe em branco para manter a atual)</label>
              <input 
                id="nova-senha"
                type="password" 
                autoComplete="new-password"
                value={novaSenha} 
                onChange={e => setNovaSenha(e.target.value)}
                placeholder={`Mínimo de ${SENHA_MINIMA} caracteres`}
                className={classeInput}
              />
            </div>

            {novaSenha && (
              <div>
                <label htmlFor="confirmar-senha" className={classeLabel}>Confirmar Nova Senha</label>
                <input 
                  id="confirmar-senha"
                  type="password" 
                  autoComplete="new-password"
                  value={confirmarSenha} 
                  onChange={e => setConfirmarSenha(e.target.value)}
                  placeholder="••••••••"
                  className={classeInput}
                />
              </div>
            )}

            {vaiAlterarCredenciais && (
              <div className="bg-[#B68B40]/5 border border-[#B68B40]/20 rounded-lg p-4">
                <label htmlFor="senha-atual" className={classeLabel}>Senha Atual *</label>
                <input 
                  id="senha-atual"
                  type="password" 
                  autoComplete="current-password"
                  value={senhaAtual} 
                  onChange={e => setSenhaAtual(e.target.value)}
                  placeholder="Confirme a sua senha atual"
                  className={classeInput}
                />
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
    </div>
  );
}
