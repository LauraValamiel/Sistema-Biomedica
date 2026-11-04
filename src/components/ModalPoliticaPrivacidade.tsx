import React from 'react';

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export default function ModalPoliticaPrivacidade({ isOpen, onClose }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[99999] p-4" onClick={onClose}>
      <div 
        className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden mx-auto" 
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 md:p-5 border-b border-gray-100 flex justify-between items-center bg-[#FDFCFB] shrink-0">
          <h2 className="text-lg md:text-xl font-medium text-[#B68B40]">
            Política de Privacidade e Proteção de Dados (LGPD)
          </h2>
          <button onClick={onClose} className="text-gray-400 text-2xl hover:text-gray-700 transition-colors">
            &times;
          </button>
        </div>
        
        <div className="p-4 md:p-8 overflow-y-auto text-sm text-gray-700 space-y-6 leading-relaxed bg-white">
          <section>
            <h3 className="text-xs font-bold text-[#B68B40] uppercase tracking-wider mb-2">1. Dados Pessoais Coletados</h3>
            <p className="mb-2">Coletamos as seguintes categorias de dados para viabilizar o atendimento:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Dados Cadastrais:</strong> Nome completo, CPF, nascimento, telefone, e-mail e endereço.</li>
              <li><strong>Dados Sensíveis (Saúde e Biometria):</strong> Histórico de saúde, alergias, medicações, avaliação clínica, fichas de anamnese e fotos de evolução estética.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-xs font-bold text-[#B68B40] uppercase tracking-wider mb-2">2. Finalidade e Bases Legais</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Atendimento Clínico (Art. 11, II, "f"):</strong> Planejamento e execução dos procedimentos.</li>
              <li><strong>Fotos de Evolução (Consentimento):</strong> Uso estritamente clínico. O uso para marketing exige permissão separada.</li>
              <li><strong>Agendamento:</strong> Envio de lembretes e confirmações de consultas.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-xs font-bold text-[#B68B40] uppercase tracking-wider mb-2">3. Segurança e Armazenamento</h3>
            <p>Seus dados são armazenados em nuvem segura com encriptação. As fotografias possuem acesso restrito. As assinaturas utilizam validação por hash criptográfico (SHA-256).</p>
          </section>

          <section>
            <h3 className="text-xs font-bold text-[#B68B40] uppercase tracking-wider mb-2">4. Retenção de Prontuários (Prazo Legal)</h3>
            <p>Conforme a Lei nº 13.787/2018, os dados clínicos, anamneses e fotos de evolução são armazenados pelo prazo mínimo de <strong>20 (vinte) anos</strong> a partir do último atendimento.</p>
          </section>

          <section>
            <h3 className="text-xs font-bold text-[#B68B40] uppercase tracking-wider mb-2">5. Direitos do Titular</h3>
            <p>Você pode consultar e exportar seus dados, solicitar correções e revogar autorizações de uso de imagem para divulgação a qualquer momento.</p>
          </section>
        </div>

        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end shrink-0">
          <button onClick={onClose} className="bg-[#B68B40] text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-[#9a7330] shadow-sm transition-colors">
            Entendi e Fechar
          </button>
        </div>
      </div>
    </div>
  );
}