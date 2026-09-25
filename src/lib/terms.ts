// The Terms & Conditions students accept at sign-up. Shown in a pop-up from
// the registration form (components/TermsDialog.tsx). Plain English on
// purpose: most readers are 15–19 and on a phone.
//
// Confirmed by the academy on 2026-09-24: fees are not refundable.

export const TERMS_UPDATED = '24 September 2026'

export interface TermsSection {
  title: string
  body: string[]
}

export const TERMS: TermsSection[] = [
  {
    title: '1. Who we are',
    body: [
      'Distinguished Scholars Academy ("DSA", "we", "us") runs tutorials and an online portal for students preparing for WAEC, JAMB, Post-UTME, 100-level and preclinical examinations, as well as summer and after-school classes.',
      'These terms cover our website (dsatutelage.com), the student portal, the community rooms, and our classes, whether online or in person. By creating an account you agree to them.',
    ],
  },
  {
    title: '2. Your account',
    body: [
      'Give us your real name, a working email address and a WhatsApp number you can be reached on. Registration is free; we email you a code to confirm your address before the account is opened.',
      'One account per person. Keep your password to yourself — anything done under your login is your responsibility. Tell us at once if you think someone else has used it.',
      'If you are under 18, a parent or guardian should know you have registered. We will ask for their contact details in your portal so we can keep them informed about your progress and fees.',
    ],
  },
  {
    title: '3. Free access and paid plans',
    body: [
      'A free account gives you the community rooms, free quizzes and announcements. Tutorials, live classes, full CBT practice and other premium features are unlocked by paying for a plan from your dashboard.',
      'What each plan includes, how long it runs and what it costs are shown before you pay. Plans do not renew on their own; when one ends you choose whether to pay again.',
    ],
  },
  {
    title: '4. Payments',
    body: [
      'Online payments are handled by Paystack. We never see or store your card details. Bank transfers are confirmed by our staff after you upload proof of payment; until then your access is provisional.',
      'All fees are in Nigerian naira. Fees are not refundable, so please check the plan you are choosing before you pay. If you think a payment has gone wrong, contact us and we will look into it.',
    ],
  },
  {
    title: '5. Classes, attendance and conduct',
    body: [
      'Attend the classes you enrolled for, complete assignments and assessments honestly, and treat tutors and fellow students with respect.',
      'Cheating in quizzes, mock exams or CBT practice — sharing answers, sitting an exam for someone else, or using anything not allowed — is not accepted. Results may be cancelled and the account suspended.',
    ],
  },
  {
    title: '6. The community rooms',
    body: [
      'The rooms exist for learning. No abuse, harassment, hate speech, sexual content, spam or advertising, and no sharing of other people’s personal details or leaked examination papers.',
      'Tutors and admins may remove messages, mute or remove members, and lock a room during a lesson. Messages are kept so that reports can be checked.',
    ],
  },
  {
    title: '7. Assessments, results and leaderboards',
    body: [
      'Quizzes and mock exams are for practice. A score on our portal is not a promise of how you will do in the real examination.',
      'Your name and score may appear on a leaderboard seen by other students who took the same quiz. If an answer key is found to be wrong, tutors may re-mark and your score may change.',
    ],
  },
  {
    title: '8. Our content and yours',
    body: [
      'Lessons, notes, videos, question banks and quizzes belong to DSA or to those who license them to us. They are for your own study. Do not copy, record, resell or pass them to people outside the academy.',
      'Assignments you submit and messages you post remain yours. You allow us to show them inside the portal for the purposes of teaching, marking and moderation.',
    ],
  },
  {
    title: '9. Your information',
    body: [
      'We collect what we need to teach you: your name, email, WhatsApp number, gender, date of birth, state, school, class and programme, department, an optional photo, your guardian’s contact details, payment references (never card numbers), attendance, scores and the messages you post.',
      'We use it to run your account and classes, send codes, results and reminders by email or WhatsApp, keep your guardian informed, take payments, keep the community safe and improve the service. We do not sell your data. It is shared only with the services that help us run the portal (email delivery, payments, hosting) and with your linked guardian.',
      'Under the Nigeria Data Protection Act 2023 you may ask to see, correct or delete your data by emailing dsatutelage@gmail.com. We keep it while your account is active and for a reasonable time afterwards, unless you ask us to delete it.',
    ],
  },
  {
    title: '10. Parents and guardians',
    body: [
      'A parent or guardian with a linked account can see attendance, results, fees and tutor notes for their ward. By adding someone as your guardian you confirm you are allowed to share their details with us.',
    ],
  },
  {
    title: '11. Suspending or closing an account',
    body: [
      'We may suspend or close an account for breaking these terms, cheating, abuse, or unpaid fees, giving notice where it is reasonable to do so. You may close your account at any time by emailing us.',
    ],
  },
  {
    title: '12. Availability and changes',
    body: [
      'We work to keep the portal available but cannot promise it will never be interrupted by network, power or maintenance. We may change features, the price of future plans, or these terms; important changes are announced in the portal, and continuing to use the service means you accept them.',
    ],
  },
  {
    title: '13. Contact and law',
    body: [
      'Questions about these terms: dsatutelage@gmail.com or +234 906 186 4717. These terms are governed by the laws of the Federal Republic of Nigeria.',
    ],
  },
]
