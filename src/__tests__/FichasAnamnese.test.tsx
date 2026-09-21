import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import FichasAnamnese from '../pages/FichasAnamnese';

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [] }),
      insert: vi.fn()
    })),
  },
}));

describe('Página Fichas de Anamnese', () => {
  it('deve exibir erro se tentar salvar um modelo sem título', async () => {
    render(<FichasAnamnese />);
    const user = userEvent.setup();

    const btnCriarModelo = await screen.findByText('+ Criar Novo Modelo');
    await user.click(btnCriarModelo);

    const btnSalvar = screen.getByText('Salvar Novo Modelo');
    await user.click(btnSalvar); 

    const avisoErro = await screen.findByText(/Dê um título para a ficha/i);
    expect(avisoErro).toBeTruthy();
  });
});