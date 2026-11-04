import React from 'react';
import { Link } from 'react-router-dom';

export default function PoliticaPrivacidade() {
  return (
    <div className="w-full h-full p-4 md:p-8 max-w-4xl mx-auto overflow-y-auto">
      <div className="mb-6 flex justify-between items-center border-b border-gray-200 pb-4">
        <h1 className="text-2xl md:text-3xl font-light text-gray-800">
          Política de Privacidade e Proteção de Dados
        </h1>
        <Link 
          to="/" 
          className="text-xs md:text-sm font-medium text-[#B68B40] hover:underline"
        >
          &larr; Voltar ao Painel
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 md:p-10 space-y-8 text-gray-700 text-sm leading-relaxed">
        
        <section className="border-b border-gray-100 pb-6">
          <h2 className="text-base font-bold text-[#B68B40] uppercase tracking-wider mb-2">
            1. Dados Pessoais Coletados
          </h2>
          <p className="mb-3">Coletamos as seguintes categorias de dados para viabilizar o atendimento:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Dados Cadastrais:</strong> Nome completo, CPF, data de nascimento, telefone (WhatsApp), e-mail e endereço.</li>
            <li><strong>Dados Pessoais Sensíveis (Saúde e Biometria):</strong> Histórico de saúde, alergias, medicações, avaliação clínica, fichas de anamnese e fotos de evolução estética.</li>
          </ul>
        </section>

        <section className="border-b border-gray-100 pb-6">
          <h2 className="text-base font-bold text-[#B68B40] uppercase tracking-wider mb-2">
            2. Finalidade e Bases Legais
          </h2>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>Atendimento Clínico (Tutela da Saúde - Art. 11, II, "f"):</strong> Planejamento e execução de procedimentos estéticos com segurança.</li>
            <li><strong>Fotos de Evolução (Consentimento):</strong> Fotografias são de uso estritamente clínico. O uso para marketing exige permissão separada.</li>
            <li><strong>Agendamento (Execução de Contrato):</strong> Envio de lembretes e confirmações de consultas.</li>
            <li><strong>Obrigação Legal:</strong> Cumprimento das normas vigentes de vigilância sanitária e conselhos de classe.</li>
          </ul>
        </section>

        <section className="border-b border-gray-100 pb-6">
          <h2 className="text-base font-bold text-[#B68B40] uppercase tracking-wider mb-2">
            3. Segurança e Armazenamento
          </h2>
          <p>
            Seus dados são armazenados em nuvem segura com encriptação em trânsito e em repouso. As fotografias de evolução possuem acesso restrito por links temporários assinados digitalmente. As assinaturas dos documentos utilizam autenticação e validação por hash criptográfico (SHA-256).
          </p>
        </section>

        <section className="border-b border-gray-100 pb-6">
          <h2 className="text-base font-bold text-[#B68B40] uppercase tracking-wider mb-2">
            4. Retenção de Prontuários (Prazo Legal)
          </h2>
          <p>
            Conforme a <strong>Lei nº 13.787/2018 (Lei do Prontuário Eletrônico)</strong>, os dados clínicos, anamneses e fotos de evolução são armazenados pelo prazo mínimo obrigatório de <strong>20 (vinte) anos</strong> a partir do último atendimento.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-[#B68B40] uppercase tracking-wider mb-2">
            5. Direitos do Titular
          </h2>
          <p className="mb-3">Conforme o Art. 18 da LGPD, o paciente pode:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Consultar e exportar os seus dados registrados no sistema;</li>
            <li>Solicitar correção de informações desatualizadas ou incorretas;</li>
            <li>Revogar autorizações de uso de imagem para divulgação a qualquer momento.</li>
          </ul>
        </section>

      </div>
    </div>
  );
}