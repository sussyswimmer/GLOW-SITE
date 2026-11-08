/* ═══════════════════════════════════════════════════════════
   Tuition and payment settings — the one file to edit when the
   foundation decides what GLOW costs and how learners pay.

   EVERYTHING HERE IS A PLACEHOLDER until Pacific Links confirms it.
   `amount: null` is rendered as "to be announced", never as a number
   and never as "free" — GLOW is a paid programme, and a made-up price
   on a page learners read is worse than an honest blank.

   Nothing here is learner data. A learner's payment STATUS will come
   from the payment provider once one is chosen (see `provider`); this
   tier still stores nothing.
   ═══════════════════════════════════════════════════════════ */

export const TUITION = {
  /* Whole VND, e.g. 1500000. null = not decided yet. */
  amount: null,
  currency: 'VND',
  /* What one payment covers, e.g. "Một học kỳ (6 tháng)" / "One term (6 months)".
     null = not decided yet. */
  termVi: null,
  termEn: null,
  /* What the fee includes. Empty = "to be announced" on the page. Fill it only
     once the foundation confirms; until then a list here would be a promise.
     Candidates, e.g.:
       { vi: 'Toàn bộ khoá học trên GLOW', en: 'Every course on GLOW' },
       { vi: 'Lớp hội thoại ETOP một kèm một với tình nguyện viên', en: 'One-to-one ETOP conversation classes with a volunteer' },
       { vi: 'Lộ trình tự học tiếng Anh và tài nguyên giáo dục', en: 'English self-study tracks and educational resources' }, */
  includes: [],
};

/* The payment provider, once there is one (VietQR, Stripe, VNPay…).
   shortcut: null means "online payment coming soon" and the pay button is
   disabled; wire a provider in getBilling() of each adapter when one is chosen. */
export const PROVIDER = null;

/* Where learners go to ask about paying, or to ask for fee support.
   Site-relative Moodle paths, opened through /api/sso so the learner
   arrives signed in. Moodle 4.1+ ships "Contact site support" at this path.
   It does NOT send a signed-out visitor through login (without auth_userkey
   they land on the Moodle home page), and it needs "Support availability"
   set to authenticated users — test both links as a real learner before
   launch. See docs/MOODLE-SETUP.md §5.
   shortcut: one generic support form for both; point `aidPath` at a
   dedicated fee-support form (e.g. /mod/feedback/complete.php?id=N) when
   the foundation sets one up. */
export const CONTACT = {
  payPath: '/user/contactsitesupport.php',
  aidPath: '/user/contactsitesupport.php',
};

/** The billing payload both adapters return, for a given status. */
export function billingFor(status, history = []) {
  return {
    status,
    tuition: { ...TUITION, includes: TUITION.includes.map(i => ({ ...i })) },
    provider: PROVIDER,
    contact: { ...CONTACT },
    history,
  };
}
