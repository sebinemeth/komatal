// Notifications and reminders. Messages only carry the family name and generic text:
// all personal content is encrypted and unreadable here.
const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore')
const { onSchedule } = require('firebase-functions/v2/scheduler')
const { initializeApp } = require('firebase-admin/app')
const { FieldValue, getFirestore } = require('firebase-admin/firestore')
const { getMessaging } = require('firebase-admin/messaging')

initializeApp()
const db = getFirestore()

// Must be close to the Firestore database location (europe-west1 suits an eur3 database).
const REGION = 'europe-west1'
const SITE = 'https://komatal.web.app'
const TIMEZONE = 'Europe/Budapest'

/**
 * Sends a message to helpers of a komatál by email (via the `mail` collection, read by the
 * "Trigger Email" extension) and push. `uids` null means everyone with a notification address.
 */
async function notify(komatalId, uids, { title, body }) {
  const base = db.collection('komatals').doc(komatalId).collection('private')
  const snaps = uids ? await Promise.all(uids.map((u) => base.doc(u).get())) : (await base.get()).docs
  const url = `${SITE}/k/${komatalId}`
  const tokens = []
  const batch = db.batch()
  let mails = 0

  for (const s of snaps) {
    if (!s.exists) continue
    const p = s.data()
    if (p.emailOptIn && p.email) {
      batch.set(db.collection('mail').doc(), {
        to: [p.email],
        message: {
          subject: title,
          text: `${body}\n\n${url}\n`,
          html: `<p>${body}</p><p><a href="${url}">Megnyitás</a></p>`,
        },
      })
      mails++
    }
    for (const t of p.pushTokens || []) tokens.push({ token: t, ref: s.ref })
  }
  if (mails) await batch.commit()

  for (let i = 0; i < tokens.length; i += 500) {
    const chunk = tokens.slice(i, i + 500)
    const res = await getMessaging().sendEachForMulticast({
      tokens: chunk.map((c) => c.token),
      notification: { title, body },
      data: { url },
      webpush: { fcmOptions: { link: url } },
    })
    // Drop tokens that are no longer valid.
    await Promise.all(
      res.responses.map((r, idx) =>
        !r.success && /registration-token-not-registered|invalid-argument|invalid-registration/.test(r.error?.code || '')
          ? chunk[idx].ref.update({ pushTokens: FieldValue.arrayRemove(chunk[idx].token) })
          : null,
      ),
    )
  }
}

/** The baby is born, or the komatál is closed. */
exports.onStatusChange = onDocumentUpdated({ document: 'komatals/{id}', region: REGION }, async (event) => {
  const before = event.data.before.data()
  const after = event.data.after.data()
  if (before.status === after.status) return
  const id = event.params.id

  if (after.status === 'active') {
    await notify(id, null, { title: `${after.name}: megszületett a baba`, body: 'Megnyílt a komatál, válassz napot!' })
  } else if (after.status === 'closed') {
    const reserved = await db.collection('komatals').doc(id).collection('slots').where('status', '==', 'reserved').get()
    const withDays = [...new Set(reserved.docs.map((d) => d.data().reservedBy).filter(Boolean))]
    const everyone = (await db.collection('komatals').doc(id).collection('private').get()).docs.map((d) => d.id)
    const others = everyone.filter((u) => !withDays.includes(u))
    await Promise.all([
      notify(id, others, { title: `${after.name}: a komatál lezárult`, body: 'Köszönjük a segítséget!' }),
      notify(id, withDays, {
        title: `${after.name}: a komatál lezárult`,
        body: 'Van még foglalásod, kérjük egyeztess a szervezővel.',
      }),
    ])
  }
})

/** A new post in the feed (the birth and closing posts are covered above). */
exports.onNewPost = onDocumentCreated({ document: 'komatals/{id}/posts/{pid}', region: REGION }, async (event) => {
  if (event.data.data().kind !== 'post') return
  const k = await db.collection('komatals').doc(event.params.id).get()
  if (!k.exists) return
  await notify(event.params.id, null, { title: `${k.data().name}: új hír`, body: 'Nézd meg, mi újság a komatálban.' })
})

/** Day-before reminder at 18:00 Hungarian time. */
exports.dayBeforeReminder = onSchedule({ schedule: '0 18 * * *', timeZone: TIMEZONE, region: REGION }, async () => {
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: TIMEZONE }).format(new Date())
  const [y, m, d] = today.split('-').map(Number)
  const tomorrow = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10)

  const slots = await db.collectionGroup('slots').where('date', '==', tomorrow).get()
  const byKomatal = new Map()
  for (const s of slots.docs) {
    const data = s.data()
    if (data.status !== 'reserved' || !data.reservedBy) continue
    const id = s.ref.parent.parent.id
    byKomatal.set(id, [...(byKomatal.get(id) || []), data.reservedBy])
  }
  for (const [id, uids] of byKomatal) {
    const k = await db.collection('komatals').doc(id).get()
    if (!k.exists || k.data().status !== 'active') continue
    await notify(id, [...new Set(uids)], {
      title: `Holnap te hozod a komatált (${k.data().name})`,
      body: 'Köszönjük! A részleteket megtalálod a komatálban.',
    })
  }
})
