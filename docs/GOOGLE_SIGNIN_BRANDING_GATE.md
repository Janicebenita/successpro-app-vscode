# Google sign-in brand gate

The customer-facing domain is `successpro.xfactor.ltd`, but the active Firebase
Authentication web configuration still uses
`successpro-staging-1706786b.firebaseapp.com` as its `authDomain`. The Google
Auth Platform Branding screen has the app name `SuccessPro` and support email
`support@successpro.xfactor.ltd`; those saved values alone do not replace the
Firebase domain shown during an unverified OAuth consent flow.

The application has an isolated 0%-traffic revision with a transparent rewrite
from `/__/auth/:path*` to the Firebase auth helper. Its `/__/auth/handler` and
`/__/auth/iframe` bodies matched the Firebase originals in live HTTP checks.
This revision does **not** change `authDomain` and therefore does not fix the
customer-facing sign-in screen yet.

Before changing the active auth domain:

1. Confirm Google Auth Platform → Audience is **In production** for project
   `successpro-staging-1706786b`, with an external audience.
2. In Branding, ensure the homepage is `https://successpro.xfactor.ltd/`, the
   privacy-policy URL is a public page on that domain, the terms URL is public,
   and the authorized domain includes `xfactor.ltd` or the verified subdomain.
   The same Google account with project Owner/Editor rights must have verified
   domain ownership in Search Console.
3. In the OAuth web client with ID ending `...dkqfc.apps.googleusercontent.com`,
   authorize `https://successpro.xfactor.ltd/__/auth/handler` as a redirect URI.
   Keep the Firebase callback URI during migration.
4. Verify the brand and publish it when Google offers those actions. Branding
   verification/publishing is controlled by Google and may not be immediate.
5. Build with `_FIREBASE_AUTH_DOMAIN=successpro.xfactor.ltd` and deploy at
   0% traffic. Test Google sign-in end to end with a test account, including
   mobile and browsers with third-party-cookie restrictions. Check the exact
   consent-screen text, callback, account session, and logout.
6. Promote the new revision only after the checks pass. Retain the preceding
   revision for rollback.

Do not switch `authDomain` before step 3: that would send Google users to an
unregistered callback and break sign-in. Do not claim the visible app name is
fixed until a new Google consent screen actually says `SuccessPro`.

References: [Google OAuth branding](https://support.google.com/cloud/answer/15549049?hl=en),
[Firebase custom-domain auth proxy](https://firebase.google.com/docs/auth/web/redirect-best-practices),
[Firebase Google sign-in](https://firebase.google.com/docs/auth/web/google-signin).
