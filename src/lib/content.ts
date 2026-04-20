export const site = {
  lang: 'da',
  name: 'Skovbye Sexologi',
  tagline: 'Signe Skovbye — psykomotorisk terapeut og klinisk sexolog',
  leadIn: 'Rådgivning og terapeutiske interventioner på tværs af alder og køn',
  contact: {
    email: 'signeskovbye@gmail.com',
    phone: '(+45) 31 60 42 15',
    address: 'København',
    cvr: '43253360',
    hours: 'Man–Fre 10–17 · Weekend lukket',
    responseTime: 'Jeg bestræber mig på at besvare forespørgsler indenfor 24–48 timer.'
  },
  services: [
    {
      slug: 'terapi',
      number: '01',
      title: 'Psykomotorisk sexologisk terapi',
      kicker: 'solo · par · poly',
      blurb:
        'Vi arbejder både med samtale og krop. Psykomotorik forener kognition og sansning — en naturlig vej til seksuel trivsel.',
      bullets: ['Samtaleterapi', 'Kropslige øvelser', 'Sexologisk rådgivning'],
      supports: [
        'Lyst',
        'Behov',
        'Grænser',
        'Relationer',
        'Selvindsigt',
        'Kropsbevidsthed',
        'Ressourcer',
        'Kærlighed',
        'Tryghed',
        'Sexliv'
      ]
    },
    {
      slug: 'intimacy-coordination',
      number: '02',
      title: 'Intimitets­koordinering',
      kicker: 'film · tv · teater',
      blurb:
        'Scener med fysisk intimitet skal håndteres med omhu, professionalisme og respekt for alle involverede.',
      bullets: [
        'Forberedende samtaler med producent, instruktør og performere',
        'Koreografi af intime scener',
        'Vejledning om sikkerhedsbeklædning',
        'Opretholdelse af et sikkert sæt',
        'Støtte efter scenen'
      ],
      testimonial: {
        quote:
          'Jeg kan anbefale Signe Skovbye, hun er dybt professionel og rar at arbejde sammen med.',
        source: 'Michael Panduro, filminstruktør'
      }
    },
    {
      slug: 'aeldrepleje',
      number: '03',
      title: 'Seksuel sundhed i ældresektoren',
      kicker: 'plejepersonale · beboere',
      blurb:
        'Udviklet på LGBT+ plejehjemmet Slottet. Undervisning og hjælpemiddelskasser der møder ældres seksualitet med værdighed.',
      bullets: [
        'Undervisning af sundhedsfagligt personale',
        'Rådgivning om aldersrelevante hjælpemidler',
        'Oplæg og samtaler for beboere',
        'Kasuistik og konkrete redskaber'
      ]
    },
    {
      slug: 'undervisning',
      number: '04',
      title: 'Seksual­undervisning',
      kicker: 'unge · grupper · workshops',
      blurb:
        'Biologi, psykologi og kultur — sammenvævet. Et sprog for grænser, lyster og behov, uden skam.',
      bullets: ['Ophidselse', 'Samtykke', 'Berøring', 'Samleje', 'Samtale', 'Porno']
    }
  ],
  bio: {
    heading: 'Signe Skovbye, grundlægger',
    pronouns: 'hun/hende · de/dem',
    body: [
      'Jeg er en passioneret sexolog, som har uddannet mig i årevis. Jeg arbejder inden for flere forskellige områder, hvor min dybdegående viden om sexologi kan anvendes — i kontekst af menneskets fysiske, psykiske og sociale trivsel.',
      'Jeg har kombineret en professionsbachelor i psykomotorisk terapi (KP) med efteruddannelse i klinisk sexologi (DACS).',
      'Jeg går til alle mine projekter med en terapeutisk tilgang og arbejder med at forstå og understøtte menneskers seksuelle og generelle trivsel.',
      'Jeg har særligt fokus på LGBTQIA+ og andre marginaliserede grupper, som tilbydes særpriser og tilpassede rammer efter behov.'
    ]
  },
  pillQuote:
    'Klare linjer om hvordan vi må og ikke må tale, røre eller gøre, tillader en autentisk fremstilling af intime relationer på skærmen.',
  nav: [
    { label: 'Terapi', href: '#terapi' },
    { label: 'Intimacy', href: '#intimacy-coordination' },
    { label: 'Ældrepleje', href: '#aeldrepleje' },
    { label: 'Undervisning', href: '#undervisning' },
    { label: 'Kontakt', href: '#kontakt' }
  ]
} as const;

export type SiteContent = typeof site;
