// Where students send tuition, and who to call when a payment is slow to be
// confirmed. Shown on the Unlock page. Change here, and it changes everywhere.

export const BANK = {
  bank: 'First City Monument Bank (FCMB)',
  accountNumber: '2008011827',
  accountName: 'DSA TUTELAGE LIMITED',
} as const

/** Helpline for payment questions, as dialled from Nigeria. */
export const HELPLINE = '09061864717'
/** Same number in international form, for tel: and WhatsApp links. */
export const HELPLINE_INTL = '+2349061864717'

/** How long a student should wait before chasing a pending payment. */
export const VERIFY_WINDOW_TEXT = '1 hour'
