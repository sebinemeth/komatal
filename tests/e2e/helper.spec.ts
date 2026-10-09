import { expect, test } from '@playwright/test'
import { createKomatal, join, markBorn, newPage, reserve, signUp } from './helpers'

test.describe('helper experience', () => {
  test('unknown komatál id shows not-found', async ({ browser }) => {
    const page = await newPage(browser)
    await page.goto('/k/nincsilyenid#abcd-abcd-abcd')
    await expect(page.getByText('Ez a komatál nem található')).toBeVisible()
  })

  test('without the password in the link the helper must type it; wrong then right', async ({ browser }) => {
    const org = await newPage(browser)
    await signUp(org)
    const link = await createKomatal(org, 'Jelszavas család')
    const [url, pw] = link.split('#')

    const helper = await newPage(browser)
    await helper.goto(url)
    await expect(helper.getByText('Írd be a meghívóban kapott jelszót.')).toBeVisible()
    await helper.getByPlaceholder('xxxx-xxxx-xxxx').fill('rossz-rossz-rossz')
    await helper.getByRole('button', { name: 'Megnyitás' }).click()
    await expect(helper.getByText('Ez a jelszó nem jó')).toBeVisible()
    await helper.getByPlaceholder('xxxx-xxxx-xxxx').fill(pw)
    await helper.getByRole('button', { name: 'Megnyitás' }).click()
    await expect(helper.getByText('Csatlakozom segítőnek')).toBeVisible()
  })

  test('wrong password in the link falls back to the password prompt', async ({ browser }) => {
    const org = await newPage(browser)
    await signUp(org)
    const link = await createKomatal(org)
    const helper = await newPage(browser)
    await helper.goto(link.split('#')[0] + '#xxxx-xxxx-xxxx')
    await expect(helper.getByText('Írd be a meghívóban kapott jelszót.')).toBeVisible()
  })

  test('join form needs a name and a phone or e-mail', async ({ browser }) => {
    const org = await newPage(browser)
    await signUp(org)
    const link = await createKomatal(org)
    const helper = await newPage(browser)
    await helper.goto(link)
    const submit = helper.getByRole('button', { name: 'Feliratkozom' })
    await expect(submit).toBeDisabled()
    await helper.getByLabel('Neved').fill('Fanni')
    await expect(submit).toBeDisabled()
    await helper.getByLabel('Telefonszám').fill('+36 20 555 1234')
    await expect(submit).toBeEnabled()
  })

  test('helper can edit their data and the choice to remember the device persists', async ({ browser }) => {
    const org = await newPage(browser)
    await signUp(org)
    const link = await createKomatal(org)
    const helper = await newPage(browser)
    await join(helper, link, 'Gabi')
    await helper.getByRole('button', { name: 'Megjegyzem' }).click()
    await helper.getByRole('button', { name: 'Adataim módosítása' }).click()
    await helper.getByLabel('Neved').fill('Gabriella')
    await helper.getByLabel('Telefonszám').fill('+36 30 999 8888')
    await helper.getByRole('button', { name: 'Mentés' }).click()
    await expect(helper.getByText('A várólistán vagy, Gabriella')).toBeVisible()

    // remembered on this device: reopening without the hash still works
    await helper.goto(link.split('#')[0])
    await expect(helper.getByText('A várólistán vagy, Gabriella')).toBeVisible()
    await org.getByRole('tab', { name: 'Naptár' }).click()
    await expect(org.getByText('+36 30 999 8888')).toBeVisible()
  })

  test('before the baby is born there are no days to pick', async ({ browser }) => {
    const org = await newPage(browser)
    await signUp(org)
    const link = await createKomatal(org)
    const helper = await newPage(browser)
    await join(helper, link, 'Hanna')
    await expect(helper.getByRole('heading', { name: 'Válassz napot' })).toHaveCount(0)
    await expect(helper.getByRole('button', { name: 'Vállalom' })).toHaveCount(0)
  })

  test('private details stay hidden until a day is reserved, and hide again after giving it back', async ({ browser }) => {
    const org = await newPage(browser)
    await signUp(org)
    const link = await createKomatal(org, 'Rejtett család', { address: 'Szeged, Titkos tér 9.', allergies: 'Mogyoró' })
    const helper = await newPage(browser)
    await join(helper, link, 'Ilona')
    await markBorn(org)

    await helper.getByText('Válassz napot').first().waitFor()
    await expect(helper.getByText('Szeged, Titkos tér 9.')).toHaveCount(0)
    await expect(helper.getByText('a cím, az allergiák', { exact: false })).toBeVisible()

    await reserve(helper, 'Lecsó')
    await expect(helper.getByText('Tudnivalók a vállalt napra')).toBeVisible()
    await expect(helper.getByText('Szeged, Titkos tér 9.')).toBeVisible()
    await expect(helper.getByText('Mogyoró')).toBeVisible()

    await helper.getByRole('button', { name: 'Lemondom' }).click()
    await expect(helper.getByText('Lecsó')).toHaveCount(0)
    await expect(helper.getByText('Szeged, Titkos tér 9.')).toHaveCount(0)
  })

  test('two helpers cannot take the same day', async ({ browser }) => {
    const org = await newPage(browser)
    await signUp(org)
    const link = await createKomatal(org)
    const a = await newPage(browser)
    const b = await newPage(browser)
    await join(a, link, 'Aranka')
    await join(b, link, 'Bori')
    await markBorn(org)
    await a.getByText('Válassz napot').first().waitFor()
    await b.getByText('Válassz napot').first().waitFor()

    // both open the first free day, A reserves first
    await a.getByRole('button', { name: 'Vállalom' }).first().click()
    await b.getByRole('button', { name: 'Vállalom' }).first().click()
    await a.getByPlaceholder('pl. Pörkölt galuskával').fill('Pörkölt')
    await a.getByRole('button', { name: 'Foglalás', exact: true }).click()
    await a.getByText('(te)').waitFor()

    await b.getByPlaceholder('pl. Pörkölt galuskával').fill('Gulyás')
    await b.getByRole('button', { name: 'Foglalás', exact: true }).click()
    await expect(b.getByText('Ezt a napot épp most más foglalta le')).toBeVisible()
    await expect(b.getByText('Pörkölt')).toBeVisible()
    await expect(b.getByText('Gulyás')).toHaveCount(0)
  })

  test('a helper only sees reservation notes on their own day', async ({ browser }) => {
    const org = await newPage(browser)
    await signUp(org)
    const link = await createKomatal(org)
    const a = await newPage(browser)
    const b = await newPage(browser)
    await join(a, link, 'Aranka')
    await join(b, link, 'Bori')
    await markBorn(org)
    await a.getByText('Válassz napot').first().waitFor()
    await reserve(a, 'Rántott hús', 'Titkos érkezési idő 17:45')
    await expect(a.getByText('Titkos érkezési idő 17:45')).toBeVisible()
    await b.getByText('Rántott hús').waitFor()
    await expect(b.getByText('Titkos érkezési idő 17:45')).toHaveCount(0)
  })

  test('helper sees the closing notice and no day list once closed', async ({ browser }) => {
    const org = await newPage(browser)
    await signUp(org)
    const link = await createKomatal(org)
    const helper = await newPage(browser)
    await join(helper, link, 'Lili')
    await markBorn(org)
    await helper.getByText('Válassz napot').first().waitFor()
    await org.getByRole('tab', { name: 'Beállítások' }).click()
    await org.getByRole('button', { name: 'Komatál lezárása' }).first().click()
    await org.getByRole('button', { name: 'Közzététel és lezárás' }).click()
    await expect(helper.getByText('Ez a komatál lezárult')).toBeVisible()
    await expect(helper.getByRole('heading', { name: 'Válassz napot' })).toHaveCount(0)
    await expect(helper.getByRole('button', { name: 'Vállalom' })).toHaveCount(0)
  })

  test('hidden-name helper is shown with an alias to other helpers but real name to the organiser', async ({ browser }) => {
    const org = await newPage(browser)
    await signUp(org)
    const link = await createKomatal(org)
    const shy = await newPage(browser)
    await shy.goto(link)
    await shy.getByLabel('Neved').fill('Szende Szilvia')
    await shy.getByLabel('Telefonszám').fill('+36 70 111 2222')
    await shy.getByText('A nevem látszódjon a többi segítőnek').click()
    await shy.getByRole('button', { name: 'Feliratkozom' }).click()
    await shy.getByText('A várólistán vagy').waitFor()
    await expect(shy.getByText('Szende Szilvia')).toHaveCount(0)

    await org.getByRole('tab', { name: 'Naptár' }).click()
    await expect(org.getByText('Szende Szilvia')).toBeVisible()
  })
})
