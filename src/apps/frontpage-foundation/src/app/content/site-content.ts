/**
 * All Dutch copy and building facts for the website.
 *
 * Everything marked "TODO: verify" is placeholder data and has to be replaced
 * with the real numbers, rates and rules before the site goes live.
 */

import type { IconName } from '../shared/icon/icon';

export interface PhotoSlot {
  /** Path below `public/`, without size suffix or extension (e.g. `images/groot-gebouw`). `null` renders a placeholder. */
  readonly src: string | null;
  readonly alt: string;
}

/** Text with an optional shorter variant that phones show instead. */
export interface Copy {
  readonly long: string;
  readonly short?: string;
}

export interface NavItem {
  readonly path: string;
  readonly label: string;
}

export interface TitledText {
  readonly title: string;
  readonly text: string;
}

export interface FaqItem {
  readonly question: string;
  readonly answer: Copy;
}

/** A line with an icon, a bold lead-in and the rest of the sentence. */
export interface Feature {
  readonly icon: IconName;
  readonly strong: string;
  readonly rest: string;
}

export interface GalleryPhoto {
  readonly src: string;
  readonly alt: string;
  readonly title: string;
  readonly text: string;
  /** Used in the "Vergroot foto: …" button label. */
  readonly label: string;
  /** CSS aspect-ratio. */
  readonly ratio: string;
  /** Number of grid columns the photo spans on desktop. */
  readonly span?: number;
}

export interface BuildingInfo {
  readonly id: 'groot' | 'klein';
  readonly eyebrow: string;
  readonly name: string;
  readonly summary: string;
  readonly photo: PhotoSlot;
  readonly features: readonly Feature[];
  readonly gallery: readonly GalleryPhoto[];
}

export const foundation = {
  name: 'Stichting Clubhuis De Wildert',
  email: 'stichting@scpp.nl',
  address: {
    street: 'Huijbergsebaan 415',
    postalCode: '4624 RG',
    city: 'Bergen op Zoom',
  },
  mapsUrl:
    'https://www.google.com/maps/place/Huijbergsebaan+415,+4624+RG+Bergen+op+Zoom/@51.4749186,4.3217393,17z/data=!3m1!4b1!4m6!3m5!1s0x47c412df2792939d:0x2488ef6c5c301ba5!8m2!3d51.4749186!4d4.3243142!16s%2Fg%2F11b8v55kgp?entry=ttu&g_ep=EgoyMDI2MTAyNy4wIKXMDSoASAFQAw%3D%3D',
} as const;

export const navItems: readonly NavItem[] = [
  { path: '/', label: 'Home' },
  { path: '/gebouw', label: 'Gebouwen & foto’s' },
  { path: '/ligging', label: 'Ligging' },
  { path: '/tarieven', label: 'Tarieven & info' },
  { path: '/contact', label: 'Contact' },
];

// TODO: verify
export const building = {
  capacity: 45,
  earliestStart: '08:00',
  latestEnd: '22:00',
} as const;

/* ---------------------------------------------------------------------------
 * Prices. Every price on the site is read from here, so a change is one edit.
 * ------------------------------------------------------------------------- */

export interface RentalOption {
  readonly id: 'groot' | 'klein' | 'beide' | 'terrein';
  readonly label: string;
  /** Label for tight spaces such as the two-column price cards on phones. */
  readonly shortLabel: string;
  /** Euros per dagdeel. */
  readonly amount: number;
  readonly description: string;
}

// TODO: verify
export const rentalOptions = [
  {
    id: 'groot',
    label: 'Groot gebouw',
    shortLabel: 'Groot gebouw',
    amount: 75,
    description: 'Twee activiteitenruimtes, keuken en toiletten.',
  },
  {
    id: 'klein',
    label: 'Klein gebouw',
    shortLabel: 'Klein gebouw',
    amount: 45,
    description: 'Eén activiteitenruimte, keuken, toiletten en washok.',
  },
  {
    id: 'beide',
    label: 'Beide gebouwen',
    shortLabel: 'Beide gebouwen',
    amount: 100,
    description: 'Het hele clubhuis, voor groepen tot 45 personen.',
  },
  {
    id: 'terrein',
    label: 'Alleen het buitenterrein',
    shortLabel: 'Alleen buitenterrein',
    amount: 40,
    description: 'Met kampvuurplek en speelveld.',
  },
] as const satisfies readonly RentalOption[];

