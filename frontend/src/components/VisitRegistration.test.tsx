import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { VisitRegistration } from './VisitRegistration';

describe('VisitRegistration', () => {
  it('notifies the dashboard after the API accepts today’s visit close', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 201 })));
    const onRegistered = vi.fn();
    render(<VisitRegistration enabled onRegistered={onRegistered} />);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar registro' }));
    await waitFor(() => expect(onRegistered).toHaveBeenCalledTimes(1));
    expect(screen.getByText('Registro recibido. Estamos preparando la predicción de mañana.')).toBeTruthy();
  });
});
