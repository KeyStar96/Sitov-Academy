import { expect, test } from '@playwright/test'
import { sitovSimulationCopy } from '../lib/exam-simulation/ui-copy'
import { getExamPrepUi } from '../lib/exam-preparation/ui-copy'
import { sitovTeacherText } from '../lib/exam-simulation/teacher-ui-copy'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('sitov-intro-seen', '1')
    localStorage.setItem('sitov-consent', JSON.stringify({ version: 1, marketing: false, decidedAt: new Date().toISOString() }))
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

// Development-only preview uses signed preview state, never student attempts.
for (const lang of ['de', 'en', 'ru', 'uk', 'tr']) {
  test(`teacher exam management uses ${lang} and preserves German submissions`, async ({ page }) => {
    const t = (source: string) => sitovTeacherText(lang, source)
    await page.goto(`/${lang}/sitov-preview/exam-simulation/teacher`)
    await expect(page.getByRole('heading', { name: t('Freigaben verwalten'), exact: true })).toBeVisible()
    await page.getByRole('button', { name: t('Antworten bewerten'), exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Eine Nachricht schreiben', exact: true })).toHaveAttribute('lang', 'de')
    await expect(page.getByLabel(t('Stärken und nächster Übungsschritt'), { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: t('Bewertung speichern'), exact: true })).toBeDisabled()
    await page.getByRole('button', { name: t('Ergebnisse'), exact: true }).click()
    await expect(page.getByRole('heading', { name: t('Antworten und Ergebnisse'), exact: true })).toBeVisible()
    await page.screenshot({ path: `artifacts/sitov-exam-language-${lang}-teacher.png`, fullPage: false })
  })

  test(`preparation uses ${lang} around German practice tasks`, async ({ page }) => {
    const { t } = getExamPrepUi(lang)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`/${lang}/sitov-preview/exam-preparation`)
    await expect(page.getByRole('heading', { name: t('Prüfungsvorbereitung'), exact: true }).last()).toBeVisible()
    for (const label of ['Lernen', 'Meine Beiträge', 'Fortschritt']) {
      await expect(page.getByRole('button', { name: t(label), exact: true })).toBeVisible()
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.getByRole('button', { name: new RegExp(t('Weiterlernen:')) }).click()
    await expect(page.locator('h1[lang="de"][translate="no"]')).toBeVisible()
    await expect(page.getByRole('button', { name: t('Zur Übersicht'), exact: true })).toBeVisible()
    await page.getByRole('button', { name: t('Zur Übersicht'), exact: true }).click()
    await page.getByRole('button', { name: t('Meine Beiträge'), exact: true }).click()
    await expect(page.getByRole('heading', { name: t('Meine Beiträge'), exact: true })).toBeVisible()
    await expect(page.getByText(t('Hier findest du deine Texte, Aufnahmen und die Rückmeldungen deiner Lehrkraft.'), { exact: true })).toBeVisible()
  })

  test(`exam setup and results use ${lang}, while the actual exam stays German`, async ({ page }) => {
    const copy = sitovSimulationCopy(lang)
    await page.goto(`/${lang}/sitov-preview/exam-simulation?level=A1`)
    const notice = page.locator('[data-sitov-exam-language-notice]')
    await expect(notice).toContainText(copy.t('germanNoticeTitle'))
    await expect(notice).toContainText(copy.t('germanNotice'))
    await expect(notice).not.toHaveAttribute('lang', 'de')
    if (lang === 'de') await expect(notice).toContainText('Deutsch')
    await page.getByRole('button', { name: copy.t('startExam'), exact: true }).click()
    const task = page.locator('header[lang="de"][translate="no"]')
    await expect(task.getByRole('heading', { level: 2 })).toBeVisible()
    await expect(page.getByRole('button', { name: copy.t('endAttempt'), exact: true })).toBeVisible()
    await page.screenshot({ path: `artifacts/sitov-exam-language-${lang}-task.png`, fullPage: false })
    await page.getByRole('button', { name: copy.t('endAttempt'), exact: true }).click()
    await expect(page.getByRole('heading', { name: copy.t('finishQuestion'), exact: true })).toBeVisible()
    await page.getByRole('button', { name: copy.t('finish'), exact: true }).click()
    await expect(page.getByRole('heading', { name: copy.t('understandAnswers'), exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: copy.t('nextStep'), exact: true })).toBeVisible()
    await expect(page.getByText(copy.t('solution'), { exact: true }).first()).toBeVisible()
    await expect(page.locator('article[lang]').first()).toHaveAttribute('lang', lang)
    await expect(page.locator('article h3').first()).toHaveAttribute('lang', 'de')
    await page.screenshot({ path: `artifacts/sitov-exam-language-${lang}-result.png`, fullPage: false })
  })
}
