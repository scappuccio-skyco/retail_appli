import { test } from '@playwright/test';
import { loadDotEnv, mustGet } from './helpers/env';
import {
  login,
  logoutIfPossible,
  expectLoggedInAsGerant,
  expectLoggedInAsManager,
  expectLoggedInAsSeller,
} from './helpers/auth';

loadDotEnv();

test.describe('Auth + RBAC smoke', () => {
  test('Gerant can login and sees gerant menu', async ({ page }) => {
    await login(page, mustGet('E2E_GERANT_EMAIL'), mustGet('E2E_PASSWORD'));
    await expectLoggedInAsGerant(page);
    await logoutIfPossible(page);
  });

  test('Manager can login and sees manager menu', async ({ page }) => {
    await login(page, mustGet('E2E_MANAGER_EMAIL'), mustGet('E2E_PASSWORD'));
    await expectLoggedInAsManager(page);
    await logoutIfPossible(page);
  });

  test('Seller can login and sees seller menu', async ({ page }) => {
    await login(page, mustGet('E2E_SELLER_EMAIL'), mustGet('E2E_PASSWORD'));
    await expectLoggedInAsSeller(page);
    await logoutIfPossible(page);
  });
});
