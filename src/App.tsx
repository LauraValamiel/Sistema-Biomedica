import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { supabase } from './lib/supabase';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Agenda from './pages/Agenda';
import Pacientes from './pages/Pacientes';
import FichasAnamnese from './pages/FichasAnamnese';
import MidiasEvolucao from './pages/MidiasEvolucao';
import DocumentosTermos from './pages/DocumentosTermos';
import Login from './pages/Login';
import Perfil from './pages/Perfil';
import PoliticaPrivacidade from './pages/PoliticaPrivacidade';

// Componente auxiliar para gerir o Layout protegido por autenticação
function AppLayout() {
  const [menuMobileAberto, setMenuMobileAberto] = useState(false);
  const [sessao, setSessao] = useState<any>(null);
  const [aCarregar, setACarregar] = useState(true);
  const location = useLocation();

  useEffect(() => {
    // Verifica a sessão atual ao carregar a aplicação
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSessao(session);
      setACarregar(false);
    });

    // Escuta alterações de autenticação (login, logout, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessao(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (aCarregar) {
    return (
      <div className="min-h-screen bg-[#FDFCFB] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[#B68B40] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Se não estiver logado e tentar aceder a uma página protegida, vai para /login
  if (!sessao && location.pathname !== '/login') {
    return <Navigate to="/login" replace />;
  }

  // Se já estiver logado e estiver na página de login, redireciona para a Visão Geral
  if (sessao && location.pathname === '/login') {
    return <Navigate to="/" replace />;
  }

  // Se for a rota de login, renderiza apenas a tela de login sem a Sidebar
  if (location.pathname === '/login') {
    return <Login />;
  }

  return (
    <div className="flex h-screen bg-[#FDFCFB] overflow-hidden w-full">
      
      {/* OVERLAY MOBILE (Fundo escuro quando o menu abre) */}
      {menuMobileAberto && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setMenuMobileAberto(false)}
        />
      )}

      {/* SIDEBAR RESPONSIVA */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 transform bg-white shadow-2xl transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${menuMobileAberto ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="absolute top-4 right-4 md:hidden">
          <button onClick={() => setMenuMobileAberto(false)} className="text-gray-400 hover:text-red-500 bg-gray-50 rounded-full p-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        
        <Sidebar onCloseMobile={() => setMenuMobileAberto(false)} />
      </div>

      {/* ÁREA PRINCIPAL DO SISTEMA */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden w-full relative">
        
        {/* CABEÇALHO MOBILE (Menu Hamburguer e Logos Maiores Lado a Lado) */}
        <div className="md:hidden bg-white border-b border-[#B68B40]/20 p-3 flex items-center justify-between z-30 shadow-sm shrink-0">
          <button onClick={() => setMenuMobileAberto(true)} className="p-2 text-[#B68B40] hover:bg-[#B68B40]/10 rounded-lg transition-colors focus:outline-none">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>

          {/* LOGOS LADO A LADO COM TAMANHO MAIOR */}
          <div className="flex items-center gap-2.5">
            <img 
              src="/logo%20-%20eb.jpeg" 
              alt="Emblema EB" 
              className="h-12 w-12 rounded-full object-cover border border-[#B68B40]/30 shadow-sm" 
            />
            <img 
              src="/logo%20-%20nome.jpeg" 
              alt="Emily Barcelos" 
              className="h-8 w-auto object-contain" 
            />
          </div>

          <div className="w-9"></div> {/* Espaçador para centrar perfeitamente */}
        </div>

        {/* CONTEÚDO DAS PÁGINAS */}
        <div className="flex-1 overflow-x-hidden overflow-y-auto w-full">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/agenda" element={<Agenda />} />
            <Route path="/pacientes" element={<Pacientes />} />
            <Route path="/fichas-anamnese" element={<FichasAnamnese />} />
            <Route path="/midias-evolucao" element={<MidiasEvolucao />} />
            <Route path="/documentos-termos" element={<DocumentosTermos />} />
            <Route path="/perfil" element={<Perfil />} />
            <Route path="/politica-privacidade" element={<PoliticaPrivacidade />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
        
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  );
}