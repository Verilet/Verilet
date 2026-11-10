/**
 * All "how Verilet works" wording lives here so the landing page, the How it works page and the
 * results page explain things the same way. Edit text here, not in the views.
 */

export interface GuideStep {
  title: string;
  text: string;
}

export interface GuideCheck {
  id: string;
  title: string;
  /** What we do (one sentence). */
  what: string;
  /** Why it matters (one sentence). */
  why: string;
  /** What is happening at this stop, shown in the How it works status bar. */
  status: string;
}

export interface GuideStop {
  /** "Stop 1" ... "Stop 5", "Finish". */
  label: string;
  title: string;
  what: string;
  why: string;
  /** What is happening at this stop, shown in the How it works status bar. */
  status: string;
}

const STEPS: GuideStep[] = [
  {
    title: 'Paste the link',
    text: 'Add the listing link plus rent and city. No account needed.',
  },
  {
    title: 'We check for scam signs',
    text: 'We look at the price, how payment is requested, and the listing itself.',
  },
  {
    title: 'Get a risk rating',
    text: 'A score from 0 to 100 and a label, with the reasons behind it.',
  },
];

const CHECKS: GuideCheck[] = [
  {
    id: 'rent',
    title: 'Rent vs. area price',
    what: 'We compare the rent with similar places nearby.',
    why: 'Scammers list rent far below the area average to get quick replies.',
    status: 'Comparing the rent with similar places nearby',
  },
  {
    id: 'payment',
    title: 'Payment method',
    what: 'We look at how the landlord asks to be paid.',
    why: "Gift cards and wire transfers can't be traced or refunded.",
    status: 'Looking at how the landlord asks to be paid',
  },
  {
    id: 'landlord',
    title: 'Landlord check',
    what: 'We look for records or reports about the landlord.',
    why: 'No record does not mean safe. We tell you when we could not check.',
    status: 'Looking for records about the landlord',
  },
  {
    id: 'details',
    title: 'Listing details',
    what: 'We read the listing text and photos for signs it was copied or rushed.',
    why: 'A normal-looking listing does not prove it is real.',
    status: 'Reading the listing text and photos',
  },
];

const STOPS: GuideStop[] = [
  {
    label: 'Stop 1',
    title: STEPS[0].title,
    what: 'You give us the listing link and a few details, like rent and city.',
    why: 'No account needed. It takes about a minute.',
    status: 'Starting with your listing link',
  },
  ...CHECKS.map((check, index) => ({
    label: `Stop ${index + 2}`,
    title: check.title,
    what: check.what,
    why: check.why,
    status: check.status,
  })),
  {
    label: 'Finish',
    title: 'Your risk rating',
    what: 'You get a score from 0 to 100, a label, and the reasons behind it.',
    why: 'It is a rating, not a guarantee. Always verify in person before you pay.',
    status: 'Adding up every stop into your rating',
  },
];

export const GUIDE = {
  eyebrow: 'RENTAL SCAM CHECK FOR STUDENTS',
  headline: { prefix: 'Check a rental listing', accent: 'before you pay' },
  pitch:
    'Verilet looks for common scam signs in a rental listing and gives you a clear risk rating, with the reasons behind it.',
  reassurance: 'No account needed · Takes about a minute',
  ctaLabel: 'Check a listing',
  howLabel: 'See how it works',
  tripLinkLabel: 'See every stop on the road',
  legendHeading: 'How to read your result',
  listingDemo: {
    label: 'EXAMPLE LISTING',
    title: 'Sunny 2 bed near campus',
    description: 'Available now. Must rent this week. No viewings, the owner is overseas.',
    rent: '$1,200 / month',
    location: 'Santa Cruz, CA',
    poster: 'Posted by Sam',
    message: '“Send a $200 gift card today and it’s yours.”',
  },
  disclaimer: 'A score is a rating, not a guarantee. Always visit in person before you pay.',
  footnote: 'Verilet gives a risk rating, not a guarantee.',
  steps: STEPS,
  checks: CHECKS,
  stops: STOPS,
  /** The How it works status bar before the car reaches the first stop. */
  tripStart: { label: 'Start', status: 'Scroll down to follow the road' },
  example: {
    meta: '2 bed · $1,200 / month · Santa Cruz, CA',
    score: 82,
    reasons: [
      {
        title: 'Rent vs. area price',
        detail: 'Rent is much lower than typical for this area',
        status: 'FLAG',
      },
      {
        title: 'Payment method',
        detail: 'Landlord asks for payment by gift card',
        status: 'FLAG',
      },
      { title: 'Landlord check', detail: 'No record found for this landlord', status: 'UNKNOWN' },
    ],
  },
  legend: [
    {
      label: 'HIGH RISK',
      tone: 'danger',
      text: 'Several scam signs. Do not send money or personal information.',
    },
    { label: 'FLAG', tone: 'danger', text: 'A warning sign on one check.' },
    {
      label: 'UNKNOWN',
      tone: 'neutral',
      text: 'We could not check this. It is not a good or bad sign.',
    },
    { label: 'OK', tone: 'ok', text: 'Nothing looked wrong on this check.' },
  ],
  faq: [
    {
      question: 'Do I need an account?',
      answer: 'No. An account just saves your past checks.',
    },
    {
      question: 'Does a low score mean it is safe?',
      answer: 'No. It means we found fewer warning signs. Still verify in person.',
    },
    {
      question: 'What if I get a high score?',
      answer: 'Stop and verify. Ask for ID and proof of ownership, and see the place first.',
    },
  ],
} as const;