export type BuildingChoice = (typeof rentalOptions)[number]['id'];

/** Borg in euros. */
export const deposit = 250;

/** `€ 75`, or `€ 75,00` with `cents`. Amounts stay below 1.000, so no thousands separator. */
export function formatEuro(amount: number, cents = false): string {
  return `€ ${cents ? amount.toFixed(2).replace('.', ',') : amount}`;
}

export function rentalOption(id: BuildingChoice): RentalOption {
  return rentalOptions.find((option) => option.id === id) as RentalOption;
}

export function lowestRate(): number {
  return Math.min(...rentalOptions.map((option) => option.amount));
}

/** What renting both buildings together saves compared with renting them separately. */
export function bundleSaving(): number {
  return rentalOption('groot').amount + rentalOption('klein').amount - rentalOption('beide').amount;
}

/* ---------------------------------------------------------------------------
 * Pages
 * ------------------------------------------------------------------------- */

export interface Fact {
  readonly icon: IconName;
  readonly title: Copy;
  readonly text: string;
}

export interface Audience {
  readonly icon: IconName;
  readonly title: string;
  readonly text: Copy;
}

export interface BuildingCard {
  readonly id: 'groot' | 'klein';
  readonly name: string;
  readonly photo: PhotoSlot;
  readonly text: string;
  readonly pills: readonly string[];
  readonly linkLabel: string;
}

export const facilities: readonly Copy[] = [
  { long: 'Verwarming' },
  { long: 'Gas, water en elektra (normaal gebruik)', short: 'Gas, water en elektra' },
  { long: 'Gratis wifi' },
  { long: 'Kampvuurplek' },
  { long: 'Parkeerplaats op het terrein', short: 'Parkeerplaats' },
];

