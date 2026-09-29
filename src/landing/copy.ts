import type { Lang } from './i18n'

/** All landing-page text, Albanian first. Keep both languages in step when editing. */
const sq = {
  meta: {
    title: 'Ngopu – Shpëto ushqim të shijshëm me një të tretën e çmimit',
    description:
      'Me Ngopu shpëton Çanta Surprizë me ushqim të pashitur nga furrat, restorantet dhe dyqanet pranë teje, me një të tretën e çmimit. Së shpejti në Tiranë.',
  },
  nav: {
    links: [
      { href: '#how', label: 'Si funksionon' },
      { href: '#features', label: 'Veçoritë' },
      { href: '#impact', label: 'Ndikimi' },
      { href: '#stores', label: 'Për dyqanet' },
      { href: '#faq', label: 'Pyetje' },
    ],
    openApp: 'Hap aplikacionin',
    openMenu: 'Hap menunë',
    closeMenu: 'Mbyll menunë',
  },
  cta: {
    main: 'Fillo të shpëtosh ushqim',
    note: 'Falas · Punon në browser, pa shkarkuar asgjë',
    playTop: 'Merre në',
    playSoonTop: 'Së shpejti në',
    appStoreTop: 'Shkarkoje në',
    appStoreSoonTop: 'Së shpejti në',
    iosHint: ['Ke iPhone? Hap aplikacionin web, shtyp ', 'Share', ' → ', 'Add to Home Screen', ' dhe Ngopu punon si aplikacion i vërtetë.'],
  },
  hero: {
    line1: 'Ngopu.',
    line2: 'Me 70% ulje',
    sub: ['Çanta Surprizë me ushqim të shijshëm të pashitur nga furrat, restorantet dhe dyqanet më të mira pranë teje, me ', 'një të tretën e çmimit', '. Së shpejti në Tiranë.'],
    chipPrice: '350 L në vend të 1,050 L',
    chipCo2: '2.7 kg CO₂e të kursyera',
    chipPickup: 'Merre sot në 19:00',
    altStore: 'Çanta Surprizë e një furre në Ngopu',
    altReserved: 'Rezervimi u konfirmua me kodin e marrjes',
    altDiscover: 'Zbulo çanta surprizë pranë teje',
  },
  categoriesLabel: 'Llojet e dyqaneve në Ngopu',
  categories: ['🥐 Furra', '🍣 Sushi', '🥗 Sallata', '🍕 Piceri', '🛒 Supermarkete', '🍰 Pastiçeri', '☕ Kafene', '🥙 Delikatesa', '🍩 Donuts', '🥬 Fruta-perime', '💐 Lule', '🍽️ Bufe hotelesh'],
  stats: [
    { value: '⅓', label: 'e gjithë ushqimit që prodhohet në botë humbet ose hidhet', source: 'FAO (OKB)' },
    { value: '~70%', label: 'më lirë se çmimi origjinal i çdo Çante Surprizë' },
    { value: '2.7 kg', label: 'CO₂e të shmangura sa herë që shpëton një çantë' },
  ],
  sourceLabel: 'Burimi',
  how: {
    title: ['Tre hapa.', 'Asnjë kafshatë në kosh.'],
    step: 'Hapi',
    steps: [
      {
        title: 'Gjej një çantë pranë teje',
        text: 'Shfleto furrat, restorantet dhe dyqanet në hartë ose në listë. Filtro sipas orarit të marrjes, llojit të ushqimit dhe dietës.',
      },
      {
        title: 'Rezervo për pak sekonda',
        text: 'Shiko çfarë mund të të bjerë, orarin e marrjes dhe çmimin. Rezervo dhe paguaj në aplikacion, para se të mbarojë.',
      },
      {
        title: 'Rrëshqit dhe merre',
        text: 'Shko te dyqani në orarin e marrjes, trego kodin dhe rrëshqit. Shijoje ushqimin, dhe kursimin.',
      },
    ],
  },
  features: {
    title: ['Gjithçka që të duhet.', 'Asgjë më tepër.'],
    discoverTitle: 'Zbulo çfarë ka pranë teje',
    discoverText: '“Merre tani”, “Shpëtoje sa s’është vonë”, dyqane të reja dhe të preferuarat e tua, të gjitha në një vend, të renditura për ty.',
    altDiscover: 'Faqja kryesore e Ngopu',
    altBrowse: 'Lista e dyqaneve me filtra',
    items: [
      { title: 'Deri në 70% më lirë', text: 'Ushqim i vërtetë nga dyqane të vërteta, me çmim për t’u shpëtuar, jo për t’u hedhur.' },
      { title: 'Rrëshqit dhe merre', text: 'Një kod marrjeje dhe një rrëshqitje te banaku. Pa printime, pa pritje.' },
      { title: 'Ndiq ndikimin tënd', text: 'Vakte të shpëtuara, para të kursyera dhe CO₂e e shmangur, plus nivele për të zhbllokuar.' },
      { title: 'Të preferuarat', text: 'Shëno me zemër vendet që do dhe shiko çantat e tyre të parat.' },
      { title: 'Anulo me një prekje', text: 'Ndryshove plan? Anulo deri 2 orë para marrjes dhe merr paratë mbrapsht.' },
    ],
  },
  impact: {
    title: 'Çdo çantë është një fitore e vogël për planetin.',
    text: 'Humbja e ushqimit shkakton rreth 8–10% të emetimeve globale të gazeve serrë. Kur shpëton një çantë, ai ushqim hahet në vend që të hidhet, dhe Ngopu e mban shënim.',
    stats: ['CO₂e e shmangur për çantë', 'kursim në çdo çantë', 'nivele për të zhbllokuar'],
    alt: 'Ndikimi yt në aplikacionin Ngopu',
  },
  stores: {
    title: 'Ke furrë, kafene apo dyqan?',
    text: 'Bashkohu me Ngopu si partner që në fillim. Apliko për dy minuta. Pasi ta miratojmë dyqanin, shton ushqimin e pashitur nga paneli yt dhe lagjja e shpëton.',
    cta: 'Apliko si partner',
    perks: [
      { title: 'Fito nga teprica', text: 'Ktheje ushqimin që do ta hidhje në të ardhura, çdo ditë.' },
      { title: 'Klientë të rinj', text: 'Sill njerëz të rinj në dyqan, që kthehen sërish.' },
      { title: 'Zero mundim', text: 'Cakto sa çanta ke sot, kontrollo kodet e marrjes, mbaroi.' },
    ],
  },
  faq: {
    title: 'Pyetje? Përgjigje.',
    items: [
      {
        q: 'Çfarë është një Çantë Surprizë?',
        a: 'Dyqanet s’mund ta dinë saktësisht çfarë do u mbetet në fund të ditës, prandaj mbushin një çantë me atë që nuk u shit: bukë, gatime, ushqime ose ëmbëlsira. Ti e di llojin e ushqimit dhe dyqanin, pjesa tjetër është surprizë (e shijshme).',
      },
      {
        q: 'Sa kushton?',
        a: 'Aplikacioni është falas. Çdo çantë kushton rreth një të tretën e vlerës së asaj që ka brenda, dhe i sheh të dy çmimet para se të rezervosh.',
      },
      {
        q: 'Si e marr porosinë?',
        a: 'Shko te dyqani në orarin e marrjes që tregon aplikacioni, trego kodin dhe rrëshqit para stafit për ta marrë.',
      },
      { q: 'A mund ta anuloj?', a: 'Po. Mund ta anulosh deri 2 orë para fillimit të orarit të marrjes dhe merr të gjitha paratë mbrapsht.' },
      {
        q: 'Po alergjitë dhe dietat?',
        a: 'Mund të filtrosh çantat vegjetariane dhe vegane. Meqë përmbajtja ndryshon çdo ditë, dyqanet nuk mund të garantojnë që një çantë është pa alergjenë, prandaj pyet kur e merr nëse ke dyshime.',
      },
      {
        q: 'Ka aplikacion për iPhone dhe Android?',
        a: 'Ngopu punon që tani në çdo browser. Versioni beta për Android shkarkohet nga kjo faqe, ndërsa aplikacioni për iPhone vjen së shpejti në App Store.',
      },
    ],
  },
  final: {
    lines: ['Shpëto ushqim.', 'Kurse para.', 'Fillo sonte.'],
    text: 'Çanta jote e parë surprizë është vetëm disa prekje larg.',
    qr: 'Skano me kamerën e telefonit për ta hapur Ngopu në telefon.',
    qrLabel: 'Kodi QR për',
  },
  footer: {
    tagline: ['Ngopu, dhe mos hidh asgjë.', ' Lufto humbjen e ushqimit, çantë pas çante. Bërë me dashuri në Tiranë.'],
    product: 'Produkti',
    webApp: 'Aplikacioni web',
    androidSoon: 'Android (së shpejti)',
    iphoneSoon: 'iPhone (së shpejti)',
    learn: 'Mëso',
    how: 'Si funksionon',
    impact: 'Ndikimi',
    faq: 'Pyetje',
    business: 'Biznes',
    partnerLogin: 'Hyrje për partnerët',
    login: 'Hyr',
    becomePartner: 'Bëhu partner',
    legal: 'Ligjore',
    terms: 'Kushtet e shërbimit',
    privacy: 'Privatësia',
    rights: 'Të gjitha të drejtat e rezervuara.',
    place: 'Shqip · Tiranë, Shqipëri',
  },
  sticky: { text: 'Çanta të lira pranë teje', open: 'Hap' },
}

