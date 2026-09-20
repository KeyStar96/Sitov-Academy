import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Helper function to scan a page for specific accessibility violations
async function checkAccessibility(page, pageName, rules = ['color-contrast']) {
    const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

    // If specific rules are provided, filter violations by those rules
    // Otherwise check all
    const contrastViolations = results.violations.filter(violation =>
        rules.includes(violation.id) || rules.length === 0
    );

    if (contrastViolations.length > 0) {
        console.log(`Accessibility violations found on ${pageName}:`);
        contrastViolations.forEach(violation => {
            console.log(`\nRule: ${violation.id} - ${violation.help}`);
            violation.nodes.forEach(node => {
                console.log(`  Target: ${node.target}`);
                console.log(`  Failure: ${node.failureSummary}`);
            });
        });
    }

    expect(contrastViolations, `Accessibility check failed for ${pageName}: Found ${contrastViolations.length} violations`).toEqual([]);
}

test.describe('Accessibility & Contrast Checks', () => {

    test('Home Page (Desktop) should have good contrast', async ({ page }) => {
        await page.goto('/de');
        // Wait for hydration or content load if necessary
        await page.waitForTimeout(1000);
        await checkAccessibility(page, 'Home Page');
    });

    test('Registration Page (Desktop) should have good contrast', async ({ page }) => {
        await page.goto('/de/registration');
        await page.waitForTimeout(1000);
        await checkAccessibility(page, 'Registration Page');
    });

    test('Cancellation Page (Desktop) should have good contrast', async ({ page }) => {
        await page.goto('/de/cancellation');
        await page.waitForTimeout(1000);
        // Wait for possible animations
        await page.waitForTimeout(500);
        await checkAccessibility(page, 'Cancellation Page');
    });

});