export const home = {
  eyebrow: <Copy>{
    long: 'Bergen op Zoom · te huur voor dagactiviteiten',
    short: 'Bergen op Zoom · dagverhuur',
  },
  heroTitle: 'Huur ons clubhuis in Bergen op Zoom',
  heroText: <Copy>{
    long: 'Twee gebouwen met een eigen keuken, een ruim buitenterrein in het bos en de A4 en A58 om de hoek. Voor familiedagen, schooldagen, bedrijfsuitjes en workshops.',
    short:
      'Twee gebouwen met een eigen keuken, een ruim terrein in het bos en de A4 en A58 om de hoek.',
  },
  heroPhoto: <PhotoSlot>{
    src: 'images/terrein-gebouwen',
    alt: 'De twee gebouwen van het clubhuis tussen de herfstbomen',
  },
  facts: <readonly Fact[]>[
    {
      icon: 'users',
      title: { long: `Tot ${building.capacity} personen` },
      text: 'over twee gebouwen',
    },
    {
      icon: 'clock',
      title: {
        long: `${building.earliestStart} – ${building.latestEnd} uur`,
        short: `${building.earliestStart} – ${building.latestEnd}`,
      },
      text: 'alleen overdag',
    },
    {
      icon: 'tag',
      title: { long: `Vanaf ${formatEuro(lowestRate())}` },
      text: 'per dagdeel',
    },
    {
      icon: 'map-pin',
      title: { long: 'Bij de A4 en A58', short: 'Bij A4 en A58' },
      text: 'parkeren op het terrein',
    },
  ],
  intro: {
    title: 'Welkom bij De Wildert',
    paragraphs: <readonly Copy[]>[
      {
        long: 'Stichting Clubhuis De Wildert beheert en verhuurt het clubhuis aan de Huijbergsebaan in Bergen op Zoom. De gebouwen zijn ingericht op groepen: er is ruimte om te koken, te eten, samen te werken en buiten te spelen.',
      },
      {
        long: 'De opbrengst van de verhuur gaat naar het onderhoud van de gebouwen en het terrein, zodat het een fijne plek blijft voor jong en oud.',
        short:
          'De opbrengst van de verhuur gaat naar het onderhoud van de gebouwen en het terrein.',
      },
    ],
    linkLabel: 'Bekijk alle gebouwen en foto’s →',
    /** One tall photo on the left, two stacked on the right. */
    mosaic: <readonly PhotoSlot[]>[
      {
        src: 'images/groot-gebouw-grote-ruimte',
        alt: 'De grote activiteitenruimte in het grote gebouw',
      },
      {
        src: 'images/klein-gebouw-ruimte-1',
        alt: 'De activiteitenruimte in het kleine gebouw',
      },
      { src: 'images/groot-gebouw-keuken', alt: 'De keuken in het grote gebouw' },
    ],
  },
  buildings: {
    title: 'Twee gebouwen, één terrein',
    intro: <Copy>{
      long: 'Huur het gebouw dat bij uw groep past, of allebei. Elk gebouw heeft een eigen keuken en toiletten.',
      short: 'Huur het gebouw dat bij uw groep past, of allebei.',
    },
    cards: <readonly BuildingCard[]>[
      {
        id: 'groot',
        name: 'Groot gebouw',
        photo: { src: 'images/groot-gebouw', alt: 'Het grote gebouw van buiten' },
        text: 'Twee activiteitenruimtes (een grote en een kleine), een keuken en twee toiletten. Geschikt voor workshops, trainingen, feesten en bijeenkomsten.',
        pills: ['2 activiteitenruimtes', 'Eigen keuken', '2 toiletten'],
        linkLabel: 'Bekijk het grote gebouw →',
      },
      {
        id: 'klein',
        name: 'Klein gebouw',
        photo: { src: 'images/klein-gebouw', alt: 'Het kleine gebouw van buiten' },
        text: 'Eén activiteitenruimte, een keuken en twee toiletten, plus een washok. Ideaal voor een kleiner gezelschap.',
        pills: ['1 activiteitenruimte', 'Eigen keuken', 'Washok'],
        linkLabel: 'Bekijk het kleine gebouw →',
      },
    ],
  },
  audiencesTitle: 'Voor wie?',
  audiencesIntro: <Copy>{
    long: `Voor dagactiviteiten met groepen tot ${building.capacity} personen.`,
    short: `Dagactiviteiten met groepen tot ${building.capacity} personen.`,
  },
  audiences: <readonly Audience[]>[
    {
      icon: 'heart',
      title: 'Gezinnen en families',
      text: {
        long: 'Voor een familiedag, een kinderfeestje of een verjaardag.',
        short: 'Familiedag, kinderfeestje of verjaardag.',
      },
    },
    {
      icon: 'book',
      title: 'Scholen',
      text: {
        long: 'Voor een projectdag, een schooldag buiten de deur of een ouderavond.',
        short: 'Projectdag, schooldag buiten de deur of ouderavond.',
      },
    },
    {
      icon: 'briefcase',
      title: 'Bedrijven',
      text: {
        long: 'Voor een bedrijfsuitje, een training, een werkoverleg of een teamdag.',
        short: 'Bedrijfsuitje, training, werkoverleg of teamdag.',
      },
    },
  ],
  location: {
    title: 'Midden in het bos, vlak bij de snelweg',
    text: <Copy>{
      long: 'Het clubhuis ligt extreem dicht bij de op- en afritten van de A4 en de A58 en is daardoor snel te bereiken. Parkeren kan op het terrein.',
      short: 'Dicht bij de op- en afritten van de A4 en de A58. Parkeren kan op het terrein.',
    },
    routeLabel: 'Route plannen',
    facilitiesTitle: 'Aanwezig',
  },
};