type Copy = typeof sq

const en: Copy = {
  meta: {
    title: 'Ngopu – Rescue delicious food at a third of the price',
    description:
      'Ngopu lets you rescue Surprise Bags of unsold food from local bakeries, restaurants and shops at a third of the price. Launching soon in Tirana.',
  },
  nav: {
    links: [
      { href: '#how', label: 'How it works' },
      { href: '#features', label: 'Features' },
      { href: '#impact', label: 'Impact' },
      { href: '#stores', label: 'For stores' },
      { href: '#faq', label: 'FAQ' },
    ],
    openApp: 'Open app',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
  },
  cta: {
    main: 'Start rescuing food',
    note: 'Free · Works in your browser, no download needed',
    playTop: 'Get it on',
    playSoonTop: 'Coming soon to',
    appStoreTop: 'Download on the',
    appStoreSoonTop: 'Coming soon to the',
    iosHint: ['On iPhone? Open the web app, tap ', 'Share', ' → ', 'Add to Home Screen', ' and Ngopu works just like an app.'],
  },
  hero: {
    line1: 'Good food.',
    line2: 'Rescued',
    sub: ['Surprise Bags of delicious unsold food from the best bakeries, restaurants and shops near you, at a ', 'third of the price', '. Launching soon in Tirana.'],
    chipPrice: '350 L instead of 1,050 L',
    chipCo2: '2.7 kg CO₂e saved',
    chipPickup: 'Pick up today 19:00',
    altStore: 'A bakery’s Surprise Bag in the Ngopu app',
    altReserved: 'Reservation confirmed with pickup code',
    altDiscover: 'Discover surprise bags near you',
  },
  categoriesLabel: 'Types of stores on Ngopu',
  categories: ['🥐 Bakeries', '🍣 Sushi', '🥗 Salad bars', '🍕 Pizzerias', '🛒 Supermarkets', '🍰 Pastry shops', '☕ Cafés', '🥙 Delis', '🍩 Donuts', '🥬 Greengrocers', '💐 Florists', '🍽️ Hotel buffets'],
  stats: [
    { value: '⅓', label: 'of all food produced worldwide is lost or wasted', source: 'UN FAO' },
    { value: '~70%', label: 'off the original price of every Surprise Bag' },
    { value: '2.7 kg', label: 'of CO₂e avoided each time you rescue a bag' },
  ],
  sourceLabel: 'Source',
  how: {
    title: ['Three steps.', 'Not a bite in the bin.'],
    step: 'Step',
    steps: [
      {
        title: 'Find a bag near you',
        text: 'Browse bakeries, restaurants and shops on the map or in a list. Filter by pickup time, food type and diet.',
      },
      {
        title: 'Reserve in seconds',
        text: 'See what you could get, the pickup window and the price. Reserve and pay in the app, before it’s gone.',
      },
      {
        title: 'Swipe to collect',
        text: 'Head to the store during the pickup window, show your code and swipe. Enjoy your food, and your savings.',
      },
    ],
  },
  features: {
    title: ['Everything you need.', 'Nothing you don’t.'],
    discoverTitle: 'Discover what’s near you',
    discoverText: '“Collect now”, “Save before it’s too late”, new stores and your favourites, all in one feed, sorted for you.',
    altDiscover: 'Ngopu discover feed',
    altBrowse: 'Store list with filters',
    items: [
      { title: 'Up to 70% off', text: 'Real food from real stores, priced to be rescued, not thrown away.' },
      { title: 'Swipe to collect', text: 'A pickup code and one swipe at the counter. No printing, no waiting.' },
      { title: 'Track your impact', text: 'Meals saved, money saved and CO₂e avoided, plus levels to unlock.' },
      { title: 'Favourites', text: 'Heart the spots you love and see their bags first.' },
      { title: 'Cancel with a tap', text: 'Plans changed? Cancel up to 2 hours before pickup for a full refund.' },
    ],
  },
  impact: {
    title: 'Every bag is a small win for the planet.',
    text: 'Food waste is responsible for around 8–10% of global greenhouse gas emissions. When you rescue a bag, that food gets eaten instead of binned, and Ngopu keeps count.',
    stats: ['CO₂e avoided per bag', 'saved on every bag', 'levels to unlock'],
    alt: 'Your impact in the Ngopu app',
  },
  stores: {
    title: 'Own a bakery, café or shop?',
    text: 'Join Ngopu as a launch partner. Apply in two minutes. Once we approve your store, you list your unsold food from your own dashboard and the neighbourhood rescues it.',
    cta: 'Apply to become a partner',
    perks: [
      { title: 'Earn from surplus', text: 'Turn food you’d throw away into revenue, every day.' },
      { title: 'Win new regulars', text: 'Bring new customers through your door who come back.' },
      { title: 'Zero hassle', text: 'Set today’s bag count, check pickup codes, done.' },
    ],
  },
  faq: {
    title: 'Questions? Answered.',
    items: [
      {
        q: 'What is a Surprise Bag?',
        a: 'Stores can’t predict exactly what will be left at the end of the day, so they pack a bag of whatever didn’t sell: bread, meals, groceries or treats. You’ll know the type of food and the store, and the rest is a (delicious) surprise.',
      },
      {
        q: 'How much does it cost?',
        a: 'The app is free. Each bag is priced at roughly a third of the value of what’s inside, and you see both prices before you reserve.',
      },
      {
        q: 'How do I pick up my order?',
        a: 'Go to the store during the pickup window shown in the app, show your pickup code and swipe to collect in front of the staff.',
      },
      { q: 'Can I cancel?', a: 'Yes. You can cancel up to 2 hours before the pickup window starts and get a full refund.' },
      {
        q: 'What about allergies and diets?',
        a: 'You can filter for vegetarian and vegan bags. Because contents change daily, stores can’t guarantee a bag is free of any allergen, so ask at pickup if you’re unsure.',
      },
      {
        q: 'Is there an iPhone and Android app?',
        a: 'Ngopu works right now in any browser. The Android beta can be downloaded from this page, and the iPhone app is coming to the App Store soon.',
      },
    ],
  },
  final: {
    lines: ['Save food.', 'Save money.', 'Start tonight.'],
    text: 'Your first Surprise Bag is a few taps away.',
    qr: 'Scan with your phone camera to open Ngopu on your phone.',
    qrLabel: 'QR code for',
  },
  footer: {
    tagline: ['ngopu (Albanian): eat your fill.', ' Fight food waste, one bag at a time. Made with care in Tirana.'],
    product: 'Product',
    webApp: 'Web app',
    androidSoon: 'Android (soon)',
    iphoneSoon: 'iPhone (soon)',
    learn: 'Learn',
    how: 'How it works',
    impact: 'Impact',
    faq: 'FAQ',
    business: 'Business',
    partnerLogin: 'Partner login',
    login: 'Log in',
    becomePartner: 'Become a partner',
    legal: 'Legal',
    terms: 'Terms of service',
    privacy: 'Privacy',
    rights: 'All rights reserved.',
    place: 'English · Tirana, Albania',
  },
  sticky: { text: 'Bags waiting near you', open: 'Open' },
}

export const COPY: Record<Lang, Copy> = { sq, en }
export const LANDING_TITLES: Record<Lang, { title: string; description: string }> = { sq: sq.meta, en: en.meta }
