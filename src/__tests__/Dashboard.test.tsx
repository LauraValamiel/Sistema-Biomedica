import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import Dashboard from '../pages/Dashboard';

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [] })
    })),
  },
})); 

describe('Página Visão Geral (Dashboard)', () => {
  it('deve abrir o modal de agendamento rápido', async () => {
    // BrowserRouter é necessário pois o Dashboard contém um <Link>
    render(<BrowserRouter><Dashboard /></BrowserRouter>);
    const user = userEvent.setup();

    const btnNovoAgendamento = await screen.findByText('+ Novo Agendamento');
    await user.click(btnNovoAgendamento);

    const tituloModal = screen.getByRole('heading', { name: /Novo Agendamento/i });
    expect(tituloModal).toBeTruthy();
  });
});