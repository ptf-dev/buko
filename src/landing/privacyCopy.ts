import { CONTACT_EMAIL, LEGAL_ENTITY } from '../config'
import type { Lang } from './i18n'

/**
 * Privacy policy text. It must describe what the code actually does:
 * update it whenever data handling changes (new analytics, payments, push notifications…).
 */
export const PRIVACY_UPDATED: Record<Lang, string> = { sq: '27 shtator 2026', en: '27 September 2026' }

export interface PolicySection {
  id: string
  title: string
  paragraphs?: string[]
  bullets?: string[]
  after?: string[]
}

const sq: { title: string; intro: string; updated: string; back: string; contents: string; sections: PolicySection[] } = {
  title: 'Politika e privatësisë',
  updated: 'Përditësuar më',
  back: 'Kthehu në faqen kryesore',
  contents: 'Përmbajtja',
  intro: `Kjo politikë shpjegon cilat të dhëna mbledh Ngopu (aplikacioni, faqja web dhe paneli për partnerët), pse i mbledhim dhe si mund t’i kontrollosh. Shkurt: mbledhim vetëm atë që duhet për të rezervuar dhe marrë ushqimin, nuk shesim të dhëna dhe nuk përdorim reklama apo gjurmues.`,
  sections: [
    {
      id: 'who',
      title: 'Kush jemi',
      paragraphs: [
        `Shërbimin e ofron ${LEGAL_ENTITY} („ne”), me bazë në Tiranë, Shqipëri, dhe është përgjegjës për të dhënat e përshkruara këtu. Për çdo pyetje ose kërkesë rreth të dhënave: ${CONTACT_EMAIL}.`,
      ],
    },
    {
      id: 'customers',
      title: 'Të dhënat e klientëve (aplikacioni)',
      paragraphs: ['Mund t’i shfletosh dyqanet pa llogari. Për të rezervuar krijon një llogari, dhe në serverin tonë ruhen:'],
      bullets: [
        'Llogaria: emri, emaili dhe fjalëkalimi, ky i fundit vetëm në formë të enkriptuar në mënyrë të pakthyeshme (scrypt). Ne nuk e shohim dot fjalëkalimin tënd.',
        'Një identifikues i rastësishëm i pajisjes, i krijuar nga aplikacioni. Nuk përmban numrin e telefonit apo ndonjë ID të pajisjes nga prodhuesi.',
        'Porosia: dyqani, çanta, sasia, çmimi, orari i marrjes, kodi i marrjes, mënyra e pagesës që zgjodhe (p.sh. „kartë”) dhe statusi (e rezervuar, e marrë, e anuluar).',
        'Vlerësimi që i jep çantës (1–5 yje dhe etiketat që zgjedh), nëse vendos ta japësh.',
        'Një ankesë që dërgon për një çantë (arsyeja dhe përshkrimi yt), si dhe vendimi dhe rimbursimi. Dyqani sheh ankesën, por jo emailin tënd.',
      ],
      after: [
        'Këto qëndrojnë vetëm në pajisjen tënde dhe nuk dërgohen te ne: preferencat e dietës, të preferuarat dhe zona që zgjedh.',
        'Vendndodhja: nëse e lejon, pajisja e përdor vendndodhjen për të treguar dyqanet pranë teje. Llogaritja bëhet në pajisje dhe vendndodhja jote nuk dërgohet në serverët tanë.',
        'Pagesat: gjatë fazës beta pagesat janë simuluar dhe nuk mbledhim të dhëna karte. Kur të nisin pagesat e vërteta, ato do të përpunohen nga një ofrues pagesash dhe kjo politikë do të përditësohet para se të ndodhë.',
      ],
    },
    {
      id: 'partners',
      title: 'Të dhënat e partnerëve (paneli për dyqanet)',
      paragraphs: ['Kur një dyqan aplikon ose përdor panelin, ruajmë:'],
      bullets: [
        'Emrin e personit të kontaktit, emailin, numrin e telefonit (opsional) dhe mesazhin e aplikimit.',
        'Të dhënat e dyqanit: emrin, llojin, adresën, vendndodhjen në hartë dhe informacionin e Çantës Surprizë. Këto shfaqen publikisht në aplikacion pasi dyqani miratohet.',
        'Fjalëkalimin, vetëm në formë të enkriptuar në mënyrë të pakthyeshme (scrypt). Ne nuk e shohim dot fjalëkalimin tënd.',
        'Të dhënat për pagesat: emrin ligjor të biznesit, NIPT-in dhe IBAN-in, shitjet, komisionet, pagesat e bëra dhe faturat, të cilat ruhen sa kërkon ligji për kontabilitetin.',
        'Kohën e hyrjeve të fundit dhe një cookie sesioni që të mban të kyçur.',
      ],
    },
    {
      id: 'why',
      title: 'Pse i përdorim',
      bullets: [
        'Për të ofruar shërbimin: rezervimin, kontrollin e kodit në dyqan, anulimet dhe historinë e porosive (përmbushja e kontratës me ty).',
        'Për të menaxhuar partnerët: shqyrtimin e aplikimeve dhe funksionimin e panelit.',
        'Për siguri dhe për të parandaluar abuzimet (interes legjitim).',
      ],
      after: ['Nuk i shesim të dhënat, nuk shfaqim reklama dhe nuk përdorim analitika apo gjurmues nga palë të treta.'],
    },
    {
      id: 'cookies',
      title: 'Cookies dhe ruajtja në pajisje',
      paragraphs: [
        'Paneli për partnerët përdor një cookie të vetme të domosdoshme (sesioni i hyrjes). Aplikacioni për klientët ruan në memorien e pajisjes tënde sesionin e hyrjes, preferencat dhe porositë. Nuk përdorim cookies reklamash.',
      ],
    },
    {
      id: 'providers',
      title: 'Ofruesit që na ndihmojnë',
      paragraphs: ['Përdorim këta ofrues për ta mbajtur shërbimin në punë. Ata i përpunojnë të dhënat vetëm sipas udhëzimeve tona:'],
      bullets: [
        'Vercel: hostimi i faqes dhe i serverit.',
        'Neon: baza e të dhënave (Postgres).',
        'OpenStreetMap: pllakat e hartës. Serverët e tyre marrin adresën IP të pajisjes kur ngarkohet harta.',
        'Google Fonts: shkronjat e faqes. Google merr adresën IP kur ngarkohen shkronjat.',
      ],
      after: ['Disa nga këta ofrues mund t’i përpunojnë të dhënat jashtë Shqipërisë, me masat mbrojtëse që kërkon ligji.'],
    },
    {
      id: 'retention',
      title: 'Sa kohë i mbajmë',
      bullets: [
        'Porositë: deri në 3 vjet pas porosisë, për llogaritë dhe mosmarrëveshjet, pastaj fshihen ose anonimizohen.',
        'Llogaritë e klientëve dhe të partnerëve: për sa kohë llogaria është aktive, ose derisa ta fshish.',
        'Sesionet e hyrjes: skadojnë pas 30 ditësh në panel dhe pas 180 ditësh në aplikacion.',
      ],
    },
    {
      id: 'rights',
      title: 'Të drejtat e tua',
      paragraphs: [
        `Ke të drejtë të kërkosh qasje, korrigjim, fshirje ose transferim të të dhënave të tua, si dhe të kundërshtosh përpunimin. Na shkruaj në ${CONTACT_EMAIL} dhe do të përgjigjemi brenda 30 ditëve.`,
        'Ke gjithashtu të drejtë të ankohesh te Komisioneri për të Drejtën e Informimit dhe Mbrojtjen e të Dhënave Personale (idp.al).',
      ],
    },
    {
      id: 'delete',
      title: 'Si t’i fshish të dhënat',
      bullets: [
        'Klientët: te Profili → „Delete account” fshin menjëherë emrin, emailin dhe fjalëkalimin. Porositë e kaluara mbeten për dokumentet e dyqaneve, por pa asnjë lidhje me ty apo me pajisjen tënde. Mund ta kërkosh fshirjen edhe me email nga adresa e llogarisë.',
        'Fshirja e aplikacionit ose e të dhënave të tij heq gjithçka që ruhet në pajisje.',
        `Partnerët: shkruaj nga emaili i llogarisë në ${CONTACT_EMAIL} dhe do ta fshijmë llogarinë dhe dyqanin.`,
      ],
    },
    {
      id: 'children',
      title: 'Fëmijët',
      paragraphs: ['Ngopu nuk u drejtohet fëmijëve nën 16 vjeç dhe nuk mbledhim me dijeni të dhëna prej tyre.'],
    },
    {
      id: 'security',
      title: 'Siguria',
      paragraphs: [
        'Të gjitha lidhjet janë të enkriptuara (HTTPS), fjalëkalimet ruhen vetëm në formë të enkriptuar dhe qasja në bazën e të dhënave është e kufizuar te ekipi i Ngopu.',
      ],
    },
    {
      id: 'changes',
      title: 'Ndryshimet',
      paragraphs: [
        'Nëse e ndryshojmë këtë politikë, do të përditësojmë datën në krye dhe, për ndryshime të rëndësishme, do të të njoftojmë në aplikacion ose në panel.',
      ],
    },
  ],
}

