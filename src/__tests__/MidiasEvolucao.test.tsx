import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import MidiasEvolucao from '../pages/MidiasEvolucao';

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [] })
    })),
  },
}));

describe('Página Mídias e Evolução', () => {
  it('deve disparar um alerta se tentar enviar sem foto', async () => {
    render(<MidiasEvolucao />);
    const user = userEvent.setup();

    // Espiona a função alert nativa do navegador
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});

    const btnAdicionar = await screen.findByText('+ Adicionar Foto');
    await user.click(btnAdicionar);

    const btnUpload = screen.getByText('Fazer Upload');
    await user.click(btnUpload);

    // Verifica se o alert foi chamado com a frase exata do seu código
    expect(alertMock).toHaveBeenCalledWith('Selecione uma foto para enviar.');
    alertMock.mockRestore();
  });
});