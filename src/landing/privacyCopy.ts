import { CONTACT_EMAIL, LEGAL_ADDRESS, LEGAL_ENTITY } from '../config'
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
        `Shërbimin e ofron ${LEGAL_ENTITY} („ne”), ${LEGAL_ADDRESS}, dhe është përgjegjës për të dhënat e përshkruara këtu. Për çdo pyetje ose kërkesë rreth të dhënave: ${CONTACT_EMAIL}.`,
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
        'Gjuhën e aplikacionit dhe nëse e ke konfirmuar emailin, që të të dërgojmë faturat, lidhjet për fjalëkalimin dhe njoftimet për porositë në gjuhën tënde.',
        'Nëse aktivizon kujtesat e marrjes: adresën e njoftimeve të shfletuesit ose të telefonit. E fshin kur i çaktivizon ose fshin llogarinë.',
      ],
      after: [
        'Këto qëndrojnë vetëm në pajisjen tënde dhe nuk dërgohen te ne: preferencat e dietës, të preferuarat, zona që zgjedh dhe vendet e ruajtura (Shtëpia, Puna).',
        'Vendndodhja: nëse e lejon, pajisja e përdor vendndodhjen për të treguar dyqanet pranë teje. Llogaritja bëhet në pajisje dhe vendndodhja jote nuk dërgohet në serverët tanë.',
        'Pagesat me kartë i përpunon POK (pokpay.io). Të dhënat e kartës i fut në formularin e POK dhe nuk kalojnë kurrë nga serverët tanë; ne ruajmë vetëm numrin e porosisë te POK, shumën dhe statusin e pagesës.',
        'Statistika anonime dhe raporte gabimesh: aplikacioni dërgon te serverët tanë ngjarje si „hapi aplikacionin” ose „bëri një porosi”, me një identifikues të rastësishëm që ndryshon sa herë hapet aplikacioni, pa llogarinë, emailin apo adresën IP. Kur aplikacioni prishet, dërgohet mesazhi i gabimit dhe lloji i shfletuesit.',
      ],
    },
    {
      id: 'partners',
      title: 'Të dhënat e partnerëve (paneli për dyqanet)',
      paragraphs: ['Kur një dyqan aplikon ose përdor panelin, ruajmë:'],
      bullets: [
        'Emrin e personit të kontaktit, emailin, numrin e telefonit (opsional) dhe mesazhin e aplikimit.',
        'Të dhënat e dyqanit: emrin, llojin, adresën, vendndodhjen në hartë, foton e dyqanit dhe informacionin e Çantës Surprizë. Këto shfaqen publikisht në aplikacion pasi dyqani miratohet.',
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
      after: ['Nuk i shesim të dhënat dhe nuk shfaqim reklama. Statistikat dhe raportet e gabimeve janë anonime, ruhen në serverët tanë dhe nuk përdorim analitika apo gjurmues nga palë të treta.'],
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
        'Photon (komoot): kërkimi i adresave te zgjedhja e vendndodhjes. Merr tekstin që shkruan dhe adresën IP, vetëm kur kërkon një adresë.',
        'Google Fonts: shkronjat e faqes. Google merr adresën IP kur ngarkohen shkronjat.',
        'POK (pokpay.io): pagesat me kartë dhe rimbursimet.',
        'Ofruesi ynë i emailit: dërgon emailet e llogarisë dhe faturat.',
        'Shërbimet e njoftimeve të shfletuesit dhe të telefonit (p.sh. Google, Apple, Mozilla): dërgojnë kujtesat e marrjes, vetëm nëse i aktivizon.',
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
        'Statistikat anonime: 13 muaj. Raportet e gabimeve: 90 ditë pasi rregullohen.',
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
        `The service is provided by ${LEGAL_ENTITY} (“we”), ${LEGAL_ADDRESS}, which is responsible for the data described here. For any question or request about your data: ${CONTACT_EMAIL}.`,
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
        'Your app language and whether you confirmed your email, so receipts, password links and order updates reach you in your language.',
        'If you turn on pickup reminders: your browser’s or phone’s notification address. It’s deleted when you turn them off or delete your account.',
      ],
      after: [
        'These stay only on your device and are not sent to us: diet preferences, favourites, the area you choose and saved places (Home, Work).',
        'Location: if you allow it, your device uses your location to show nearby stores. The calculation happens on the device and your location is not sent to our servers.',
        'Card payments are processed by POK (pokpay.io). You enter your card details in POK’s form and they never pass through our servers; we keep only the POK order number, the amount and the payment status.',
        'Anonymous statistics and error reports: the app sends our servers events like “opened the app” or “placed an order”, with a random identifier that changes every time the app opens, and no account, email or IP address. When the app crashes it sends the error message and the browser type.',
      ],
    },
    {
      id: 'partners',
      title: 'Partner data (the store dashboard)',
      paragraphs: ['When a store applies or uses the dashboard, we store:'],
      bullets: [
        'The contact person’s name, email, phone number (optional) and application message.',
        'Store details: name, type, address, map location, store photo and Surprise Bag information. These are shown publicly in the app once the store is approved.',
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
      after: ['We don’t sell data or show ads. Statistics and error reports are anonymous and stay on our own servers; we don’t use third-party analytics or trackers.'],
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
        'Photon (komoot): address search in the location picker. It receives the text you type and your IP address, only when you search for an address.',
        'Google Fonts: website fonts. Google receives your IP address when fonts load.',
        'POK (pokpay.io): card payments and refunds.',
        'Our email provider: sends account emails and receipts.',
        'Browser and phone notification services (e.g. Google, Apple, Mozilla): deliver pickup reminders, only if you turn them on.',
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
        'Anonymous statistics: 13 months. Error reports: 90 days after they’re fixed.',
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
