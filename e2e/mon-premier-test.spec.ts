import { test, expect } from '@playwright/test';

test('Google : titre, recherche Playwright et Entrée', async ({ page }) => {
  // 1. Aller sur Google
  await page.goto('https://www.google.com');

  // 2. Gérer les cookies (on cherche le bouton "Tout accepter")
  // On utilise un sélecteur flexible car le texte peut varier
  const acceptButton = page.getByRole('button', { name: /Tout accepter|Accepter tout/i });
  
  if (await acceptButton.isVisible()) {
    await acceptButton.click();
  }

  // 3. Attendre que la barre de recherche soit prête et taper
  // Sur Google, c'est souvent un textarea ou un input avec le nom 'q'
  const searchBar = page.locator('[name="q"]');
  await searchBar.waitFor({ state: 'visible' });
  await searchBar.fill('Playwright');
  await searchBar.press('Enter');

  // 4. Vérifier qu'on a des résultats
  await expect(page).toHaveTitle(/Playwright/);
});
