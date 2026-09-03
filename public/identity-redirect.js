/* Netlify Identity's invitation, confirmation and recovery emails all link
   to the SITE ROOT with a one-time token in the URL hash. The thing that
   consumes those tokens — the Identity widget — lives on /admin/, so this
   hop is the landing page's entire involvement with the CMS. For every
   ordinary visitor the test fails on an empty hash and nothing happens. */
(function () {
  if (/(invite_token|recovery_token|confirmation_token|email_change_token)=/.test(location.hash)) {
    location.replace('./admin/' + location.hash);
  }
})();
