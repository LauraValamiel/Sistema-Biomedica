import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

// Mensagem única para qualquer falha: não revela se o e-mail/telefone existe (evita enumeração de contas)
const ERRO_CREDENCIAIS = 'Credenciais inválidas. Verifique os dados e tente novamente.';

export default function Login() {
  const navigate = useNavigate();
  const [identificador, setIdentificador] = useState('');
  const [senha, setSenha] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setCarregando(true);
    setErro(null);

    let emailParaLogin = identificador.trim().toLowerCase();

    try {
      // Sem '@': trata como telefone. A função email_para_login (security definer) devolve só o
      // e-mail daquele número exato, sem expor a tabela perfis_usuario a quem não está logado.
      if (!emailParaLogin.includes('@')) {
        const telefoneLimpo = emailParaLogin.replace(/\D/g, '');
        if (telefoneLimpo.length < 10) throw new Error(ERRO_CREDENCIAIS);

        const { data: emailEncontrado, error: rpcError } = await supabase.rpc('email_para_login', {
          p_telefone: telefoneLimpo,
        });

        if (rpcError || !emailEncontrado) throw new Error(ERRO_CREDENCIAIS);
        emailParaLogin = emailEncontrado as string;
      }

      const { error: authError } = await supabase.auth.signInWithPassword({
        email: emailParaLogin,
        password: senha,
      });

      if (authError) {
        // O Supabase limita tentativas seguidas; informa sem expor detalhes internos
        if (authError.status === 429) throw new Error('Muitas tentativas. Aguarde alguns minutos e tente novamente.');
        throw new Error(ERRO_CREDENCIAIS);
      }

      setSenha('');
      navigate('/');
    } catch (err: any) {
      setErro(err?.message || ERRO_CREDENCIAIS);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFCFB] flex items-center justify-center p-4">
      <div className="bg-white border border-[#B68B40]/30 rounded-2xl shadow-xl w-full max-w-md p-8 flex flex-col items-center">
        
        {/* LOGO AUMENTADA (h-36) */}
        <img src="/logo.jpeg" alt="Emily Barcelos" className="h-36 object-contain mb-6" />
        
        <h1 className="text-2xl font-light text-gray-800 mb-1">Área Restrita</h1>
        <p className="text-xs text-gray-400 mb-8">Gestão Clínica Profissional</p>

        {erro && (
          <div role="alert" className="w-full bg-red-50 border border-red-200 text-red-600 text-xs p-3 rounded-lg mb-4 text-center font-medium">
            {erro}
          </div>
        )}

        <form onSubmit={handleLogin} className="w-full space-y-4">
          <div>
            <label htmlFor="identificador" className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">E-mail ou Telefone</label>
            <input 
              id="identificador"
              type="text" 
              required
              autoComplete="username"
              value={identificador} 
              onChange={e => setIdentificador(e.target.value)}
              placeholder="exemplo@email.com ou (31) 90000-0000" 
              className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:border-[#B68B40] outline-none bg-white"
            />
          </div>

          <div>
            <label htmlFor="senha" className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">Senha</label>
            <input 
              id="senha"
              type="password" 
              required
              autoComplete="current-password"
              value={senha} 
              onChange={e => setSenha(e.target.value)}
              placeholder="••••••••" 
              className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:border-[#B68B40] outline-none bg-white"
            />
          </div>

          <button 
            type="submit" 
            disabled={carregando}
            className="w-full bg-[#B68B40] text-white py-3 rounded-lg font-bold text-sm hover:bg-[#9a7330] shadow-sm transition-colors mt-2 disabled:opacity-50"
          >
            {carregando ? 'Entrando...' : 'Entrar no Sistema'}
          </button>
        </form>
      </div>
    </div>
  );
}
