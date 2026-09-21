import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import Agenda from '../pages/Agenda';

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [] }),
      insert: vi.fn().mockResolvedValue({ error: null }),
    })),
  },
}));

describe('Página de Agenda', () => {
  it('deve exigir o preenchimento dos dados antes de agendar', async () => {
    render(<Agenda />);
    const user = userEvent.setup();

    // 1. Abre o modal
    const btnNovoAgendamento = await screen.findByText('+ Agendar Consulta');
    await user.click(btnNovoAgendamento);

    // 2. Tenta confirmar com os campos incompletos
    const btnConfirmar = screen.getByText('Confirmar Agendamento');
    await user.click(btnConfirmar);

    // 3. Verifica se a notificação (Toast) de campos obrigatórios aparece
    const avisoErro = await screen.findByText(/Preencha o Paciente, Data e Hora para agendar/i);
    expect(avisoErro).toBeTruthy();
  });
});