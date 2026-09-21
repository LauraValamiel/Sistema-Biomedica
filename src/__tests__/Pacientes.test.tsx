import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import Pacientes from '../pages/Pacientes';

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [] }),
    })),
  },
}));

describe('Página de Pacientes', () => {
  it('deve exigir o Nome Completo antes de salvar um novo paciente', async () => {
    render(<Pacientes />);
    const user = userEvent.setup();

    // 1. Abre o modal de Novo Paciente
    const btnNovoPaciente = await screen.findByText('+ Novo Paciente');
    await user.click(btnNovoPaciente);

    // 2. Tenta guardar sem preencher absolutamente nada
    const btnGuardar = screen.getByText('Guardar Dados');
    await user.click(btnGuardar);

    // 3. Verifica se o aviso (Toast) de obrigatoriedade apareceu
    const avisoErro = await screen.findByText(/O Nome do paciente é obrigatório/i);
    expect(avisoErro).toBeTruthy();
  });
});