export const buildingPage = {
  title: 'Gebouwen & foto’s',
  lead: 'Een groot en een klein gebouw, elk met een eigen keuken en twee toiletten.',
  buildings: <readonly BuildingInfo[]>[
    {
      id: 'groot',
      eyebrow: 'Gebouw 1',
      name: 'Groot gebouw',
      summary:
        'Het grootste deel van het clubhuis, met een ruime zaal voor de hele groep en een aparte kleinere ruimte.',
      photo: { src: 'images/groot-gebouw', alt: 'Het grote gebouw van buiten' },
      features: [
        { icon: 'room', strong: '2 activiteitenruimtes', rest: ', een grote en een kleine' },
        { icon: 'kitchen', strong: 'Eigen keuken', rest: ', zonder kookgerei en servies' },
        { icon: 'toilet', strong: '2 toiletten', rest: '' },
      ],
      gallery: [
        {
          src: 'images/groot-gebouw-grote-ruimte',
          alt: 'De grote activiteitenruimte met tafels en stoelen',
          title: 'Grote activiteitenruimte',
          text: 'Ruime zaal met tafels en stoelen. Voor workshops, trainingen, feesten en bijeenkomsten.',
          label: 'grote activiteitenruimte',
          ratio: '16 / 9',
          span: 2,
        },
        {
          src: 'images/groot-gebouw-keuken',
          alt: 'De keuken in het grote gebouw',
          title: 'Keuken',
          text: 'Eigen keuken in het grote gebouw.',
          label: 'keuken',
          ratio: '4 / 5',
        },
      ],
    },
    {
      id: 'klein',
      eyebrow: 'Gebouw 2',
      name: 'Klein gebouw',
      summary: 'Eén ruimte voor een kleiner gezelschap, of als tweede plek naast het grote gebouw.',
      photo: { src: 'images/klein-gebouw', alt: 'Het kleine gebouw van buiten' },
      features: [
        { icon: 'room', strong: '1 activiteitenruimte', rest: ' met biertafels en banken' },
        { icon: 'kitchen', strong: 'Eigen keuken', rest: ', zonder kookgerei en servies' },
        { icon: 'drop', strong: 'Washok', rest: ' met lange wasbak · 2 toiletten' },
      ],
      gallery: [
        {
          src: 'images/klein-gebouw-ruimte-1',
          alt: 'De activiteitenruimte in het kleine gebouw',
          title: 'Activiteitenruimte',
          text: 'Tafels en stoelen voor activiteiten.',
          label: 'activiteitenruimte',
          ratio: '4 / 3',
        },
        {
          src: 'images/klein-gebouw-ruimte-2',
          alt: 'Dezelfde ruimte vanaf de andere kant, met biertafels en banken',
          title: 'Andere kant',
          text: 'Genoeg vrije vloer voor spel.',
          label: 'andere kant van de ruimte',
          ratio: '4 / 3',
        },
        {
          src: 'images/klein-gebouw-washok',
          alt: 'Het washok met een lange wasbak',
          title: 'Washok',
          text: 'Lange wasbak met meerdere kranen.',
          label: 'washok',
          ratio: '4 / 3',
        },
      ],
    },
  ],
  cta: {
    title: 'Liever eerst zelf kijken?',
    text: 'Maak een afspraak om het clubhuis te bekijken, of vraag direct een datum aan.',
    secondaryLabel: 'Bezichtiging aanvragen',
  },
};

export const locationPage = {
  title: 'Ligging & omgeving',
  lead: 'Het clubhuis ligt in een bosrijke omgeving aan de Huijbergsebaan, aan de rand van Bergen op Zoom en vlak bij de A4 en de A58.',
  access: [
    {
      title: 'Met de auto',
      text: 'Het clubhuis ligt extreem dicht bij de op- en afritten van de A4 en de A58 en is daardoor snel te bereiken. Parkeren kan op het terrein. Bij grote groepen vragen we u de auto’s zo compact mogelijk te parkeren.',
    },
    {
      title: 'Met de fiets',
      text: 'Het clubhuis is vanuit het centrum van Bergen op Zoom goed per fiets te bereiken.',
    },
    {
      title: 'Met het openbaar vervoer',
      text: 'Plan uw reis via 9292.nl. Vanaf de dichtstbijzijnde bushalte is het nog een korte wandeling.',
    },
  ] as readonly TitledText[],
  surroundings: {
    title: 'In het groen',
    text: 'Het clubhuis ligt in een bosrijke omgeving, ideaal voor een wandeling tijdens de pauze of een activiteit in de buitenlucht. Het centrum van Bergen op Zoom met winkels en supermarkten ligt op fietsafstand.',
    photo: <PhotoSlot>{ src: 'images/groot-gebouw', alt: 'Het clubhuis tussen de hoge bomen' },
  },
};

