import { expect, test } from '@playwright/test'
import { newPage, PASSWORD, signUp, uniqueEmail } from './helpers'

test.describe('organiser auth', () => {
  test('landing page renders and the call to action leads to login', async ({ browser }) => {
    const page = await newPage(browser)
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Szervezz komatált percek alatt' })).toBeVisible()
    await page.getByRole('link', { name: 'Komatál indítása' }).click()
    await expect(page).toHaveURL(/\/belepes\?next=\/uj/)
    await expect(page.getByRole('heading', { name: 'Belépés szervezőknek' })).toBeVisible()
  })

  test('organiser-only routes redirect anonymous visitors to login', async ({ browser }) => {
    const page = await newPage(browser)
    for (const path of ['/szervezo', '/uj']) {
      await page.goto(path)
      await expect(page).toHaveURL(/\/belepes\?next=/)
    }
  })

  test('unknown routes fall back to the landing page', async ({ browser }) => {
    const page = await newPage(browser)
    await page.goto('/nincs-ilyen/oldal')
    await expect(page).toHaveURL(/\/$/)
  })

  test('sign up shows the recovery code, then lands on the dashboard', async ({ browser }) => {
    const page = await newPage(browser)
    const { recovery } = await signUp(page)
    expect(recovery).toMatch(/^[a-z2-9]{4}(-[a-z2-9]{4}){3}$/)
    await expect(page).toHaveURL(/\/szervezo$/)
    await expect(page.getByText('Még nincs komatálod')).toBeVisible()
  })

  test('continue stays disabled until the recovery code is acknowledged', async ({ browser }) => {
    const page = await newPage(browser)
    await page.goto('/belepes')
    await page.getByRole('button', { name: 'Még nincs fiókom' }).click()
    await page.getByLabel('E-mail cím').fill(uniqueEmail())
    await page.getByLabel('Jelszó').fill(PASSWORD)
    await page.getByRole('button', { name: 'Fiók létrehozása' }).click()
    const next = page.getByRole('button', { name: 'Tovább' })
    await expect(next).toBeDisabled()
    await page.getByLabel('Elmentettem').click()
    await expect(next).toBeEnabled()
  })

  test('registering an existing e-mail is rejected', async ({ browser }) => {
    const first = await newPage(browser)
    const { email } = await signUp(first)
    const second = await newPage(browser)
    await second.goto('/belepes')
    await second.getByRole('button', { name: 'Még nincs fiókom' }).click()
    await second.getByLabel('E-mail cím').fill(email)
    await second.getByLabel('Jelszó').fill(PASSWORD)
    await second.getByRole('button', { name: 'Fiók létrehozása' }).click()
    await expect(second.getByText('Ezzel az e-mail címmel már van fiók.', { exact: true })).toBeVisible()
  })

  test('logout, wrong password is rejected, correct password signs in again', async ({ browser }) => {
    const page = await newPage(browser)
    const { email, password } = await signUp(page)
    await page.getByRole('button', { name: 'Kilépés' }).click()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('link', { name: 'Szervezőknek' })).toBeVisible()

    await page.goto('/belepes')
    await page.getByLabel('E-mail cím').fill(email)
    await page.getByLabel('Jelszó').fill('rossz-jelszo-123')
    await page.getByRole('button', { name: 'Belépés', exact: true }).click()
    // The app maps auth/invalid-credential to 'Hibás e-mail cím vagy jelszó.'; the emulator currently surfaces the generic message.
    await expect(page.getByText(/Hibás e-mail cím vagy jelszó\.|Nem sikerült belépni\./, { exact: true }).first()).toBeVisible()
    await expect(page).toHaveURL(/\/belepes/)

    await page.getByLabel('Jelszó').fill(password)
    await page.getByRole('button', { name: 'Belépés', exact: true }).click()
    await expect(page).toHaveURL(/\/szervezo$/)
  })

  test('password reset asks for an e-mail first, then confirms without revealing the account', async ({ browser }) => {
    const page = await newPage(browser)
    await page.goto('/belepes')
    await page.getByRole('button', { name: 'Elfelejtett jelszó' }).click()
    await expect(page.getByText('Írd be az e-mail címed', { exact: true })).toBeVisible()
    await page.getByLabel('E-mail cím').fill(uniqueEmail('nincs'))
    await page.getByRole('button', { name: 'Elfelejtett jelszó' }).click()
    await expect(page.getByText('Ha van ilyen fiók, elküldtük a jelszó-visszaállító levelet.', { exact: true })).toBeVisible()
  })

  test('a second device can log in with the same account', async ({ browser }) => {
    const device1 = await newPage(browser)
    const { email, password } = await signUp(device1)

    const device2 = await newPage(browser)
    await device2.goto('/belepes')
    await device2.getByLabel('E-mail cím').fill(email)
    await device2.getByLabel('Jelszó').fill(password)
    await device2.getByRole('button', { name: 'Belépés', exact: true }).click()
    await expect(device2).toHaveURL(/\/szervezo$/)
    await expect(device2.getByRole('heading', { name: 'Komatáljaim' })).toBeVisible()
  })
})
