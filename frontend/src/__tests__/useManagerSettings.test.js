import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useManagerSettings } from '../components/managerSettings/useManagerSettings';

vi.mock('../lib/apiClient', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock('../utils/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), log: vi.fn() },
}));

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

import { api } from '../lib/apiClient';
import { toast } from 'sonner';

const mockKpiConfig = { track_ca: true, track_ventes: true, track_articles: false, track_prospects: false };
const mockSellers = [{ id: 's1', name: 'Alice' }, { id: 's2', name: 'Bob' }];
const mockObjectives = [{ id: 'o1', title: 'Objectif test', has_unseen_achievement: false }];
const mockChallenges = [{ id: 'c1', title: 'Challenge test', has_unseen_achievement: false }];

const baseProps = {
  isOpen: false,
  onClose: vi.fn(),
  onUpdate: vi.fn(),
  modalType: 'objectives',
  storeIdParam: null,
};

function setupApiMocks() {
  api.get.mockImplementation((url) => {
    if (url.includes('kpi-config')) return Promise.resolve({ data: mockKpiConfig });
    if (url.includes('objectives')) return Promise.resolve({ data: mockObjectives });
    if (url.includes('challenges')) return Promise.resolve({ data: mockChallenges });
    if (url.includes('sellers')) return Promise.resolve({ data: mockSellers });
    return Promise.resolve({ data: {} });
  });
}

describe('useManagerSettings — chargement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupApiMocks();
  });

  it('charge toutes les données quand isOpen passe à true', async () => {
    const { rerender } = renderHook((props) => useManagerSettings(props), {
      initialProps: baseProps,
    });

    await act(async () => {
      rerender({ ...baseProps, isOpen: true });
    });

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(expect.stringContaining('kpi-config'));
      expect(api.get).toHaveBeenCalledWith(expect.stringContaining('objectives'));
      expect(api.get).toHaveBeenCalledWith(expect.stringContaining('challenges'));
      expect(api.get).toHaveBeenCalledWith(expect.stringContaining('sellers'));
    });
  });

  it('expose objectives, challenges, sellers et kpiConfig chargés', async () => {
    const { result, rerender } = renderHook((props) => useManagerSettings(props), {
      initialProps: baseProps,
    });

    await act(async () => {
      rerender({ ...baseProps, isOpen: true });
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.objectives).toEqual(mockObjectives);
    expect(result.current.challenges).toEqual(mockChallenges);
    expect(result.current.sellers).toEqual(mockSellers);
    expect(result.current.kpiConfig).toEqual(mockKpiConfig);
  });

  it('affiche un toast d\'erreur si le chargement échoue', async () => {
    api.get.mockRejectedValue(new Error('network error'));

    const { rerender } = renderHook((props) => useManagerSettings(props), {
      initialProps: baseProps,
    });

    await act(async () => {
      rerender({ ...baseProps, isOpen: true });
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Erreur de chargement des données');
    });
  });
});

