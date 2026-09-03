# Handing GLOW over to Pacific Links

The goal of this document is that on the day you stop working on this, the
foundation can run, change, fix and if necessary rebuild the site **without
you**, and that nothing you personally hold is still required for it to keep
working.

Work through it in order. Steps 1–3 should happen *before* the build is
finished, not after — the ones people leave to the end are the ones that
turn out to be impossible.

---

## The principle

> Every account, secret and domain the site depends on must be **owned by
> Pacific Links** and **accessible to at least two people there**.

If any single answer to "who can get into that?" is your name, it is not
handed over yet.

---

## 1. Accounts — do this first

Everything below is created **by Pacific Links, under a Pacific Links
address**, and you are added as a collaborator they can remove. Not the
other way round. Several of these services cannot transfer ownership of an
existing project between accounts, so "I'll move it later" quietly means
"I'll rebuild it later".

Use a shared role address — `tech@pacificlinks.org` or similar — not any one
staff member's personal mailbox. People leave; the site outlives them.

| What | Who owns it | Notes |
|---|---|---|
| Domain / DNS | Pacific Links | Registrar login, with two staff on it |
| Hosting (the Node app) | Pacific Links | See `docs/DEPLOY.md` |
| Source repository | Pacific Links org | You are a collaborator |
| Content editor accounts | Pacific Links | Netlify Identity, **invite only**. See `docs/CMS-SETUP.md` |
| Moodle (`glow.mata9.com`) | Pacific Links | Already theirs — confirm two admins exist |
| Error monitoring, if added | Pacific Links | |
| Password manager vault | Pacific Links | Where all of the above live |

**There is no separate database to hand over.** The site stores nothing:
Moodle remains the only system holding learner records, and it is already
theirs. That is a deliberate design decision — see `docs/ARCHITECTURE.md` —
and it removes the single most burdensome thing a handover usually carries.

## 2. Two named people, not one

Pick, and write into this file:

- **Owner** — the Pacific Links staff member accountable for the site.
- **Deputy** — a second person with equal access.

```
Owner:   ______________________  ______________________
Deputy:  ______________________  ______________________
Reviewed on: ____________
```

A single admin is not a handover, it is a hostage situation waiting to
happen. Review these names annually and whenever someone leaves.

## 3. Secrets

| Secret | Where it lives | Rotate at handoff? |
|---|---|---|
| `SESSION_SECRET` | Host secret store | **Yes** |
| Moodle admin passwords | Password manager | **Yes** |
| Registrar / hosting logins | Password manager | **Yes** |

**Rotate every one of them on handover day.** Not because anyone is
distrusted — because "who has ever seen this value?" should have a short and
current answer, and because rotating proves the client can actually do it
while you are still available to help.

Rotating `SESSION_SECRET` signs every learner out. That is the intended
behaviour, and it is worth doing once with them watching so they have seen
the emergency procedure work.

**If a secret is ever committed to git:** rotate it first, then worry about
the history. A value in a public repository is compromised the moment it is
pushed; removing the commit afterwards does not un-publish it.

## 4. The walkthrough

Do this live, with the owner and deputy, on their own machines, from their
own accounts. Roughly 90 minutes. Do not do it by sending a document.

They should each perform, themselves:

- [ ] Sign in to the hosting dashboard and see the running service
- [ ] Read the logs and find a specific sign-in event
- [ ] Change an environment variable and redeploy
- [ ] Take the site down and bring it back up
- [ ] **Rotate `SESSION_SECRET`** and confirm they get signed out
- [ ] Add a course in Moodle and watch it appear on the site
- [ ] Edit a line of front-page text at `/admin`, publish it, and wait for
      it to go live — so the two-minute delay is not a surprise later
- [ ] Write and publish a story, then delete the sample one
- [ ] Find and read `docs/OPERATIONS.md`
- [ ] Sign in to the site as a real learner