const en: typeof sq = {
  title: 'Privacy policy',
  updated: 'Last updated',
  back: 'Back to the home page',
  contents: 'Contents',
  intro: `This policy explains what data Ngopu (the app, the website and the partner dashboard) collects, why, and how you can control it. In short: we collect only what’s needed to reserve and collect food, we don’t sell data, and we don’t use ads or trackers.`,
  sections: [
    {
      id: 'who',
      title: 'Who we are',
      paragraphs: [
        `The service is provided by ${LEGAL_ENTITY} (“we”), based in Tirana, Albania, which is responsible for the data described here. For any question or request about your data: ${CONTACT_EMAIL}.`,
      ],
    },
    {
      id: 'customers',
      title: 'Customer data (the app)',
      paragraphs: ['You can browse stores without an account. To reserve, you create one, and our server stores:'],
      bullets: [
        'Your account: name, email and password, the password only as a one-way hash (scrypt). We can’t see your password.',
        'A random device identifier created by the app. It contains no phone number or manufacturer device ID.',
        'The order: store, bag, quantity, price, pickup window, pickup code, the payment method you chose (e.g. “card”) and its status (reserved, collected, cancelled).',
        'The rating you give the bag (1–5 stars and the tags you pick), if you choose to rate it.',
        'A complaint you send about a bag (the reason and your description), and the decision and any refund. The store sees the complaint, not your email.',
      ],
      after: [
        'These stay only on your device and are not sent to us: diet preferences, favourites and the area you choose.',
        'Location: if you allow it, your device uses your location to show nearby stores. The calculation happens on the device and your location is not sent to our servers.',
        'Payments: during the beta, payments are simulated and we collect no card data. When real payments start, they will be handled by a payment provider and this policy will be updated before that happens.',
      ],
    },
    {
      id: 'partners',
      title: 'Partner data (the store dashboard)',
      paragraphs: ['When a store applies or uses the dashboard, we store:'],
      bullets: [
        'The contact person’s name, email, phone number (optional) and application message.',
        'Store details: name, type, address, map location and Surprise Bag information. These are shown publicly in the app once the store is approved.',
        'The password, only as a one-way hash (scrypt). We can’t see your password.',
        'Payout details: the business’s legal name, NIPT and IBAN, plus sales, commission, payouts and invoices, kept as long as accounting law requires.',
        'Recent login times and a session cookie that keeps you signed in.',
      ],
    },
    {
      id: 'why',
      title: 'Why we use it',
      bullets: [
        'To provide the service: reservations, pickup-code checks at the store, cancellations and order history (performance of our contract with you).',
        'To manage partners: reviewing applications and running the dashboard.',
        'For security and to prevent abuse (legitimate interest).',
      ],
      after: ['We don’t sell data, show ads or use third-party analytics or trackers.'],
    },
    {
      id: 'cookies',
      title: 'Cookies and on-device storage',
      paragraphs: [
        'The partner dashboard uses a single essential cookie (the login session). The customer app keeps your login session, preferences and orders in your device’s storage. We don’t use advertising cookies.',
      ],
    },
    {
      id: 'providers',
      title: 'Providers that help us',
      paragraphs: ['We use these providers to run the service. They process data only on our instructions:'],
      bullets: [
        'Vercel: website and server hosting.',
        'Neon: database (Postgres).',
        'OpenStreetMap: map tiles. Their servers receive your device’s IP address when the map loads.',
        'Google Fonts: website fonts. Google receives your IP address when fonts load.',
      ],
      after: ['Some of these providers may process data outside Albania, with the safeguards required by law.'],
    },
    {
      id: 'retention',
      title: 'How long we keep it',
      bullets: [
        'Orders: up to 3 years after the order, for accounting and disputes, then deleted or anonymised.',
        'Customer and partner accounts: as long as the account is active, or until you delete it.',
        'Login sessions: expire after 30 days on the dashboard and 180 days in the app.',
      ],
    },
    {
      id: 'rights',
      title: 'Your rights',
      paragraphs: [
        `You can ask to access, correct, delete or transfer your data, and object to its processing. Write to ${CONTACT_EMAIL} and we’ll reply within 30 days.`,
        'You can also complain to Albania’s Information and Data Protection Commissioner (idp.al).',
      ],
    },
    {
      id: 'delete',
      title: 'How to delete your data',
      bullets: [
        'Customers: Profile → “Delete account” erases your name, email and password immediately. Past orders stay for the stores’ records but are no longer linked to you or your device. You can also ask by email from your account address.',
        'Deleting the app or its data removes everything stored on your device.',
        `Partners: email ${CONTACT_EMAIL} from your account email and we’ll delete the account and store.`,
      ],
    },
    {
      id: 'children',
      title: 'Children',
      paragraphs: ['Ngopu is not directed at children under 16, and we don’t knowingly collect their data.'],
    },
    {
      id: 'security',
      title: 'Security',
      paragraphs: [
        'All connections are encrypted (HTTPS), passwords are stored only as hashes, and database access is limited to the Ngopu team.',
      ],
    },
    {
      id: 'changes',
      title: 'Changes',
      paragraphs: [
        'If we change this policy, we’ll update the date at the top and, for significant changes, let you know in the app or the dashboard.',
      ],
    },
  ],
}

export const PRIVACY_COPY: Record<Lang, typeof sq> = { sq, en }
export const PRIVACY_TITLES: Record<Lang, { title: string; description: string }> = {
  sq: { title: 'Politika e privatësisë – Ngopu', description: 'Si i mbledh, përdor dhe mbron të dhënat Ngopu.' },
  en: { title: 'Privacy policy – Ngopu', description: 'How Ngopu collects, uses and protects data.' },
}
