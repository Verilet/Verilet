/**
 * All "how Verilet works" wording lives here so the landing page, the How it works page and the
 * results page explain things the same way. Edit text here, not in the views.
 */

/** One of the three steps on the landing page. */
export interface GuideStep {
  /** Short step name, e.g. "Paste the link". */
  title: string;
  /** One sentence about the step. */
  text: string;
}

/** One check Verilet runs, as explained on the landing and How it works pages. */
export interface GuideCheck {
  /** Stable ID, matching the check IDs in results. */
  id: string;
  /** Check name, e.g. "Payment method". */
  title: string;
  /** What we do (one sentence). */
  what: string;
  /** Why it matters (one sentence). */
  why: string;
  /** What is happening at this stop, shown in the How it works status bar. */
  status: string;
}

/** One stop on the How it works road. */
export interface GuideStop {
  /** "Stop 1" ... "Stop 5", "Finish". */
  label: string;
  /** Stop name. */
  title: string;
  /** What we do at this stop (one sentence). */
  what: string;
  /** Why it matters (one sentence). */
  why: string;
  /** What is happening at this stop, shown in the How it works status bar. */
  status: string;
}

/** The three steps on the landing page. */
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

/** The checks Verilet runs, in the order they are explained. */
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
    id: 'contact',
    title: 'Contact info',
    what: 'We check if the phone number has a local area code and the email is from a trusted domain.',
    why: 'Scammers often use out-of-area numbers and throwaway email addresses.',
    status: 'Checking the phone number and email',
  },
  {
    id: 'details',
    title: 'Listing details',
    what: 'We read the listing text and photos for signs it was copied or rushed.',
    why: 'A normal-looking listing does not prove it is real.',
    status: 'Reading the listing text and photos',
  },
];

/** The How it works road: the link, each check, then the finish. */
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

/** All the wording for the landing, How it works, results and log in pages. */
export const GUIDE = {
  eyebrow: 'RENTAL SCAM CHECK FOR STUDENTS',
  headline: { prefix: 'Check a rental listing', accent: 'before you pay' },
  pitch:
    'Verilet looks for common scam signs in a rental listing and gives you a clear risk rating, with the reasons behind it.',
  reassurance: 'No account needed · Takes about a minute',
  ctaLabel: 'Check a listing',
  howLabel: 'See how it works',
  tripLinkLabel: 'See every stop on the road',
  auth: {
    eyebrow: 'VERILET ACCOUNT',
    signIn: {
      title: 'Log in to Verilet',
      text: 'Log in to keep your checks and come back to them later.',
    },
    signUp: {
      title: 'Create your Verilet account',
      text: 'It takes a minute. You can still check a listing without one.',
    },
    points: [
      'Every check is saved to your account.',
      'Come back to a result any time, on any device.',
      'Verilet never sees or stores your password.',
    ],
    unavailableTitle: "Sign-in isn't available",
    unavailableText: 'Sign-in is unavailable right now. Please try again later.',
    unavailableDevText:
      'Sign-in is not set up yet. Add VITE_CLERK_PUBLISHABLE_KEY to client/.env and restart the dev server.',
    logInLabel: 'Log in',
  },
  legendHeading: 'How to read your result',
  listingDemo: {
    label: 'EXAMPLE LISTING',
    title: 'Sunny 2 bed near campus',
    description: 'Available now. Must rent this week. No viewings, the owner is overseas.',
    rent: '$1,200 / month',
    location: 'Santa Cruz, CA',
    poster: 'Posted by Sam · (305) 555-0142',
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
      {
        title: 'Contact info',
        detail: 'Phone number is not from a local area code',
        status: 'FLAG',
      },
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