The point is not that they memorise it. The point is that they have done it
once, so the first time is not during an outage.

## 5. Explain the shape of the thing

They need to hold one idea, not an architecture diagram:

> **Moodle is where the courses and the learners live. The new site is a
> nicer way to look at Moodle. To change what learners see, change it in
> Moodle — the site follows automatically.**

Corollaries worth saying out loud:

- Adding a course, enrolling a learner, editing a quiz: **all in Moodle**,
  exactly as they do today. Nobody needs to touch the new site.
- The *words* on the marketing pages, and any news story, they change
  themselves at `/admin` — no developer, no deploy. `docs/CMS-SETUP.md`.
- The *design* — layout, colour, motion, and how many of a thing the page
  can hold — still needs a developer.
- If the new site goes down, **Moodle is unaffected** and learners can still
  work at `glow.mata9.com`. This is the reassurance to give first in an
  incident.

## 6. Written record

Fill in and keep with the site:

```
Live URL:            ______________________
Hosting provider:    ______________________
Repository:          ______________________
Moodle:              https://glow.mata9.com
Moodle admins:       ______________________
Deployed from:       branch ______  auto-deploy: yes / no
Support ends:        ____________
After that, contact: ______________________
```

## 7. Agree what happens next

Say plainly which of these is true, and put it in writing:

- [ ] **Fixed support window** — you fix defects until `____`, then stop.
- [ ] **Ongoing maintenance** — a retainer, with an agreed response time.
- [ ] **Clean break** — handover completes and there is no further work.

Whichever it is, tell them the thing they will not think to ask:

> **Dependencies need updating even when nothing changes.** Node and the
> packages this uses receive security patches. A site nobody touches for two
> years is not stable, it is unpatched. Budget an afternoon every few months,
> or arrange for someone to.

## 8. Before you call it done

- [ ] Every account in §1 is owned by Pacific Links
- [ ] Two named people have full access, and both have signed in
- [ ] Every secret rotated, and the client did at least one rotation
- [ ] `.env` is not in the repository (`git log --all -- .env` is empty)
- [ ] The walkthrough happened, with both people present
- [ ] `npm ci && npm run build && npm start` works on a clean machine
- [ ] `node tools/smoke.mjs` passes against the live site
- [ ] Identity is invite-only, Git Gateway is on, and both named people
      have published a real content change themselves
- [ ] §2 and §6 above are filled in
- [ ] They have been told, in writing, what happens after the support window

---

## The honest risk list

Give them this. A handover that only lists what works is not a handover.

1. **This site depends on Moodle staying up and keeping its web services
   enabled.** If an admin turns web services off, or a Moodle upgrade
   changes the API, the new site stops working. Moodle itself keeps
   working — learners can always use `glow.mata9.com` directly. Test the
   site after every Moodle upgrade.
2. **Nobody at Pacific Links currently maintains JavaScript.** Design and
   behaviour changes need a developer. Content changes do not.
3. **The content editor depends on Netlify Identity, which is a legacy
   product.** It signs staff in and Git Gateway turns their saves into
   commits. Netlify has been restricting Identity to sites already using
   it, and if it is ever withdrawn, staff lose the ability to edit their
   own copy until someone moves the editor to a different backend. The
   site itself keeps working — the words are plain files in the
   repository, and a developer can still change them. Confirm Identity is
   actually enabled before handover day, not after. See
   `docs/CMS-SETUP.md`.
4. **The support window ends.** After it, unpatched dependencies accumulate.
5. **`auth_userkey`, if installed, mints login URLs.** It is the most
   security-sensitive component. Disable it first if this site is ever
   retired.
6. **Learner data is sensitive.** GLOW serves young people including
   participants in an anti-trafficking programme. The site was built to hold
   none of it, which removes most of this risk — but Moodle holds all of it,
   and Moodle's own security, backups and access list matter more than
   anything in this repository. Confirm somebody owns that.
