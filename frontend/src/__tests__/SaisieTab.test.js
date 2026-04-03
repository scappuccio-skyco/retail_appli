import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import SaisieTab from '../components/performanceModal/SaisieTab';

// Mock logger
vi.mock('../../utils/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn() },
}));

const defaultKpiConfig = {
  track_ca: true,
  track_ventes: true,
  track_articles: true,
  track_prospects: true,
};

const renderSaisieTab = (props = {}) => {
  const defaults = {
    editingEntry: null,
    savingKPI: false,
    saveMessage: null,
    kpiConfig: defaultKpiConfig,
    isReadOnly: false,
    handleDirectSaveKPI: vi.fn(),
    setEditingEntry: vi.fn(),
    setActiveTab: vi.fn(),
  };
  return render(<SaisieTab {...defaults} {...props} />);
};

describe('SaisieTab — affichage', () => {
  it('affiche le titre "Saisir mes chiffres du jour" en mode création', () => {
    renderSaisieTab();
    expect(screen.getByText('Saisir mes chiffres du jour')).toBeInTheDocument();
  });

  it('affiche le titre "Modifier mes chiffres" en mode édition', () => {
    renderSaisieTab({
      editingEntry: { date: '2026-04-01', ca_journalier: 1000, nb_ventes: 10, nb_articles: 15, nb_prospects: 5 },
    });
    expect(screen.getByText('Modifier mes chiffres')).toBeInTheDocument();
  });

  it('affiche tous les champs KPI si tous les track_* sont true', () => {
    renderSaisieTab();
    expect(screen.getByPlaceholderText('Ex: 1250.50')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Ex: 15')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Ex: 20')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Ex: 30')).toBeInTheDocument();
  });

  it('masque le champ CA si track_ca = false', () => {
    renderSaisieTab({ kpiConfig: { ...defaultKpiConfig, track_ca: false } });
    expect(screen.queryByPlaceholderText('Ex: 1250.50')).not.toBeInTheDocument();
  });

  it('affiche un message de succès quand saveMessage.type = success', () => {
    renderSaisieTab({ saveMessage: { type: 'success', text: 'Données enregistrées !' } });
    expect(screen.getByText('Données enregistrées !')).toBeInTheDocument();
  });

  it('affiche un message d\'erreur quand saveMessage.type = error', () => {
    renderSaisieTab({ saveMessage: { type: 'error', text: 'Erreur lors de la sauvegarde' } });
    expect(screen.getByText('Erreur lors de la sauvegarde')).toBeInTheDocument();
  });

  it('désactive le bouton submit quand savingKPI = true', () => {
    renderSaisieTab({ savingKPI: true });
    const submitBtn = screen.getByRole('button', { name: /Enregistrement/i });
    expect(submitBtn).toBeDisabled();
  });
});

describe('SaisieTab — soumission du formulaire', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('appelle handleDirectSaveKPI avec les bonnes données à la soumission', async () => {
    const user = userEvent.setup();
    const handleDirectSaveKPI = vi.fn();
    renderSaisieTab({ handleDirectSaveKPI });

    // Remplir les champs
    await user.clear(screen.getByPlaceholderText('Ex: 1250.50'));
    await user.type(screen.getByPlaceholderText('Ex: 1250.50'), '1500');
    await user.type(screen.getByPlaceholderText('Ex: 15'), '12');
    await user.type(screen.getByPlaceholderText('Ex: 20'), '18');
    await user.type(screen.getByPlaceholderText('Ex: 30'), '25');

    // Soumettre
    const submitBtn = screen.getByRole('button', { name: /Enregistrer mes chiffres/i });
    await user.click(submitBtn);

    expect(handleDirectSaveKPI).toHaveBeenCalledOnce();
    const callArg = handleDirectSaveKPI.mock.calls[0][0];
    expect(callArg.ca_journalier).toBe(1500);
    expect(callArg.nb_ventes).toBe(12);
    expect(callArg.nb_articles).toBe(18);
    expect(callArg.nb_prospects).toBe(25);
  });

  it('envoie 0 pour les champs dont le track est désactivé', async () => {
    const user = userEvent.setup();
    const handleDirectSaveKPI = vi.fn();
    renderSaisieTab({
      handleDirectSaveKPI,
      kpiConfig: { track_ca: true, track_ventes: false, track_articles: false, track_prospects: false },
    });

    await user.type(screen.getByPlaceholderText('Ex: 1250.50'), '800');

    const submitBtn = screen.getByRole('button', { name: /Enregistrer mes chiffres/i });
    await user.click(submitBtn);

    expect(handleDirectSaveKPI).toHaveBeenCalledOnce();
    const callArg = handleDirectSaveKPI.mock.calls[0][0];
    expect(callArg.ca_journalier).toBe(800);
    expect(callArg.nb_ventes).toBe(0);
    expect(callArg.nb_articles).toBe(0);
    expect(callArg.nb_prospects).toBe(0);
  });

  it('le bouton Annuler appelle setEditingEntry(null) et setActiveTab("kpi") en mode édition', async () => {
    const user = userEvent.setup();
    const setEditingEntry = vi.fn();
    const setActiveTab = vi.fn();
    renderSaisieTab({
      editingEntry: { date: '2026-04-01', ca_journalier: 100, nb_ventes: 1, nb_articles: 1, nb_prospects: 1 },
      setEditingEntry,
      setActiveTab,
    });

    const cancelBtn = screen.getByRole('button', { name: /Annuler/i });
    await user.click(cancelBtn);

    expect(setEditingEntry).toHaveBeenCalledWith(null);
    expect(setActiveTab).toHaveBeenCalledWith('kpi');
  });
});
