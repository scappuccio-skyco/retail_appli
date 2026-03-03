import { test, expect } from '@playwright/test';
import { loadDotEnv, mustGet } from './helpers/env';
import { login, expectLoggedInAsGerant } from './helpers/auth';

loadDotEnv();

function prefix() {
  return (process.env.E2E_PREFIX || 'E2E').trim();
}

test.describe('Stores', () => {
  test('Gerant can open create-store modal (no submit)', async ({ page }) => {
    await login(page, mustGet('E2E_GERANT_EMAIL'), mustGet('E2E_PASSWORD'));
    await expectLoggedInAsGerant(page);

    await page.getByRole('button', { name: /magasins/i }).click();
    await expect(page.getByRole('button', { name: /ajouter un magasin/i })).toBeVisible();

    await page.getByRole('button', { name: /ajouter un magasin/i }).click();

    await expect(page.getByText(/créer un nouveau magasin/i)).toBeVisible();

    // Use stable testids
    await expect(page.getByTestId('store-name')).toBeVisible();
    await expect(page.getByTestId('store-location')).toBeVisible();

    // Fill but do not submit
    await page.getByTestId('store-name').fill(`${prefix()} - Store - ${Date.now()}`);
    await page.getByTestId('store-location').fill('75001 Paris');

    await page.getByTestId('store-cancel').click();
    await expect(page.getByText(/créer un nouveau magasin/i)).toHaveCount(0);
  });
});
