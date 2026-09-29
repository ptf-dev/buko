import { CONTACT_EMAIL, LEGAL_ADDRESS, LEGAL_ENTITY } from '../config'
import type { Lang } from './i18n'
import type { LegalCopy } from './LegalPage'

/**
 * Terms of service. The rules here mirror the code: 4 bags per order, cancellation until 2 hours before the pickup
 * window, collection from 15 minutes before it, problems reported within 24 hours, cash at pickup for trusted
 * customers. Update both languages when a rule changes.
 */
export const TERMS_UPDATED: Record<Lang, string> = { sq: '29 shtator 2026', en: '29 September 2026' }

const sq: LegalCopy = {
  title: 'Kushtet e shërbimit',
  updated: 'Përditësuar më',
  back: 'Kthehu te faqja kryesore',
  contents: 'Përmbajtja',
  intro:
    'Këto kushte rregullojnë përdorimin e aplikacionit dhe të faqes Ngopu nga klientët. Duke krijuar një llogari ose duke rezervuar një Çantë Surprizë, ti i pranon ato. Dyqanet partnere kanë një marrëveshje të veçantë partneriteti.',
  sections: [
    {
      id: 'about',
      title: 'Kush jemi',
      paragraphs: [
        `Shërbimin Ngopu e ofron ${LEGAL_ENTITY} („Ngopu”, „ne”), ${LEGAL_ADDRESS}. Për çdo pyetje rreth këtyre kushteve ose të një porosie: ${CONTACT_EMAIL}.`,
      ],
    },
    {
      id: 'service',
      title: 'Çfarë është Ngopu',
      paragraphs: [
        'Ngopu është një treg (marketplace) që lidh dyqanet me ushqim të pashitur me klientët pranë tyre. Dyqani është shitësi i Çantës Surprizë: ai e përgatit, e çmon, e dorëzon dhe lëshon kuponin fiskal. Ngopu e mbledh pagesën në emër të dyqanit dhe mban një komision prej dyqanit, jo prej teje.',
        'Çmimi që sheh në aplikacion është çmimi i plotë që paguan. Nuk ka tarifa shtesë për klientët.',
      ],
    },
    {
      id: 'account',
      title: 'Llogaria jote',
      bullets: [
        'Për të rezervuar duhet një llogari me emrin dhe emailin tënd të vërtetë. Duhet të jesh të paktën 16 vjeç.',
        'Mbaje fjalëkalimin të sigurt: je përgjegjës për porositë e bëra nga llogaria jote.',
        'Mund ta fshish llogarinë në çdo kohë nga Profili. Porositë e hapura duhen marrë ose anuluar më parë.',
      ],
    },
    {
      id: 'bags',
      title: 'Çantat Surprizë',
      bullets: [
        'Përmbajtja është surprizë: dyqani mbush çantën me atë që i ka mbetur atë ditë. Përshkrimi në aplikacion tregon llojin e ushqimit, jo artikuj të caktuar.',
        '„Vlera origjinale” është vlerësimi i dyqanit për çmimin normal të shitjes së përmbajtjes dhe është orientues.',
        'Çantat mund të përmbajnë alergjenë. Nëse ke alergji ose kufizime ushqimore, pyet dyqanin para se ta konsumosh ushqimin. Përdor ushqimin brenda ditës, si çdo ushqim të freskët.',
        'Dyqani cakton çmimin, sasinë dhe orarin e marrjes, dhe mund ta ndalojë shitjen për një ditë.',
      ],
    },
    {
      id: 'reserve',
      title: 'Rezervimi dhe pagesa',
      bullets: [
        'Rezervimi bëhet në aplikacion, deri në 4 çanta për porosi. Çmimet janë në lekë (ALL).',
        'Pagesa me kartë bëhet nëpërmjet POK, një institucion pagesash i licencuar nga Banka e Shqipërisë. Të dhënat e kartës futen në formularin e POK dhe nuk i ruan Ngopu. Rezervimi konfirmohet vetëm kur pagesa konfirmohet; deri atëherë çanta mbahet për ty rreth 10 minuta.',
        'Klientët me histori të mirë marrjesh mund të paguajnë me para në dorë në dyqan, kur dyqani e lejon. Në këtë rast çmimin e paguan te dyqani kur merr çantën.',
        'Pas rezervimit merr një kod marrjeje dhe një faturë me email. Kuponin fiskal e lëshon dyqani.',
      ],
    },
    {
      id: 'pickup',
      title: 'Marrja e çantës',
      bullets: [
        'Shko te dyqani brenda orarit të marrjes që tregohet në porosi dhe trego kodin e marrjes. Konfirmimi „rrëshqit për të marrë” hapet 15 minuta para fillimit të orarit.',
        'Nëse nuk e merr çantën brenda orarit, porosia shënohet si e humbur. Dyqani e ka mbajtur ushqimin për ty, prandaj shuma nuk rimbursohet.',
        'Rrëshqite konfirmimin vetëm kur je te dyqani dhe stafi po ta dorëzon çantën.',
      ],
    },
    {
      id: 'cancel',
      title: 'Anulimi dhe rimbursimi',
      bullets: [
        'Mund ta anulosh porosinë në aplikacion deri 2 orë para fillimit të orarit të marrjes, me rimbursim të plotë.',
        'Më pak se 2 orë para orarit anulimi nuk është më i mundur, sepse dyqani e ka përgatitur çantën.',
        'Nëse dyqani e anulon porosinë (p.sh. nuk i mbeti ushqim), të njoftojmë dhe të rimbursojmë të plotë.',
        'Rimbursimet e pagesave me kartë kthehen në të njëjtën kartë. Zakonisht duken brenda 3–10 ditësh pune, në varësi të bankës.',
        'Porositë me para në dorë nuk kanë pagesë për t’u rimbursuar; nëse dyqani i anulon, thjesht nuk paguan asgjë.',
      ],
    },
    {
      id: 'problems',
      title: 'Probleme me një çantë',
      paragraphs: [
        'Nëse çanta kishte një problem të vërtetë (ushqim i prishur, çantë pothuajse bosh, dyqan i mbyllur në orarin e marrjes), raportoje nga faqja e porosisë brenda 24 orësh, me një përshkrim dhe, nëse mundesh, një foto. E shqyrtojmë me dyqanin dhe vendosim për një rimbursim të pjesshëm ose të plotë. Për porositë me para në dorë, shumën ta kthen dyqani.',
      ],
    },
    {
      id: 'conduct',
      title: 'Përdorim i drejtë',
      bullets: [
        'Ngopu është për konsum personal. Çantat nuk mund të rishiten.',
        'Trajto stafin e dyqaneve me respekt. Vlerësimet duhet të jenë të sinqerta dhe për përvojën tënde.',
        'Mos e keqpërdor shërbimin (rezervime pa marrje të përsëritura, llogari të shumta, pagesa mashtruese). Marrjet e humbura të përsëritura mund ta heqin mundësinë e pagesës me para në dorë; keqpërdorimi mund të çojë në mbylljen e llogarisë.',
      ],
    },
    {
      id: 'partners',
      title: 'Dyqanet partnere',
      paragraphs: [
        'Dyqanet aplikojnë nga faqja jonë dhe aktivizohen pas miratimit nga Ngopu. Dyqani përgjigjet për saktësinë e ofertës, cilësinë dhe sigurinë e ushqimit, informacionin për alergjenët, dorëzimin e çantave të rezervuara dhe kuponin fiskal. Komisioni, pagesat dhe detyrimet e tjera të dyqanit përcaktohen në marrëveshjen e partneritetit.',
      ],
    },
    {
      id: 'liability',
      title: 'Përgjegjësia',
      paragraphs: [
        'Ushqimin e përgatit dhe e shet dyqani, i cili mban përgjegjësinë për të sipas ligjit. Ngopu ofron platformën, mbledh pagesën dhe ndihmon në zgjidhjen e problemeve.',
        'Bëjmë çmos që aplikacioni të punojë pa ndërprerje, por nuk garantojmë disponueshmëri të vazhdueshme. Për aq sa e lejon ligji, përgjegjësia jonë ndaj teje për një porosi kufizohet në shumën që ke paguar për të. Asgjë në këto kushte nuk i kufizon të drejtat që ke si konsumator sipas ligjit shqiptar.',
      ],
    },
    {
      id: 'changes',
      title: 'Ndryshimet',
      paragraphs: [
        'Mund t’i përditësojmë këto kushte kur shërbimi ndryshon. Data në krye tregon versionin aktual; për ndryshime të rëndësishme të njoftojmë në aplikacion ose me email. Mund ta ndërpresësh përdorimin në çdo kohë; ne mund ta pezullojmë një llogari që i shkel këto kushte.',
      ],
    },
    {
      id: 'law',
      title: 'Ligji dhe kontakti',
      paragraphs: [
        `Këto kushte rregullohen nga ligji i Republikës së Shqipërisë. Për çdo mosmarrëveshje na shkruaj fillimisht te ${CONTACT_EMAIL}; nëse nuk gjejmë zgjidhje, kompetente janë gjykatat e Tiranës, pa cenuar të drejtat e tua si konsumator.`,
      ],
    },
  ],
}

