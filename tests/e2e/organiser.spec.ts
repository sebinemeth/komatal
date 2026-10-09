import { expect, test } from '@playwright/test'
import { createKomatal, join, markBorn, newPage, reserve, signUp } from './helpers'

test.describe('organiser komatál management', () => {
  test('dashboard lists the created komatál with its status and opens it', async ({ browser }) => {
    const org = await newPage(browser)
    await signUp(org)
    await createKomatal(org, 'Nagy család')
    await org.goto('/szervezo')
    const card = org.getByRole('link', { name: /Nagy család/ })
    await expect(card).toBeVisible()
    await expect(card).toContainText('Várakozik')
    await card.click()
    await expect(org.getByRole('heading', { name: 'Nagy család' })).toBeVisible()
  })

  test('create form requires a name', async ({ browser }) => {
    const org = await newPage(browser)
    await signUp(org)
    await org.goto('/uj')
    await org.getByRole('button', { name: 'Létrehozás' }).click()
    await expect(org).toHaveURL(/\/uj$/)
  })

  test('invite tab shows link and password that match', async ({ browser }) => {
    const org = await newPage(browser)
    await signUp(org)
    const link = await createKomatal(org)
    const pw = link.split('#')[1]
    expect(pw).toMatch(/^[a-z0-9]{4}(-[a-z0-9]{4})+$/i)
    await expect(org.getByText('Jelszó', { exact: true })).toBeVisible()
    await expect(org.getByRole('button', { name: pw })).toBeVisible()
  })

  test('organiser reopens the komatál later without typing the password', async ({ browser }) => {
    const org = await newPage(browser)
    await signUp(org)
    await createKomatal(org, 'Emlékező család')
    await org.goto('/szervezo')
    await org.getByRole('link', { name: /Emlékező család/ }).click()
    await expect(org.getByRole('button', { name: 'Baba megszületett' }).first()).toBeVisible()
    await org.getByRole('tab', { name: 'Meghívó' }).click()
    await expect(org.getByText('Meghívó link')).toBeVisible()
  })

  test('empty wait list message, then a helper appears and can be removed', async ({ browser }) => {
    const org = await newPage(browser)
    await signUp(org)
    const link = await createKomatal(org)
    await org.getByRole('tab', { name: 'Naptár' }).click()
    await expect(org.getByText('Még senki nem csatlakozott.')).toBeVisible()

    const helper = await newPage(browser)
    await join(helper, link, 'Csilla', { email: 'csilla@example.hu' })
    await expect(org.getByText('Várólista és segítők (1)')).toBeVisible()
    await expect(org.getByText('csilla@example.hu')).toBeVisible()

    await org.getByRole('button', { name: 'Törlés a várólistáról' }).click()
    await expect(org.getByText('Még senki nem csatlakozott.')).toBeVisible()
  })

  test('extending the schedule adds days', async ({ browser }) => {
    const org = await newPage(browser)
    await signUp(org)
    await createKomatal(org)
    await markBorn(org)
    await org.getByRole('tab', { name: 'Naptár' }).click()
    await expect(org.getByText('12. nap')).toBeVisible()
    await expect(org.getByText('13. nap')).toHaveCount(0)
    await org.getByRole('tab', { name: 'Beállítások' }).click()
    await expect(org.getByText('Új napok (most 12, legfeljebb')).toBeVisible()
    await org.getByRole('button', { name: 'Hozzáadás' }).click()
    await expect(org.getByText('Új napok (most 15, legfeljebb')).toBeVisible()
    await org.getByRole('tab', { name: 'Naptár' }).click()
    await expect(org.getByText('15. nap')).toBeVisible()
  })

  test('organiser can release a helper\'s reserved day', async ({ browser }) => {
    const org = await newPage(browser)
    await signUp(org)
    const link = await createKomatal(org)
    const helper = await newPage(browser)
    await join(helper, link, 'Dóra')
    await markBorn(org)
    await helper.getByText('Válassz napot').first().waitFor()
    await reserve(helper, 'Töltött káposzta')

    await org.getByRole('tab', { name: 'Naptár' }).click()
    await expect(org.getByText('Töltött káposzta')).toBeVisible()
    await org.getByRole('button', { name: 'Felszabadítás' }).click()
    await expect(org.getByText('Töltött káposzta')).toHaveCount(0)
    await expect(helper.getByText('Töltött káposzta')).toHaveCount(0)
  })

  test('feed: organiser post is visible to helpers; empty post cannot be sent', async ({ browser }) => {
    const org = await newPage(browser)
    await signUp(org)
    const link = await createKomatal(org)
    const helper = await newPage(browser)
    await join(helper, link, 'Edit')

    await org.getByRole('tab', { name: 'Hírek' }).click()
    await expect(org.getByRole('button', { name: 'Közzététel' }).last()).toBeDisabled()
    await org.getByPlaceholder('Mi újság?').fill('Minden rendben, köszönjük!')
    await org.getByRole('button', { name: 'Közzététel' }).last().click()
    await expect(helper.getByText('Minden rendben, köszönjük!')).toBeVisible()
  })

  test('closing hides the composer and the day actions', async ({ browser }) => {
    const org = await newPage(browser)
    await signUp(org)
    await createKomatal(org)
    await markBorn(org)
    await org.getByRole('tab', { name: 'Beállítások' }).click()
    await org.getByRole('button', { name: 'Komatál lezárása' }).first().click()
    await org.getByRole('button', { name: 'Közzététel és lezárás' }).click()
    await expect(org.getByText('Lezárt komatál')).toBeVisible()
    await org.getByRole('tab', { name: 'Hírek' }).click()
    await expect(org.getByPlaceholder('Mi újság?')).toHaveCount(0)
    await org.goto('/szervezo')
    await expect(org.getByText('Lezárva')).toBeVisible()
  })
})
