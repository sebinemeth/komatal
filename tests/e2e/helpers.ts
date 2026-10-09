import { expect, type Browser, type Page } from '@playwright/test'

export const PASSWORD = 'titkos-jelszo-123'
export const uniqueEmail = (prefix = 'szervezo') => `${prefix}${Date.now()}${Math.floor(Math.random() * 1e4)}@example.hu`

export async function newPage(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 }, locale: 'hu-HU', timezoneId: 'Europe/Budapest' })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message))
  return page
}

/** Signs up a new organiser and clicks through the recovery code screen. Returns the credentials and recovery code. */
export async function signUp(page: Page, email = uniqueEmail(), password = PASSWORD) {
  await page.goto('/belepes')
  await page.getByRole('button', { name: 'Még nincs fiókom' }).click()
  await page.getByLabel('E-mail cím').fill(email)
  await page.getByLabel('Jelszó').fill(password)
  await page.getByRole('button', { name: 'Fiók létrehozása' }).click()
  await page.getByText('Mentsd el a helyreállító kódot').waitFor()
  const recovery = await page.locator('p.font-mono').innerText()
  await page.getByLabel('Elmentettem').click()
  await page.getByRole('button', { name: 'Tovább' }).click()
  return { email, password, recovery }
}

/** Creates a komatál from the dashboard. Returns the invite link (with the password in the hash). */
export async function createKomatal(page: Page, name = 'Kovács család', opts: { address?: string; allergies?: string } = {}) {
  await page.goto('/uj')
  await page.getByPlaceholder('pl. Kovács család').fill(name)
  await page.getByPlaceholder('Város, utca, házszám').fill(opts.address ?? 'Budapest, Fő utca 1.')
  await page.locator('textarea').nth(1).fill(opts.allergies ?? 'Dió, tej nélkül')
  await page.getByRole('button', { name: 'Létrehozás' }).click()
  await page.getByText('Kész a komatál!').waitFor()
  return page.locator('p.font-mono').first().innerText()
}

export async function join(page: Page, link: string, name: string, contact: { phone?: string; email?: string } = { phone: '+36 30 123 4567' }) {
  await page.goto(link)
  await page.getByLabel('Neved').fill(name)
  if (contact.phone) await page.getByLabel('Telefonszám').fill(contact.phone)
  if (contact.email) await page.getByLabel('E-mail cím').fill(contact.email)
  await page.getByRole('button', { name: 'Feliratkozom' }).click()
  await page.getByText('A várólistán vagy').waitFor()
}

/** Organiser marks the baby as born (komatál becomes active). */
export async function markBorn(org: Page) {
  await org.getByRole('button', { name: 'Baba megszületett' }).first().click()
  await org.getByRole('button', { name: 'Közzététel és indítás' }).click()
  await expect(org.getByText('Folyamatban').first()).toBeVisible()
}

export async function reserve(helper: Page, meal: string, note?: string) {
  await helper.getByRole('button', { name: 'Vállalom' }).first().click()
  await helper.getByPlaceholder('pl. Pörkölt galuskával').fill(meal)
  if (note) await helper.getByPlaceholder('Kb. 18:00-kor érkezem').fill(note)
  await helper.getByRole('button', { name: 'Foglalás', exact: true }).click()
  await helper.getByText(meal).first().waitFor()
}
