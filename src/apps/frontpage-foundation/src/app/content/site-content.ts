/**
 * All Dutch copy and building facts for the website.
 *
 * Everything marked "TODO: verify" is placeholder data and has to be replaced
 * with the real numbers, rates and rules before the site goes live.
 */

export interface PhotoSlot {
  /** Path below `public/`, without size suffix or extension (e.g. `images/groot-gebouw`). `null` renders a placeholder. */
  readonly src: string | null;
  readonly alt: string;
}

export interface NavItem {
  readonly path: string;
  readonly label: string;
}

export interface TitledText {
  readonly title: string;
  readonly text: string;
}

export interface Area extends TitledText {
  readonly photo: PhotoSlot;
}

export interface BuildingInfo {
  readonly name: string;
  readonly summary: string;
  readonly photo: PhotoSlot;
  readonly areas: readonly Area[];
}

export interface RateRow {
  readonly label: string;
  readonly price: string;
  readonly note: string;
}

export interface FaqItem {
  readonly question: string;
  readonly answer: string;
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

export const home = {
  heroTitle: 'Huur ons clubhuis in Bergen op Zoom',
  heroText:
    'Een groot en een klein gebouw, elk met een eigen keuken en toiletten, op een ruim buitenterrein in een bosrijke omgeving. Te huur voor dagactiviteiten, zoals een familiedag, een schooldag of een bedrijfsuitje. Overnachten is niet mogelijk.',
  intro: {
    title: 'Welkom bij De Wildert',
    paragraphs: [
      'Stichting Clubhuis De Wildert beheert en verhuurt het clubhuis aan de Huijbergsebaan in Bergen op Zoom. De gebouwen zijn ingericht op groepen: er is ruimte om te koken, te eten, samen te werken en buiten te spelen. Het clubhuis wordt alleen overdag verhuurd.',
      'De opbrengst van de verhuur gaat naar het onderhoud van de gebouwen en het terrein, zodat het een fijne plek blijft voor jong en oud.',
    ],
  },
  highlights: <readonly TitledText[]>[
    {
      title: `Tot ${building.capacity} personen`,
      text: 'Ruimte voor grotere gezelschappen, verdeeld over twee gebouwen.',
    },
    {
      title: 'Twee gebouwen',
      text: 'Een groot gebouw met twee activiteitenruimtes en een klein gebouw met één, elk met een eigen keuken.',
    },
    {
      title: 'Eigen terrein',
      text: 'Ruim buitenterrein in een bosrijke omgeving, met een kampvuurplek. Ideaal om buiten te spelen of te werken.',
    },
    {
      title: 'Vlak bij de A4 en A58',
      text: 'Heel dicht bij de op- en afritten van de snelwegen, met parkeergelegenheid op het terrein.',
    },
  ],
  audiencesTitle: 'Voor wie?',
  audiences: <readonly TitledText[]>[
    {
      title: 'Gezinnen en families',
      text: 'Voor een familiedag, een kinderfeestje of een verjaardag.',
    },
    {
      title: 'Scholen',
      text: 'Voor een projectdag, een schooldag buiten de deur of een ouderavond.',
    },
    {
      title: 'Bedrijven',
      text: 'Voor een bedrijfsuitje, een training, een werkoverleg of een teamdag.',
    },
  ],
  photoStrip: <readonly PhotoSlot[]>[
    { src: 'images/klein-gebouw', alt: 'Het kleine gebouw van buiten' },
    { src: 'images/groot-gebouw-grote-ruimte', alt: 'De grote activiteitenruimte' },
    { src: 'images/klein-gebouw-ruimte-1', alt: 'De activiteitenruimte in het kleine gebouw' },
  ],
  heroPhoto: <PhotoSlot>{
    src: 'images/terrein-gebouwen',
    alt: 'De twee gebouwen van het clubhuis tussen de bomen',
  },
};

export const buildingPage = {
  title: 'Gebouwen & foto’s',
  lead: 'Het terrein bestaat uit twee gebouwen: een groot en een klein gebouw, elk met een eigen keuken en twee toiletten.',
  buildings: <readonly BuildingInfo[]>[
    {
      name: 'Groot gebouw',
      summary:
        'Het grote gebouw heeft twee activiteitenruimtes (een grote en een kleine), een keuken en twee toiletten.',
      photo: { src: 'images/groot-gebouw', alt: 'Het grote gebouw van buiten' },
      areas: [
        {
          title: 'Grote activiteitenruimte',
          text: 'Ruime zaal met tafels en stoelen. Geschikt voor workshops, trainingen, feesten en bijeenkomsten.',
          photo: {
            src: 'images/groot-gebouw-grote-ruimte',
            alt: 'De grote activiteitenruimte in het grote gebouw',
          },
        },
        {
          title: 'Kleine activiteitenruimte',
          text: 'Gezellige ruimte met bankstellen. Handig voor een aparte groep, een vergadering of een rustig overleg.',
          photo: { src: null, alt: 'De kleine activiteitenruimte met bankstellen' },
        },
        {
          title: 'Keuken',
          text: 'Eigen keuken in het grote gebouw. Kookgerei en servies zijn niet aanwezig.',
          photo: { src: 'images/groot-gebouw-keuken', alt: 'De keuken in het grote gebouw' },
        },
      ],
    },
    {
      name: 'Klein gebouw',
      summary:
        'Het kleine gebouw heeft één activiteitenruimte, een keuken en twee toiletten. Ideaal voor een kleiner gezelschap.',
      photo: { src: 'images/klein-gebouw', alt: 'Het kleine gebouw van buiten' },
      areas: [
        {
          title: 'Activiteitenruimte',
          text: 'Eén ruimte voor activiteiten, met tafels en stoelen.',
          photo: {
            src: 'images/klein-gebouw-ruimte-1',
            alt: 'De activiteitenruimte in het kleine gebouw',
          },
        },
        {
          title: 'Activiteitenruimte (andere kant)',
          text: 'Dezelfde ruimte vanaf de andere kant: biertafels en banken, met genoeg vrije vloer voor spel en activiteiten.',
          photo: {
            src: 'images/klein-gebouw-ruimte-2',
            alt: 'De activiteitenruimte in het kleine gebouw, gezien vanaf de andere kant',
          },
        },
        {
          title: 'Keuken',
          text: 'Eigen keuken in het kleine gebouw. Kookgerei en servies zijn niet aanwezig.',
          photo: { src: null, alt: 'De keuken in het kleine gebouw' },
        },
        {
          title: 'Washok',
          text: 'Washok met een lange wasbak met meerdere kranen, handig voor het afwassen en handen wassen.',
          photo: { src: 'images/klein-gebouw-washok', alt: 'Het washok in het kleine gebouw' },
        },
      ],
    },
  ],
  grounds: <Area>{
    title: 'Buitenterrein',
    text: 'Een ruim terrein met een kampvuurplek en een speelveld. Pioniershout is op aanvraag beschikbaar.',
    photo: {
      src: 'images/terrein-gebouwen',
      alt: 'Het buitenterrein met de twee gebouwen tussen de bomen',
    },
  },
  facilities: [
    'Verwarming',
    'Gas, water en elektra (normaal gebruik)',
    'Gratis wifi',
    'Kampvuurplek',
    'Parkeerplaats op het terrein',
  ],
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
  lead: 'Alles wat u moet weten over de kosten, de regels en het verloop van een verhuur.',
  // TODO: verify
  rates: <readonly RateRow[]>[
    { label: 'Groot gebouw', price: '€ 75,00', note: 'per dagdeel' },
    { label: 'Klein gebouw', price: '€ 45,00', note: 'per dagdeel' },
    { label: 'Beide gebouwen', price: '€ 100,00', note: 'per dagdeel' },
    { label: 'Alleen het buitenterrein', price: '€ 40,00', note: 'per dagdeel' },
    { label: 'Borg', price: '€ 250,00', note: 'wordt na oplevering teruggestort' },
  ],
  conditions: [
    'Het clubhuis is uitsluitend overdag te huur. Overnachten in de gebouwen of op het terrein is niet mogelijk.',
    `Verhuur is mogelijk tussen ${building.earliestStart} en ${building.latestEnd} uur.`,
    'Een dagdeel is een ochtend, een middag of een avond. Een hele dag telt als twee dagdelen.',
    `Maximaal ${building.capacity} personen tegelijk op het terrein.`,
    'Het clubhuis heeft een maatschappelijke bestemming. Wij controleren vooraf of uw activiteit daarbij past.',
  ],
  included: [
    'Gas, water en elektra bij normaal gebruik',
    'Gebruik van de gehuurde gebouwen, inclusief keuken en toiletten',
    'Gebruik van het buitenterrein en de kampvuurplek',
  ],
  rules: [
    `De gebouwen worden uiterlijk om ${building.latestEnd} uur verlaten, zodat de buren niet worden gestoord.`,
    'Overnachten is niet toegestaan.',
    'Roken is in de gebouwen niet toegestaan.',
    'Open vuur is alleen toegestaan op de kampvuurplek.',
    'Afval scheidt u en neemt u mee of deponeert u in de daarvoor bestemde containers.',
    'De gebouwen worden bezemschoon en opgeruimd opgeleverd.',
    'Schade meldt u direct aan de beheerder.',
  ],
  faq: <readonly FaqItem[]>[
    {
      question: 'Kunnen we ook blijven overnachten?',
      answer:
        'Nee, het clubhuis wordt alleen overdag verhuurd. Overnachten in de gebouwen of op het terrein is niet mogelijk.',
    },
    {
      question: 'Kunnen we ook maar één gebouw huren?',
      answer:
        'Ja, u kunt een ochtend, een middag, een avond of een hele dag huren, en kiezen voor het grote gebouw, het kleine gebouw of beide. Geef bij uw aanvraag de gewenste begin- en eindtijd door.',
    },
    {
      question: 'Is er een beheerder aanwezig?',
      answer:
        'De sleutel en de staat van de gebouwen worden voor en na afloop met u doorgenomen. Tijdens uw huurperiode bent u telefonisch of per e-mail bereikbaar voor vragen.',
    },
    {
      question: 'Mogen wij een eigen kok of cateraar meenemen?',
      answer:
        'Ja, de keukens mogen gebruikt worden door uw eigen kok of cateraar. Houd er rekening mee dat kookgerei en servies niet aanwezig zijn.',
    },
    {
      question: 'Wat gebeurt er als we moeten annuleren?',
      answer:
        'Annuleren kan kosteloos tot vier weken voor aanvang. Daarna brengen we de huur in rekening. Neem bij vragen contact op.',
    },
  ],
};

export const bookingPage = {
  title: 'Reserveren',
  lead: 'Doe een vrijblijvende aanvraag. Wij nemen zo snel mogelijk contact met u op.',
  steps: <readonly TitledText[]>[
    {
      title: 'Aanvraag indienen',
      text: 'Vul het formulier in met de gewenste datum, tijden en het aantal personen. Vermeld in de opmerkingen welk gebouw u wilt huren.',
    },
    {
      title: 'Bevestiging',
      text: 'Wij controleren de beschikbaarheid en sturen u een bevestiging met een overeenkomst.',
    },
    {
      title: 'Betaling en borg',
      text: 'Na ondertekening betaalt u de borg en ontvangt u de details voor de sleuteloverdracht.',
    },
    {
      title: 'Genieten',
      text: 'U haalt de sleutel op, geniet van uw dag en levert het clubhuis netjes op.',
    },
  ],
  notice: 'Het clubhuis is alleen overdag te huur. Overnachten is niet mogelijk.',
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