export const ratesPage = {
  title: 'Tarieven & info',
  lead: <Copy>{
    long: 'Alles wat u moet weten over de kosten, de regels en het verloop van een verhuur.',
    short: 'De kosten, de regels en het verloop van een verhuur.',
  },
  ratesIntro: <Copy>{
    long: 'Prijzen per dagdeel, inclusief gas, water en elektra bij normaal gebruik.',
    short: 'Per dagdeel, inclusief gas, water en elektra.',
  },
  savingLabel: <Copy>{
    long: `${formatEuro(bundleSaving())} voordeliger dan los`,
    short: `${formatEuro(bundleSaving())} voordeliger`,
  },
  infoBoxes: [
    {
      icon: 'clock',
      title: <Copy>{ long: 'Wat is een dagdeel?', short: 'Dagdeel:' },
      text: <Copy>{
        long: `Een ochtend, een middag of een avond. Een hele dag telt als twee dagdelen. Verhuur is mogelijk tussen ${building.earliestStart} en ${building.latestEnd} uur.`,
        short: `een ochtend, middag of avond. Een hele dag telt als twee. Tussen ${building.earliestStart} en ${building.latestEnd} uur.`,
      },
    },
    {
      icon: 'shield',
      title: <Copy>{
        long: `Borg: ${formatEuro(deposit, true)}`,
        short: `Borg ${formatEuro(deposit, true)}:`,
      },
      text: <Copy>{
        long: 'U betaalt de borg na ondertekening van de overeenkomst. Na oplevering storten we hem terug.',
        short: 'na ondertekening betalen, na oplevering terug.',
      },
    },
  ] as const,
  conditionsTitle: 'Voorwaarden',
  conditions: <readonly Copy[]>[
    {
      long: 'Het clubhuis is uitsluitend overdag te huur. Overnachten in de gebouwen of op het terrein is niet mogelijk.',
      short: 'Alleen overdag. Overnachten is niet mogelijk.',
    },
    {
      long: `Maximaal ${building.capacity} personen tegelijk op het terrein.`,
      short: `Maximaal ${building.capacity} personen tegelijk.`,
    },
    {
      long: 'Het clubhuis heeft een maatschappelijke bestemming. Wij controleren vooraf of uw activiteit daarbij past.',
      short: 'Uw activiteit past bij de maatschappelijke bestemming.',
    },
  ],
  includedTitle: 'Inbegrepen',
  included: <readonly Copy[]>[
    { long: 'Gas, water en elektra bij normaal gebruik' },
    {
      long: 'Gebruik van de gehuurde gebouwen, inclusief keuken en toiletten',
      short: 'De gehuurde gebouwen, met keuken en toiletten',
    },
    {
      long: 'Gebruik van het buitenterrein en de kampvuurplek',
      short: 'Buitenterrein en kampvuurplek',
    },
  ],
  rulesTitle: 'Huisregels',
  rules: <readonly Copy[]>[
    {
      long: `De gebouwen worden uiterlijk om ${building.latestEnd} uur verlaten, zodat de buren niet worden gestoord.`,
      short: `Uiterlijk om ${building.latestEnd} uur vertrekken.`,
    },
    { long: 'Overnachten is niet toegestaan.' },
    { long: 'Roken is in de gebouwen niet toegestaan.', short: 'Niet roken in de gebouwen.' },
    {
      long: 'Open vuur is alleen toegestaan op de kampvuurplek.',
      short: 'Open vuur alleen op de kampvuurplek.',
    },
    {
      long: 'Afval scheidt u en neemt u mee of deponeert u in de daarvoor bestemde containers.',
      short: 'Afval scheiden en meenemen of in de containers.',
    },
    {
      long: 'De gebouwen worden bezemschoon en opgeruimd opgeleverd.',
      short: 'Bezemschoon en opgeruimd opleveren.',
    },
    {
      long: 'Schade meldt u direct aan de beheerder.',
      short: 'Schade direct melden aan de beheerder.',
    },
  ],
  faqTitle: 'Veelgestelde vragen',
  faq: <readonly FaqItem[]>[
    {
      question: 'Kunnen we ook blijven overnachten?',
      answer: {
        long: 'Nee, het clubhuis wordt alleen overdag verhuurd. Overnachten in de gebouwen of op het terrein is niet mogelijk.',
      },
    },
    {
      question: 'Kunnen we ook maar één gebouw huren?',
      answer: {
        long: 'Ja, u kunt kiezen voor het grote gebouw, het kleine gebouw of beide. Geef bij uw aanvraag de gewenste begin- en eindtijd door.',
        short: 'Ja, u kunt kiezen voor het grote gebouw, het kleine gebouw of beide.',
      },
    },
    {
      question: 'Is er een beheerder aanwezig?',
      answer: {
        long: 'De sleutel en de staat van de gebouwen worden voor en na afloop met u doorgenomen. Tijdens uw huurperiode bent u telefonisch of per e-mail bereikbaar voor vragen.',
        short: 'De sleutel en de staat van de gebouwen worden voor en na afloop met u doorgenomen.',
      },
    },
    {
      question: 'Mogen wij een eigen kok of cateraar meenemen?',
      answer: {
        long: 'Ja, de keukens mogen gebruikt worden door uw eigen kok of cateraar. Houd er rekening mee dat kookgerei en servies niet aanwezig zijn.',
        short: 'Ja. Kookgerei en servies zijn niet aanwezig.',
      },
    },
    {
      question: 'Wat gebeurt er als we moeten annuleren?',
      answer: {
        long: 'Annuleren kan kosteloos tot vier weken voor aanvang. Daarna brengen we de huur in rekening. Neem bij vragen contact op.',
        short: 'Annuleren kan kosteloos tot vier weken voor aanvang.',
      },
    },
  ],
};

