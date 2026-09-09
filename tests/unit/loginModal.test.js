import { describe, it, expect, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useLoginModalStore } from '@/store/loginModal';

describe('useLoginModalStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('empieza cerrado', () => {
    const store = useLoginModalStore();
    expect(store.abierto).toBe(false);
  });

  it('abrir() pone abierto en true', () => {
    const store = useLoginModalStore();
    store.abrir();
    expect(store.abierto).toBe(true);
  });

  it('cerrar() pone abierto en false', () => {
    const store = useLoginModalStore();
    store.abrir();
    store.cerrar();
    expect(store.abierto).toBe(false);
  });
});
