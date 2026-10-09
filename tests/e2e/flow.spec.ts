// End-to-end flow against the Firebase emulators and the Vite dev server.
// Run: npm run test:e2e   (starts the emulators, needs Java; see playwright.config.ts for the browser)
import { test, expect, type Page } from '@playwright/test'

const SHOTS = process.env.E2E_SHOTS ?? ''
const log = (m: string) => console.log('•', m)
const shot = (p: Page, n: string) => (SHOTS ? p.screenshot({ path: `${SHOTS}/${n}.png`, fullPage: true }) : null)

test('organiser and helpers: create, join, reserve, post, close', async ({ browser, baseURL }) => {
  test.setTimeout(180_000)
  const BASE = baseURL!

  async function newPage() {
    const ctx = await browser.newContext({ viewport: { width: 420, height: 900 }, locale: 'hu-HU', timezoneId: 'Europe/Budapest' })
    const page = await ctx.newPage()
    page.on('pageerror', (e) => console.log('PAGEERROR', e.message))
    page.on('console', (m) => m.type() === 'error' && console.log('CONSOLE', m.text().slice(0, 300)))
    return page
  }

  const org = await newPage()
  await org.goto(BASE)
  await org.getByRole('link', { name: 'Komatál indítása' }).click()
  await org.getByRole('button', { name: 'Még nincs fiókom' }).click()
  await org.getByLabel('E-mail cím').fill(`szervezo${Date.now()}@example.hu`)
  await org.getByLabel('Jelszó').fill('titkos-jelszo-123')
  await org.getByRole('button', { name: 'Fiók létrehozása' }).click()
  await org.getByText('Mentsd el a helyreállító kódot').waitFor()
  const recovery = await org.locator('p.font-mono').innerText()
  if (!/^[a-z2-9]{4}(-[a-z2-9]{4}){3}$/.test(recovery)) throw new Error('bad recovery code ' + recovery)
  log('account created, recovery code shown')
  await org.getByLabel('Elmentettem').click()
  await org.getByRole('button', { name: 'Tovább' }).click()

  // create a komatál
  await org.getByPlaceholder('pl. Kovács család').fill('Kovács család')
  await org.getByPlaceholder('Város, utca, házszám').fill('Budapest, Fő utca 1.')
  await org.locator('textarea').nth(1).fill('Dió, tej nélkül')
  await shot(org, '01-create')
  await org.getByRole('button', { name: 'Létrehozás' }).click()
  await org.getByText('Kész a komatál!').waitFor()
  const link = await org.locator('p.font-mono').first().innerText()
  if (!link.includes('/k/') || !link.includes('#')) throw new Error('bad invite link ' + link)
  log('komatál created, link ' + link.replace(/#.*/, '#…'))
  await shot(org, '02-invite')

  // helper joins the wait list
  const helper = await newPage()
  await helper.goto(link)
  await helper.getByText('Kovács család komatálja').first().waitFor()
  await helper.getByText('Megjegyezhet ez az eszköz?').waitFor()
  await helper.getByRole('button', { name: 'Megjegyzem' }).click()
  await helper.getByLabel('Neved').fill('Anna')
  await helper.getByLabel('Telefonszám').fill('+36 30 123 4567')
  await shot(helper, '03-join')
  await helper.getByRole('button', { name: 'Feliratkozom' }).click()
  await helper.getByText('A várólistán vagy').waitFor()
  log('helper on the wait list')

  // a second helper hides their name
  const helper2 = await newPage()
  await helper2.goto(link)
  await helper2.getByLabel('Neved').fill('Béla')
  await helper2.getByLabel('E-mail cím').fill('bela@example.hu')
  await helper2.getByText('A nevem látszódjon a többi segítőnek').click()
  await helper2.getByRole('button', { name: 'Feliratkozom' }).click()
  await helper2.getByText('A várólistán vagy').waitFor()

  // organiser sees both with contact details (decrypted from sealed boxes)
  await org.getByRole('tab', { name: 'Naptár' }).click()
  await org.getByText('Anna').first().waitFor()
  await org.getByText('+36 30 123 4567').waitFor()
  await org.getByText('bela@example.hu').waitFor()
  log('organiser reads sealed contact details')
  await shot(org, '04-waitlist')

  // the baby is born
  await org.getByRole('button', { name: 'Baba megszületett' }).first().click()
  await org.getByRole('button', { name: 'Közzététel és indítás' }).click()
  await org.getByText('Folyamatban').first().waitFor()
  log('baby born, komatál active')

  // helper reserves a day; details unlock afterwards
  await helper.getByText('Válassz napot').first().waitFor()
  await helper.getByText('akkor jelennek meg', { exact: false }).waitFor()
  await helper.getByRole('button', { name: 'Vállalom' }).first().click()
  await helper.getByPlaceholder('pl. Pörkölt galuskával').fill('Gulyásleves')
  await helper.getByPlaceholder('Kb. 18:00-kor érkezem').fill('18:30 körül')
  await helper.getByRole('button', { name: 'Foglalás', exact: true }).click()
  await helper.getByText('Tudnivalók a vállalt napra').waitFor()
  await helper.getByText('Budapest, Fő utca 1.').waitFor()
  await helper.getByText('Dió, tej nélkül').waitFor()
  log('helper reserved a day and sees the address')
  await shot(helper, '05-helper-reserved')

  // second helper sees the meal but only an alias, and not the address
  await helper2.getByText('Gulyásleves').waitFor()
  await helper2.getByText('Anna').first().waitFor()
  const taken = helper2.locator('[class*=py-3]').filter({ hasText: 'Gulyásleves' })
  await taken.waitFor()
  if ((await helper2.getByText('Budapest, Fő utca 1.').count()) !== 0) throw new Error('address leaked before reservation')
  log('other helper sees the meal, not the address')

  // helper2 reserves the next day with a hidden name -> alias
  await helper2.getByRole('button', { name: 'Vállalom' }).first().click()
  await helper2.getByPlaceholder('pl. Pörkölt galuskával').fill('Rakott krumpli')
  await helper2.getByRole('button', { name: 'Foglalás', exact: true }).click()
  await helper2.getByText('(te)').waitFor()
  const aliasText = await helper2.locator('p.font-semibold', { hasText: '(te)' }).innerText()
  if (aliasText.includes('Béla')) throw new Error('hidden name leaked: ' + aliasText)
  log('hidden name shown as alias: ' + aliasText.replace('(te)', '').trim())

  // organiser sees reservations with note and contact, posts an update
  await org.getByText('Gulyásleves').waitFor()
  await org.getByText('18:30 körül').waitFor()
  await org.getByRole('tab', { name: 'Hírek' }).click()
  await org.getByPlaceholder('Mi újság?').fill('Bence 3300 g, délután várunk titeket!')
  await org.getByRole('button', { name: 'Közzététel' }).last().click()
  await helper.getByText('Bence 3300 g').waitFor()
  await helper.getByRole('button', { name: /🎉/ }).first().click()
  await org.getByText('🎉 1').waitFor()
  log('feed post and emoji reaction')
  await shot(org, '06-feed')

  // organiser cancels via release, then closes the komatál
  await org.getByRole('tab', { name: 'Beállítások' }).click()
  await org.getByRole('button', { name: 'Komatál lezárása' }).first().click()
  await org.getByRole('button', { name: 'Közzététel és lezárás' }).click()
  await org.getByText('Lezárt komatál').waitFor()
  await helper.getByText('Ez a komatál lezárult').waitFor()
  log('closed: helpers see the closing notice, organiser keeps the archive')
  await shot(helper, '07-closed')

  // reload the organiser: still unlocked from the device key, password remembered in the vault
  await org.reload()
  await org.getByText('Lezárt komatál').waitFor()
  log('organiser reload keeps access')
})
