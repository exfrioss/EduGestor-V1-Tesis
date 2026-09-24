import { expect, test } from '@playwright/test';

test('muestra el bootstrap de EduGestor', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'EduGestor V1.0' })).toBeVisible();
});