export const bookingPage = {
  title: 'Reserveren',
  lead: 'Doe een vrijblijvende aanvraag. Wij nemen zo snel mogelijk contact met u op.',
  stepsTitle: 'Zo werkt het',
  steps: <readonly TitledText[]>[
    {
      title: 'Aanvraag indienen',
      text: 'Kies gebouw, datum, tijden en aantal personen.',
    },
    {
      title: 'Bevestiging',
      text: 'Wij controleren de beschikbaarheid en sturen een overeenkomst.',
    },
    {
      title: 'Betaling en borg',
      text: 'Na ondertekening betaalt u de borg en regelen we de sleutel.',
    },
    {
      title: 'Genieten',
      text: 'U geniet van uw dag en levert het clubhuis netjes op.',
    },
  ],
  remarksHint: 'Wat voor activiteit plant u? Zijn er bijzonderheden of vragen?',
  summary: {
    title: 'Tarieven in het kort',
    note: `Per dagdeel. Borg ${formatEuro(deposit, true)}, na oplevering terug.`,
  },
  notice: 'Het clubhuis is alleen overdag te huur. Overnachten is niet mogelijk.',
  questionsTitle: 'Vragen voor u begint?',
  groupTypes: [
    { value: 'family', label: 'Gezin of familie' },
    { value: 'school', label: 'School' },
    { value: 'business', label: 'Bedrijf' },
    { value: 'other', label: 'Anders' },
  ] as const,
};

export const contactPage = {
  title: 'Contact',
  lead: 'Heeft u een vraag of wilt u het clubhuis eerst bekijken? Laat het ons weten via het formulier.',
  subjects: [
    { value: 'question', label: 'Vraag over de verhuur' },
    { value: 'viewing', label: 'Clubhuis bekijken' },
    { value: 'other', label: 'Anders' },
  ] as const,
};
