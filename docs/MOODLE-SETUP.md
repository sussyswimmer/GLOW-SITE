# Connecting the site to the real Moodle

**Who does this:** a Moodle site administrator at Pacific Links.
**How long:** about 20 minutes.
**What it changes on the platform:** nothing a learner sees. No courses are
edited, no accounts are touched, no data is moved. You are switching on a
read interface that Moodle already ships with.

Until this is done the site runs on `DATA_SOURCE=mock` and shows a standing
"sample data" banner on every page. Everything works; the content is
illustrative. Nothing else has to change to go live — see step 6.

---

## What the site actually needs, and what it does not

It reads. Specifically it reads, **as the signed-in learner and never as
anyone else**:

- who they are
- which courses they are enrolled in, and their progress
- the contents of those courses
- their upcoming calendar events

It does **not** need, and must not be given: the ability to create or
modify users, to change grades, to enrol anyone, or to read another
learner's data. The service below is scoped accordingly.

There is no administrator token anywhere in this system. Each learner's
session carries a token issued to *them*, so Moodle's own permission checks
still apply to every single call. A bug in this site cannot read data the
learner could not already see by logging into Moodle directly.

---

## 1. Turn on web services

> **This appears to be done already.** Probing `glow.mata9.com/login/token.php`
> with empty credentials returns `invalidlogin` rather than
> `enablewsdescription`, which means the request got past the
> "are web services enabled?" check. Confirm in the UI anyway — it costs ten
> seconds and the probe cannot see configuration, only behaviour.
>
> Re-run that probe any time with `npm run check` (`DATA_SOURCE=moodle`).

**Site administration → Advanced features**

- ☑ **Enable web services** (`enablewebservices`)

Save.

## 2. Enable the REST protocol

**Site administration → Server → Web services → Manage protocols**

- Enable **REST protocol**. Leave the others alone.

## 3. Create a dedicated external service

**Site administration → Server → Web services → External services → Add**

| Field | Value |
|---|---|
| Name | `GLOW front end` |
| Short name | `glow_frontend` |
| Enabled | ☑ |
| Authorised users only | ☐ **unticked** |
| Can download files | ☑ |
| Can upload files | ☐ |

> **Why "Authorised users only" is unticked.** Ticking it means an admin has
> to add every learner by hand before they can sign in, and again for every
> new learner forever. Unticked, any account that can already log into
> Moodle can use the service — which is the same set of people, without the
> ongoing admin work. Access is still per-learner and still limited by their
> own role.

Save, then click **Functions** on the new service and add exactly these:

```
core_webservice_get_site_info
core_enrol_get_users_courses
core_course_get_contents
core_course_get_categories
core_course_get_courses_by_field
core_calendar_get_action_events_by_timesort
message_popup_get_unread_popup_notification_count
```

That list is the whole surface. If a future feature needs more, it should be
added deliberately, one at a time — this list is also the security boundary.

## 4. Let learners obtain a token

The learner's own account needs the capability to create a web-service token
for itself.

**Site administration → Users → Permissions → Define roles → Authenticated user**

- Allow `moodle/webservice:createtoken`
- Allow `webservice/rest:use`

On most Moodle sites both are already allowed for authenticated users. Check
rather than assume — if they are not, sign-in fails with an error that looks
like a wrong password, which is a confusing thing to debug later.

## 5. Optional but recommended — seamless hand-off into Moodle

Quizzes, assignments and the ETOP scheduler stay in Moodle. Without this
step, a learner clicking one of those is asked to log in a second time.
With it, they arrive already signed in.

1. Install the **auth_userkey** plugin
   (`Site administration → Plugins → Install plugins`).
2. Enable it under **Plugins → Authentication → Manage authentication**.
3. Configure:
   - **User field mapping**: `username`
   - **Key lifetime**: 60 seconds
   - **IP restriction**: ☑ enabled
   - **Logout URL**: leave blank
4. Add `auth_userkey_request_login_url` to the `glow_frontend` service
   function list from step 3.

The site detects whether this is available and degrades gracefully: if the
call fails it links straight to the Moodle page instead, and the learner
signs in once. Nothing breaks either way.

> **Security note on this step.** `auth_userkey` mints short-lived login
> URLs, so it is the highest-privilege thing in this setup. Keep the key
> lifetime short, keep the IP restriction on, and if the site is ever
> decommissioned, disable this plugin first.

## 6. Point the site at it

In the host's environment settings (not in a file in the repository):

```
DATA_SOURCE=moodle
MOODLE_URL=https://glow.mata9.com
MOODLE_SERVICE=glow_frontend
```

Redeploy. The "sample data" banner disappears on its own — it is driven by
`DATA_SOURCE`, so it cannot be left on by accident or turned off while the
data is still fake.

---

## Checking it worked

```bash
curl https://YOUR-SITE/api/health
```

Expect `{"ok":true,"mode":"moodle","demo":false}`.

Then sign in with a **real learner account** — not an admin one. An admin
sees different courses and will not tell you whether a learner's view works.

Confirm:
- their real name is in the top right
- their real enrolled courses are listed, with real progress
- clicking an activity opens the right thing in Moodle
- signing out and revisiting `/dashboard.html` sends you back to sign-in

## When something is wrong

| Symptom | Almost always |
|---|---|
| Every sign-in fails, correct password | Step 4 — the token capability is not allowed |
| `invalidtoken` in the logs | The service in `MOODLE_SERVICE` is disabled or misspelled |
| Signs in, but no courses | The learner genuinely has no enrolments, or `core_enrol_get_users_courses` is missing from the service |
| Course pages empty | `core_course_get_contents` missing from the service |
| Images do not load | "Can download files" unticked on the service |
| A second login when opening a quiz | Step 5 not done — this is expected and harmless |

The server logs the Moodle error code for every refused call, and never logs
a password or a token. `docs/OPERATIONS.md` covers reading them.
