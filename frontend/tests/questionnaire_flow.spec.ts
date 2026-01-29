import { test, expect } from '@playwright/test';

test.describe('Enhanced Questionnaire Flow', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/questionnaire');
    });

    const navigateToFinalStep = async (page: any) => {
        let iterations = 0;
        while (iterations < 20) {
            const nextButton = page.getByRole('button', { name: /Next/i });
            const reviewButton = page.getByRole('button', { name: /Review Answers/i });

            if (await reviewButton.isVisible()) {
                break;
            }

            if (await nextButton.isVisible()) {
                if (await nextButton.isDisabled()) {
                    // Try to click "Yes" or the first label if "Yes" not found (for other types)
                    const yesOption = page.getByText('Yes', { exact: true });
                    if (await yesOption.isVisible()) {
                        await yesOption.first().click();
                    } else {
                        await page.locator('label').first().click();
                    }
                }
                await nextButton.click();
            } else {
                break;
            }
            await page.waitForTimeout(200);
            iterations++;
        }
    };

    test('should allow multi-select answers and show insights', async ({ page }) => {
        // Step 1: App Type (Single Select)
        await page.getByText('API Service').click();
        await expect(page.locator('text=OWASP API Top 10')).toBeVisible();
        await page.getByRole('button', { name: /Next/i }).click();

        // Step 2: Auth Type (Multi Select)
        await page.getByText('Session-based').click();
        await page.getByText('API Key', { exact: true }).click();
        await expect(page.locator('text=Static credentials')).toBeVisible();
        await page.getByRole('button', { name: /Next/i }).click();

        // Step 3: Data Sensitivity
        await page.getByText('Regulated', { exact: true }).click();
        await expect(page.locator('text=encryption at rest')).toBeVisible();
        await page.getByRole('button', { name: /Next/i }).click();

        // Step 4: Internet Exposure
        await page.getByText('Public Internet').click();
        await expect(page.locator('text=edge protection')).toBeVisible();
        await page.getByRole('button', { name: /Next/i }).click();

        // Step 5: Hosting Model
        await page.getByText('Cloud', { exact: true }).click();
        await page.getByRole('button', { name: /Next/i }).click();

        // Step 6: Architecture (Containers)
        await page.getByText('Yes', { exact: true }).click();
        await expect(page.locator('text=image signing')).toBeVisible();
        await page.getByRole('button', { name: /Next/i }).click();

        // Step 7: Multi-tenancy
        await page.getByText('Yes', { exact: true }).click();
        await expect(page.locator('text=data isolation')).toBeVisible();
        await page.getByRole('button', { name: /Next/i }).click();

        // Step 8: Compliance (Multi Select)
        await page.getByText('PCI-DSS').click();
        await page.getByText('GDPR').click();
        await expect(page.locator('text=evidence gathering')).toBeVisible();
        await page.getByRole('button', { name: /Next/i }).click();

        // Step 9: Legacy Systems
        await page.getByText('No', { exact: true }).click();
        await page.getByRole('button', { name: /Next/i }).click();

        // Steps 10-14: Pipeline Maturity (click through)
        for (let i = 0; i < 5; i++) {
            await page.getByText('No', { exact: true }).first().click();
            const nextButton = page.getByRole('button', { name: /Next/i });
            const reviewButton = page.getByRole('button', { name: /Review Answers/i });
            if (await nextButton.isVisible()) {
                await nextButton.click();
            } else if (await reviewButton.isVisible()) {
                await reviewButton.click();
                break;
            }
            await page.waitForTimeout(200);
        }

        // Verify Review Summary
        await expect(page.locator('h1')).toHaveText('Review Your Project Profile');
        await expect(page.locator('text=PCI-DSS, GDPR')).toBeVisible();
        await expect(page.locator('p:has-text("Yes")')).toHaveCount(2);
    });

    test('should allow editing answers from review summary', async ({ page }) => {
        await navigateToFinalStep(page);

        // Answer last question (likely boolean)
        const yesOption = page.getByText('Yes', { exact: true });
        if (await yesOption.isVisible()) {
            await yesOption.first().click();
        } else {
            await page.locator('label').first().click();
        }

        await page.getByRole('button', { name: /Review Answers/i }).click();

        // Go to review
        await expect(page.locator('h1')).toHaveText('Review Your Project Profile');

        // Click Edit on the first question (App Type)
        const firstCard = page.locator('div.group').first();
        await firstCard.hover();
        await firstCard.getByRole('button', { name: 'Edit' }).click();

        // Verify we are back on step 1
        await expect(page.locator('text=Step 1 /')).toBeVisible();

        // Change answer
        await page.getByText('Mobile App').click();
        await expect(page.locator('text=MASVS')).toBeVisible();

        // Click through back to review
        await navigateToFinalStep(page);
        await page.getByRole('button', { name: /Review Answers/i }).click();

        // Verify change is reflected
        await expect(page.locator('text=Mobile App')).toBeVisible();
    });

    test('should handle conditional logic correctly', async ({ page }) => {
        // Step 1: App Type -> Web
        await page.getByText('Web Application').click();
        await page.getByRole('button', { name: /Next/i }).click();

        // Steps 2-4
        await page.getByText('None').first().click();
        await page.getByRole('button', { name: /Next/i }).click();
        await page.getByText('Public', { exact: true }).click();
        await page.getByRole('button', { name: /Next/i }).click();
        await page.getByText('Public Internet').click();
        await page.getByRole('button', { name: /Next/i }).click();

        // Step 5: Hosting Model -> On-Premises (Should skip Container question)
        await page.getByText('On-Premises').click();
        await page.getByRole('button', { name: /Next/i }).click();

        // Should skip is-containerized and move to is-multi-tenant
        await expect(page.locator('text=Is this a multi-tenant application?')).toBeVisible();
        // The total number of steps should be 13 instead of 14
        await expect(page.getByText('/ 13')).toBeVisible();
    });
});
