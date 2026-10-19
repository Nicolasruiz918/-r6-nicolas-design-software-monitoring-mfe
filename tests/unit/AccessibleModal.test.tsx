import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { CatalogModal } from '../../src/adapter/in/components/AccessibleModal.js';

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Abrir</button>
      {open ? (
        <CatalogModal title="Prueba" onClose={() => setOpen(false)}>
          <input aria-label="Primero" />
          <button type="button">Último</button>
        </CatalogModal>
      ) : null}
    </>
  );
}

function openModal() {
  render(<Harness />);
  const opener = screen.getByRole('button', { name: 'Abrir' });
  opener.focus();
  fireEvent.click(opener);
  return opener;
}

describe('modal accesible', () => {
  afterEach(() => cleanup());

  it('mueve el foco inicial dentro del dialogo', () => {
    openModal();
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText('Primero'));
  });

  it('atrapa el foco: Tab desde el ultimo va al primero y Shift+Tab desde el primero va al ultimo', () => {
    openModal();
    const close = screen.getByRole('button', { name: 'Cerrar' });
    const last = screen.getByRole('button', { name: 'Último' });

    last.focus();
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(document.activeElement).toBe(close);

    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it('Escape cierra el dialogo y devuelve el foco al elemento que lo abrio', () => {
    const opener = openModal();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });
});