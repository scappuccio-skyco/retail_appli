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

const baseProps = {
  isOpen: false,
  onClose: vi.fn(),
  propSubscriptionInfo: null,
  userRole: 'gerant',
  onOpenBillingProfile: vi.fn(),
  onOpenInvoices: vi.fn(),
};

describe('useSubscription — chargement', () => {
  beforeEach(() => vi.clearAllMocks());

  it('appelle le status et le seller count quand isOpen passe à true (gérant)', async () => {
    api.get.mockResolvedValue({ data: {} });

    const { rerender } = renderHook((props) => useSubscription(props), {
      initialProps: baseProps,
    });

    await act(async () => {
      rerender({ ...baseProps, isOpen: true });
    });

    await waitFor(() => {
      const urls = api.get.mock.calls.map((c) => c[0]);
      expect(urls).toContain('/gerant/subscription/status');
      expect(urls).toContain('/gerant/dashboard/stats');
    });
  });
});

describe('useSubscription — validation code promo', () => {
  beforeEach(() => vi.clearAllMocks());

  it('setPromoStatus = "valid" si l\'API retourne valid=true', async () => {
    api.get.mockResolvedValue({ data: {} });
    api.post.mockResolvedValue({ data: { valid: true } });

    const { result } = renderHook(() => useSubscription(baseProps));

    await act(async () => { result.current.setPromoCode('PROMO10'); });
    await act(async () => { await result.current.handleValidatePromo(); });

    expect(api.post).toHaveBeenCalledWith('/gerant/stripe/validate-promo', { promo_code: 'PROMO10' });
    expect(result.current.promoStatus).toBe('valid');
  });

  it('setPromoStatus = "invalid" si l\'API retourne valid=false', async () => {
    api.get.mockResolvedValue({ data: {} });
    api.post.mockResolvedValue({ data: { valid: false } });

    const { result } = renderHook(() => useSubscription(baseProps));

    await act(async () => { result.current.setPromoCode('BADCODE'); });
    await act(async () => { await result.current.handleValidatePromo(); });

    expect(result.current.promoStatus).toBe('invalid');
  });

  it('setPromoStatus = "invalid" si l\'API throw', async () => {
    api.get.mockResolvedValue({ data: {} });
    api.post.mockRejectedValueOnce(new Error('network error'));

    const { result } = renderHook(() => useSubscription(baseProps));

    await act(async () => { result.current.setPromoCode('ERRCODE'); });
    await act(async () => { await result.current.handleValidatePromo(); });

    expect(result.current.promoStatus).toBe('invalid');
  });

  it('ne fait pas d\'appel API si promoCode est vide', async () => {
    api.get.mockResolvedValue({ data: {} });
    const { result } = renderHook(() => useSubscription(baseProps));

    await act(async () => { await result.current.handleValidatePromo(); });

    expect(api.post).not.toHaveBeenCalled();
  });
});
