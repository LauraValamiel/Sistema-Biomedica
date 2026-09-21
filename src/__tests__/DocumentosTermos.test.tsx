import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import DocumentosTermos from '../pages/DocumentosTermos';

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [] })
    })),
  },
}));

describe('Página Documentos e Termos', () => {
  it('deve exigir um título antes de salvar o documento', async () => {
    render(<DocumentosTermos />);
    const user = userEvent.setup();

    const btnCriarTermo = await screen.findByText('+ Criar Novo Termo');
    await user.click(btnCriarTermo);

    const btnSalvar = screen.getByText('Salvar Novo Documento');
    await user.click(btnSalvar);

    const avisoErro = await screen.findByText(/Dê um título para o documento/i);
    expect(avisoErro).toBeTruthy();
  });
});