import { describe, it, expect } from 'vitest';
import { isSafeUrl } from '../utils/safeRedirect';

describe('isSafeUrl', () => {
  it('autorise les chemins relatifs internes (/dashboard)', () => {
    expect(isSafeUrl('/dashboard')).toBe(true);
  });

  it('autorise les URLs Stripe Checkout (HTTPS)', () => {
    expect(isSafeUrl('https://checkout.stripe.com/pay/cs_test_xxx')).toBe(true);
  });

  it('autorise billing.stripe.com', () => {
    expect(isSafeUrl('https://billing.stripe.com/session/xxx')).toBe(true);
  });

  it('bloque les protocoles relatifs (//evil.com)', () => {
    expect(isSafeUrl('//evil.com/steal')).toBe(false);
  });

  it('bloque les URLs externes non whitelistées', () => {
    expect(isSafeUrl('https://evil.com/phish')).toBe(false);
  });

  it('bloque le HTTP (non HTTPS) pour les URLs absolues', () => {
    expect(isSafeUrl('http://checkout.stripe.com/pay/xxx')).toBe(false);
  });

  it('bloque les chaînes vides', () => {
    expect(isSafeUrl('')).toBe(false);
  });

  it('bloque null / undefined', () => {
    expect(isSafeUrl(null)).toBe(false);
    expect(isSafeUrl(undefined)).toBe(false);
  });

  it('bloque javascript: scheme', () => {
    expect(isSafeUrl('javascript:alert(1)')).toBe(false);
  });

  it('autorise une URL de la même origine', () => {
    expect(isSafeUrl('/manager/dashboard', 'https://myapp.com')).toBe(true);
  });
});
