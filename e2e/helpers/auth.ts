import { Page, expect } from '@playwright/test';
import { mustGet } from './env';

export async function login(page: Page, email: string, password: string) {
  const baseUrl = mustGet('E2E_BASE_URL');
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });

  // Use deterministic input sequence (click -> type -> Tab -> type -> Enter)
  await page.getByRole('textbox', { name: /email/i }).click();
  await page.keyboard.type(email, { delay: 15 });
  await page.keyboard.press('Tab');
  // password field doesn't always have accessible name; use placeholder bullets
  await page.getByPlaceholder('••••••••').click();
  await page.keyboard.type(password, { delay: 15 });
  await page.keyboard.press('Enter');

  // Either we navigate away or login shows validation.
  await page.waitForTimeout(1200);
}

export async function logoutIfPossible(page: Page) {
  const logout = page.getByRole('button', { name: /déconnexion/i });
  if (await logout.count()) {
    await logout.first().click();
    await page.waitForTimeout(800);
  }
}

export async function expectLoggedInAsGerant(page: Page) {
  await expect(page.getByRole('button', { name: /magasins/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /personnel/i })).toBeVisible();
}

export async function expectLoggedInAsSeller(page: Page) {
  await expect(page.getByRole('button', { name: /personnaliser/i })).toBeVisible();
}

export async function expectLoggedInAsManager(page: Page) {
  await expect(page.getByRole('button', { name: /^config$/i })).toBeVisible();
}
