import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import Login from '../pages/Login';

// Mock API client
vi.mock('../lib/apiClient', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock Logo component
vi.mock('../components/shared/Logo', () => ({
  default: () => <div data-testid="logo" />,
}));

// Mock logger
vi.mock('../utils/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn() },
}));

import { api } from '../lib/apiClient';
import { toast } from 'sonner';

const renderLogin = (onLogin = vi.fn(), search = '') => {
  return render(
    <MemoryRouter initialEntries={[`/${search}`]}>
      <Login onLogin={onLogin} />
    </MemoryRouter>
  );
};

describe('Login — connexion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('affiche le formulaire de connexion par défaut', () => {
    renderLogin();
    expect(screen.getByTestId('login-page')).toBeInTheDocument();
    expect(screen.getByTestId('auth-form')).toBeInTheDocument();
    expect(screen.getByTestId('email-input')).toBeInTheDocument();
    expect(screen.getByTestId('password-input')).toBeInTheDocument();
    expect(screen.getByTestId('submit-button')).toHaveTextContent('Se connecter');
  });

  it('appelle POST /auth/login et onLogin en cas de succès', async () => {
    const user = userEvent.setup();
    const onLogin = vi.fn();
    const fakeUser = { id: '1', name: 'Test', role: 'gérant' };
    api.post.mockResolvedValueOnce({ data: { user: fakeUser, token: 'tok123' } });

    renderLogin(onLogin);

    await user.type(screen.getByTestId('email-input'), 'test@test.com');
    await user.type(screen.getByTestId('password-input'), 'motdepasse');
    await user.click(screen.getByTestId('submit-button'));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/auth/login', {
        email: 'test@test.com',
        password: 'motdepasse',
      });
      expect(onLogin).toHaveBeenCalledWith(fakeUser, 'tok123', false);
    });
  });

  it('affiche un toast d\'erreur si la connexion échoue', async () => {
    const user = userEvent.setup();
    api.post.mockRejectedValueOnce({
      response: { data: { detail: 'Identifiants incorrects' } },
    });

    renderLogin();

    await user.type(screen.getByTestId('email-input'), 'mauvais@test.com');
    await user.type(screen.getByTestId('password-input'), 'wrongpassword');
    await user.click(screen.getByTestId('submit-button'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Identifiants incorrects');
    });
  });

  it('affiche "Chargement..." pendant la requête', async () => {
    const user = userEvent.setup();
    // Promise qui ne se résout jamais (simule un délai réseau)
    api.post.mockReturnValueOnce(new Promise(() => {}));

    renderLogin();

    await user.type(screen.getByTestId('email-input'), 'test@test.com');
    await user.type(screen.getByTestId('password-input'), 'pass');
    await user.click(screen.getByTestId('submit-button'));

    expect(screen.getByTestId('submit-button')).toHaveTextContent('Chargement...');
  });

  it('bascule en mode inscription en cliquant sur le lien', async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.click(screen.getByTestId('toggle-auth-mode'));

    expect(screen.getByTestId('submit-button')).toHaveTextContent("S'inscrire");
    expect(screen.getByTestId('name-input')).toBeInTheDocument();
  });
});

describe('Login — inscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('appelle POST /auth/register avec les bons champs', async () => {
    const user = userEvent.setup();
    const onLogin = vi.fn();
    const fakeUser = { id: '2', name: 'Nouveau', role: 'gérant' };
    api.post.mockImplementation((url) => {
      if (url === '/workspaces/check-availability') {
        return Promise.resolve({ data: { available: true, message: 'Disponible' } });
      }
      return Promise.resolve({ data: { user: fakeUser, token: 'tok456' } });
    });

    renderLogin(onLogin, '?register=true');

    await user.type(screen.getByTestId('name-input'), 'Nouveau Gérant');
    await user.type(screen.getByTestId('workspace-name-input'), 'Ma Boutique');
    await user.type(screen.getByTestId('email-input'), 'nouveau@test.com');
    await user.type(screen.getByTestId('password-input'), 'password123');

    // Accepter les CGU
    const cguCheckbox = screen.getByRole('checkbox', { name: /Conditions Générales/i });
    await user.click(cguCheckbox);

    await user.click(screen.getByTestId('submit-button'));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/auth/register',
        expect.objectContaining({
          name: 'Nouveau Gérant',
          email: 'nouveau@test.com',
          password: 'password123',
          workspace_name: 'Ma Boutique',
          role: 'gérant',
        })
      );
      expect(onLogin).toHaveBeenCalledWith(fakeUser, 'tok456', true);
    });
  });
});