const en: LegalCopy = {
  title: 'Terms of service',
  updated: 'Updated on',
  back: 'Back to the homepage',
  contents: 'Contents',
  intro:
    'These terms govern how customers use the Ngopu app and website. By creating an account or reserving a Surprise Bag you accept them. Partner stores have a separate partner agreement.',
  sections: [
    {
      id: 'about',
      title: 'Who we are',
      paragraphs: [
        `The Ngopu service is provided by ${LEGAL_ENTITY} (“Ngopu”, “we”), ${LEGAL_ADDRESS}. For any question about these terms or an order: ${CONTACT_EMAIL}.`,
      ],
    },
    {
      id: 'service',
      title: 'What Ngopu is',
      paragraphs: [
        'Ngopu is a marketplace that connects stores with unsold food to customers nearby. The store is the seller of the Surprise Bag: it prepares, prices and hands over the bag and issues the fiscal receipt. Ngopu collects the payment on the store’s behalf and takes a commission from the store, not from you.',
        'The price you see in the app is the full price you pay. There are no extra fees for customers.',
      ],
    },
    {
      id: 'account',
      title: 'Your account',
      bullets: [
        'Reserving needs an account with your real name and email. You must be at least 16 years old.',
        'Keep your password safe: you are responsible for orders placed from your account.',
        'You can delete your account at any time from Profile. Open orders must be collected or cancelled first.',
      ],
    },
    {
      id: 'bags',
      title: 'Surprise Bags',
      bullets: [
        'The contents are a surprise: the store fills the bag with what it has left that day. The description in the app tells you the kind of food, not specific items.',
        'The “original value” is the store’s estimate of the normal selling price of the contents and is indicative.',
        'Bags may contain allergens. If you have allergies or dietary restrictions, ask the store before eating. Use the food the same day, as you would any fresh food.',
        'The store sets the price, quantity and pickup window, and may pause selling for a day.',
      ],
    },
    {
      id: 'reserve',
      title: 'Reserving and paying',
      bullets: [
        'You reserve in the app, up to 4 bags per order. Prices are in Albanian lek (ALL).',
        'Card payments go through POK, a payment institution licensed by the Bank of Albania. Card details are entered in POK’s form and are never stored by Ngopu. A reservation is confirmed only once the payment is confirmed; until then the bag is held for you for about 10 minutes.',
        'Customers with a good pickup history may pay cash at the store, where the store allows it. You then pay the price to the store when you collect.',
        'After reserving you get a pickup code and a receipt by email. The fiscal receipt is issued by the store.',
      ],
    },
    {
      id: 'pickup',
      title: 'Collecting your bag',
      bullets: [
        'Go to the store within the pickup window shown on your order and show your pickup code. The “swipe to collect” confirmation unlocks 15 minutes before the window opens.',
        'If you do not collect the bag within the window, the order is marked as missed. The store kept the food for you, so the amount is not refunded.',
        'Only swipe the confirmation when you are at the store and staff are handing you the bag.',
      ],
    },
    {
      id: 'cancel',
      title: 'Cancellations and refunds',
      bullets: [
        'You can cancel an order in the app until 2 hours before the pickup window starts, for a full refund.',
        'Less than 2 hours before the window, cancellation is no longer possible because the store has prepared the bag.',
        'If the store cancels your order (for example because nothing was left), we notify you and refund you in full.',
        'Card refunds go back to the same card. They usually appear within 3–10 working days, depending on your bank.',
        'Cash orders have no payment to refund; if the store cancels, you simply pay nothing.',
      ],
    },
    {
      id: 'problems',
      title: 'Problems with a bag',
      paragraphs: [
        'If a bag had a genuine problem (spoiled food, a nearly empty bag, a store closed during the pickup window), report it from the order page within 24 hours, with a description and, if you can, a photo. We review it with the store and decide on a partial or full refund. For cash orders the store returns the money.',
      ],
    },
    {
      id: 'conduct',
      title: 'Fair use',
      bullets: [
        'Ngopu is for personal consumption. Bags may not be resold.',
        'Treat store staff with respect. Ratings must be honest and about your own experience.',
        'Do not abuse the service (repeated uncollected reservations, multiple accounts, fraudulent payments). Repeated missed pickups can remove the cash-at-pickup option; abuse can lead to the account being closed.',
      ],
    },
    {
      id: 'partners',
      title: 'Partner stores',
      paragraphs: [
        'Stores apply on our website and are activated after approval by Ngopu. The store is responsible for the accuracy of its listing, the quality and safety of the food, allergen information, handing over reserved bags and the fiscal receipt. Commission, payouts and the store’s other obligations are set out in the partner agreement.',
      ],
    },
    {
      id: 'liability',
      title: 'Responsibility and liability',
      paragraphs: [
        'The food is prepared and sold by the store, which is responsible for it under the law. Ngopu provides the platform, collects the payment and helps resolve problems.',
        'We do our best to keep the app running, but we do not guarantee uninterrupted availability. To the extent the law allows, our liability to you for an order is limited to the amount you paid for it. Nothing in these terms limits the rights you have as a consumer under Albanian law.',
      ],
    },
    {
      id: 'changes',
      title: 'Changes',
      paragraphs: [
        'We may update these terms as the service changes. The date at the top shows the current version; for important changes we notify you in the app or by email. You can stop using the service at any time; we may suspend an account that breaks these terms.',
      ],
    },
    {
      id: 'law',
      title: 'Governing law and contact',
      paragraphs: [
        `These terms are governed by the law of the Republic of Albania. For any dispute, write to us first at ${CONTACT_EMAIL}; if we cannot find a solution, the courts of Tirana have jurisdiction, without prejudice to your rights as a consumer.`,
      ],
    },
  ],
}

export const TERMS_COPY: Record<Lang, LegalCopy> = { sq, en }
export const TERMS_TITLES: Record<Lang, { title: string; description: string }> = {
  sq: { title: 'Kushtet e shërbimit – Ngopu', description: 'Rregullat për rezervimin, marrjen, anulimin dhe rimbursimin e Çantave Surprizë në Ngopu.' },
  en: { title: 'Terms of service – Ngopu', description: 'The rules for reserving, collecting, cancelling and refunding Surprise Bags on Ngopu.' },
}