describe('useManagerSettings — création objectif', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupApiMocks();
  });

  it('appelle POST /manager/objectives et reset le formulaire après succès', async () => {
    api.post.mockResolvedValueOnce({ data: { id: 'o-new', title: 'Nouvel objectif' } });
    const onUpdate = vi.fn();

    const { result, rerender } = renderHook((props) => useManagerSettings(props), {
      initialProps: baseProps,
    });

    await act(async () => {
      rerender({ ...baseProps, isOpen: true, onUpdate });
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Remplir le formulaire
    await act(async () => {
      result.current.setNewObjective({
        title: 'Objectif CA Mai',
        description: 'Objectif mensuel',
        type: 'collective',
        visible: true,
        period_start: '2026-05-01',
        period_end: '2026-05-31',
        objective_type: 'kpi_standard',
        kpi_name: 'ca',
        target_value: '10000',
        data_entry_responsible: 'manager',
        unit: '€',
        seller_id: '',
        visible_to_sellers: [],
        product_name: '',
        custom_description: '',
      });
    });

    const fakeEvent = { preventDefault: vi.fn() };
    await act(async () => {
      await result.current.handleCreateObjective(fakeEvent);
    });

    expect(api.post).toHaveBeenCalledWith(
      '/manager/objectives',
      expect.objectContaining({ title: 'Objectif CA Mai', target_value: 10000 })
    );
    expect(toast.success).toHaveBeenCalledWith('Objectif créé avec succès');
    expect(onUpdate).toHaveBeenCalled();
  });

  it('affiche un toast d\'erreur si la création échoue', async () => {
    api.post.mockRejectedValueOnce({
      response: { data: { detail: 'Validation failed' } },
    });

    const { result, rerender } = renderHook((props) => useManagerSettings(props), {
      initialProps: baseProps,
    });

    await act(async () => {
      rerender({ ...baseProps, isOpen: true });
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const fakeEvent = { preventDefault: vi.fn() };
    await act(async () => {
      await result.current.handleCreateObjective(fakeEvent);
    });

    expect(toast.error).toHaveBeenCalledWith('Validation failed');
  });
});

describe('useManagerSettings — création challenge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupApiMocks();
  });

  it('appelle POST /manager/challenges après soumission', async () => {
    api.post.mockResolvedValueOnce({ data: { id: 'c-new' } });

    const { result, rerender } = renderHook((props) => useManagerSettings(props), {
      initialProps: { ...baseProps, modalType: 'challenges' },
    });

    await act(async () => {
      rerender({ ...baseProps, isOpen: true, modalType: 'challenges' });
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      result.current.setNewChallenge({
        title: 'Challenge Ventes Juin',
        description: 'Top vendeur',
        type: 'collective',
        visible: true,
        visible_to_sellers: [],
        start_date: '2026-06-01',
        end_date: '2026-06-30',
        challenge_type: 'kpi_standard',
        kpi_name: 'nb_ventes',
        target_value: '50',
        data_entry_responsible: 'manager',
        unit: '',
        seller_id: '',
        product_name: '',
        custom_description: '',
      });
    });

    const fakeEvent = { preventDefault: vi.fn() };
    await act(async () => {
      await result.current.handleCreateChallenge(fakeEvent);
    });

    expect(api.post).toHaveBeenCalledWith(
      '/manager/challenges',
      expect.objectContaining({ title: 'Challenge Ventes Juin', target_value: 50 })
    );
    expect(toast.success).toHaveBeenCalledWith('Challenge créé avec succès');
  });
});

describe('useManagerSettings — suppression', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupApiMocks();
  });

  it('handleDeleteObjective appelle DELETE /manager/objectives/:id après confirmation', async () => {
    vi.stubGlobal('confirm', vi.fn(() => true));
    api.delete.mockResolvedValueOnce({ data: {} });

    const { result, rerender } = renderHook((props) => useManagerSettings(props), {
      initialProps: baseProps,
    });

    await act(async () => {
      rerender({ ...baseProps, isOpen: true });
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.handleDeleteObjective('o1');
    });

    expect(globalThis.confirm).toHaveBeenCalled();
    expect(api.delete).toHaveBeenCalledWith('/manager/objectives/o1');
    expect(toast.success).toHaveBeenCalledWith('Objectif supprimé avec succès');
  });

  it('handleDeleteObjective n\'appelle pas DELETE si l\'utilisateur annule', async () => {
    vi.stubGlobal('confirm', vi.fn(() => false));

    const { result, rerender } = renderHook((props) => useManagerSettings(props), {
      initialProps: baseProps,
    });

    await act(async () => {
      rerender({ ...baseProps, isOpen: true });
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.handleDeleteObjective('o1');
    });

    expect(api.delete).not.toHaveBeenCalled();
  });
});

describe('useManagerSettings — progression objectif', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupApiMocks();
  });

  it('handleUpdateProgress valide la valeur et envoie POST /progress', async () => {
    api.post.mockResolvedValueOnce({
      data: { id: 'o1', just_achieved: false, has_unseen_achievement: false },
    });

    const { result, rerender } = renderHook((props) => useManagerSettings(props), {
      initialProps: baseProps,
    });

    await act(async () => {
      rerender({ ...baseProps, isOpen: true });
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      result.current.setProgressValue('150');
    });
    await act(async () => {
      await result.current.handleUpdateProgress('o1');
    });

    expect(api.post).toHaveBeenCalledWith(
      '/manager/objectives/o1/progress',
      { current_value: 150, mode: 'add' }
    );
    expect(toast.success).toHaveBeenCalledWith('Progression mise à jour !', expect.any(Object));
  });

  it('affiche un toast d\'erreur si la valeur est vide', async () => {
    const { result, rerender } = renderHook((props) => useManagerSettings(props), {
      initialProps: baseProps,
    });

    await act(async () => {
      rerender({ ...baseProps, isOpen: true });
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.handleUpdateProgress('o1');
    });

    expect(toast.error).toHaveBeenCalledWith('Veuillez entrer une valeur');
    expect(api.post).not.toHaveBeenCalled();
  });
});
