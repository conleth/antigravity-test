import { test, expect } from '@playwright/test';

test.describe('Checklist Persistence', () => {
    test('should maintain selection and filter correctly in In-Scope view', async ({ page }) => {
        test.setTimeout(120000);
        await page.goto('/questionnaire');

        // 2. Complete Questionnaire
        while (page.url().includes('questionnaire')) {
            const radio = page.locator('button[role="radio"]').first();
            const checkbox = page.locator('button[role="checkbox"]').first();

            if (await radio.isVisible()) {
                await radio.click();
            } else if (await checkbox.isVisible()) {
                await checkbox.click();
            }

            const nextButton = page.getByRole('button', { name: /Next/i });
            const generateButton = page.getByRole('button', { name: /Generate Checklist/i });

            if (await generateButton.isVisible() && await generateButton.isEnabled()) {
                await generateButton.click();
                break;
            } else if (await nextButton.isVisible() && await nextButton.isEnabled()) {
                await nextButton.click();
            }
            // Small pause for animation
            await page.waitForTimeout(100);
        }

        // 3. Verify we are on the checklist/results page
        await expect(page).toHaveURL(/.*checklist/, { timeout: 15000 });

        // 4. Select a few requirements
        const checkboxes = page.locator('button[role="checkbox"]');
        await checkboxes.nth(0).click();
        await checkboxes.nth(1).click();
        await checkboxes.nth(2).click();

        // Verify count in footer
        await expect(page.getByText('3 selected')).toBeVisible();

        // 5. Save & View Scope
        await page.getByRole('button', { name: /Save & View Scope/i }).click();
        await expect(page).toHaveURL(/.*in-scope/);

        // 6. ASSERTION: Should only see 3 requirements
        // Note: This is expected to FAIL based on the bug report
        const visibleRequirements = page.locator('div.rounded-xl.border.bg-card');
        await expect(visibleRequirements).toHaveCount(3);

        // 7. Navigate away to Exclusions
        await page.getByRole('link', { name: /Exclusions/i }).click();
        await expect(page).toHaveURL(/.*exclusions/);

        // 8. Navigate back to In Scope
        await page.getByRole('link', { name: /In Scope/i }).click();
        await expect(page).toHaveURL(/.*in-scope/);

        // 9. ASSERTION: Should STILL only see 3 requirements
        // Note: This is ALSO expected to FAIL
        await expect(visibleRequirements).toHaveCount(3);
        await expect(page.getByText('3 selected')).toBeVisible();
    });
});
