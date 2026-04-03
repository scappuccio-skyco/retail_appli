import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useSubscription } from '../components/subscriptionModal/useSubscription';

vi.mock('../lib/apiClient', () => ({
  api: { get: vi.fn(), post: vi.fn() },
}));
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
vi.mock('../utils/safeRedirect', () => ({
  isSafeUrl: vi.fn(() => true),
  safeRedirect: vi.fn(() => true),
}));
vi.mock('../utils/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), log: vi.fn() },
}));

import { api } from '../lib/apiClient';
import { toast } from 'sonner';
import { isSafeUrl, safeRedirect } from '../utils/safeRedirect';

const baseProps = {
  isOpen: false,
  onClose: vi.fn(),
  propSubscriptionInfo: null,
  userRole: 'gerant',
  onOpenBillingProfile: vi.fn(),
  onOpenInvoices: vi.fn(),
};

// Ouvre la modale et attend que les fetches soient terminés
async function openModal(renderResult, sellerCount = 2) {
  api.get.mockImplementation((url) => {
    if (url.includes('stats')) return Promise.resolve({ data: { total_sellers: sellerCount } });
    return Promise.resolve({ data: {} });
  });

  await act(async () => {
    renderResult.rerender({ ...baseProps, isOpen: true });
  });

  await waitFor(() => expect(api.get).toHaveBeenCalled());
}

describe('useSubscription — handleSelectPlan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockResolvedValue({ data: {} });
  });

  it('affiche une erreur si le nombre de vendeurs dépasse la limite du plan', async () => {
    const { result, rerender } = renderHook((props) => useSubscription(props), {
      initialProps: baseProps,
    });

    // 6 vendeurs > maxSellers=5 pour le plan starter
    await openModal({ result, rerender }, 6);

    act(() => { result.current.handleSelectPlan('starter'); });

    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining('6'),
      expect.any(Object)
    );
    expect(result.current.showPlanConfirmModal).toBe(false);
  });

  it('ouvre la modale de confirmation si les vendeurs sont dans la limite', async () => {
    const { result, rerender } = renderHook((props) => useSubscription(props), {
      initialProps: baseProps,
    });

    // 2 vendeurs ≤ maxSellers=5 pour starter
    await openModal({ result, rerender }, 2);

    act(() => { result.current.handleSelectPlan('starter'); });

    expect(result.current.showPlanConfirmModal).toBe(true);
    expect(result.current.planConfirmData).toMatchObject({ planKey: 'starter' });
  });
});

describe('useSubscription — handleProceedToPayment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockResolvedValue({ data: {} });
  });

  it('appelle le checkout et redirige vers Stripe si URL valide', async () => {
    api.post.mockResolvedValue({ data: { checkout_url: 'https://checkout.stripe.com/pay/cs_test_123' } });

    const { result } = renderHook(() => useSubscription(baseProps));

    await act(async () => {
      result.current.setSelectedPlan('starter');
      result.current.setSelectedQuantity(2);
    });

    await act(async () => { await result.current.handleProceedToPayment(); });

    expect(api.post).toHaveBeenCalledWith(
      '/gerant/stripe/checkout',
      expect.objectContaining({ quantity: 2 })
    );
    expect(safeRedirect).toHaveBeenCalledWith(
      'https://checkout.stripe.com/pay/cs_test_123',
      'replace'
    );
  });

  it('appelle onOpenBillingProfile si erreur 400 profil facturation', async () => {
    const err = new Error('billing error');
    err.response = { status: 400, data: { detail: 'Profil de facturation incomplet' } };
    api.post.mockRejectedValueOnce(err);

    const onOpenBillingProfile = vi.fn();
    const { result } = renderHook(() =>
      useSubscription({ ...baseProps, onOpenBillingProfile })
    );

    await act(async () => { result.current.setSelectedPlan('starter'); });
    await act(async () => { await result.current.handleProceedToPayment(); });

    expect(onOpenBillingProfile).toHaveBeenCalled();
  });
});

describe('useSubscription — cancel / reactivate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockResolvedValue({ data: {} });
  });

  it('confirmCancelSubscription : POST /cancel et toast.success', async () => {
    api.post.mockResolvedValue({ data: { message: 'Abonnement annulé' } });

    const { result } = renderHook(() => useSubscription(baseProps));

    await act(async () => { await result.current.confirmCancelSubscription(); });

    expect(api.post).toHaveBeenCalledWith('/gerant/subscription/cancel', {});
    expect(toast.success).toHaveBeenCalledWith('Abonnement annulé');
  });

  it('confirmReactivateSubscription : POST /reactivate et toast.success', async () => {
    api.post.mockResolvedValue({ data: { message: 'Abonnement réactivé' } });

    const { result } = renderHook(() => useSubscription(baseProps));

    await act(async () => { await result.current.confirmReactivateSubscription(); });

    expect(api.post).toHaveBeenCalledWith('/gerant/subscription/reactivate', {});
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Abonnement réactivé'));
  });
});
