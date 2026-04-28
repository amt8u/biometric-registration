# Blue Ridge — Resident Registry (Google Apps Script)

Apps Script web-app version of the resident-registration form. Meant to be
deployed inside your Google Workspace and embedded into a Google Sites page.

## Files

| File | Purpose |
|---|---|
| `appsscript.json` | Manifest — declares OAuth scopes, sets the web app to run as the deployer and be accessible domain-wide. |
| `Code.gs` | Server logic: `doGet`, validation, Drive folder creation, file uploads, Sheet writes, PDF generation, email, admin login, deletion log. |
| `Index.html` | Main HTML served by `doGet`. |
| `Stylesheet.html` | CSS (included via `<?!= include('Stylesheet') ?>`). |
| `JavaScript.html` | Client JS — talks to the server via `google.script.run`. No direct OAuth / no `localStorage`. |
| `Certificate.html` | HTML template for the registration PDF (rendered server-side, attached to the confirmation email, and also stored in Drive). |

## How data flows

1. User fills the 4-step form in the browser.
2. On submit, files are base64-encoded and the whole payload is sent to
   `submitRegistration()` via `google.script.run`.
3. Server re-validates every field and the BIN, checks the tracking Sheet for
   duplicates, then:
   - Creates `DriveRoot / <BIN> / <Owner|Tenant> / <Person-ID>/` folder trees.
   - Uploads the documents.
   - Appends a row to the `Registrations` sheet and one row per family
     member to the `Family Members` sheet.
   - Generates a PDF certificate (Certificate.html → `application/pdf` blob),
     saves it into the BIN folder, and emails it to the resident + the
     configured society manager email (via `MailApp`).
4. Success screen shows the BIN and a link to the Drive folder.

Admin dashboard reads the same Sheet. Deletions are soft (row marked
`DELETED`) and also appended to the `Deletion Log` sheet.

## First-time setup

1. In the Google account that owns the society Drive:
   - Manually create:
     - a **Google Drive folder** (anywhere in My Drive / Shared Drive) that
       will hold all registration sub-folders.
     - a **Google Spreadsheet** that will hold the `Registrations`,
       `Family Members`, and `Deletion Log` tabs (the script creates these
       tabs automatically on first use — start with a blank sheet).
   - Note their IDs from the URLs:
     - Folder: `drive.google.com/drive/folders/<DRIVE_ROOT_ID>`
     - Sheet:  `docs.google.com/spreadsheets/d/<SHEET_ID>/edit`
2. Create a new Apps Script project at <https://script.google.com/>
   (standalone). Copy the files from this folder into the project.
   Make `appsscript.json` visible via *Project Settings → Show
   "appsscript.json" manifest*.
3. In **Project Settings → Script Properties** add:
   - `DRIVE_ROOT_ID` — the folder id from step 1
   - `SHEET_ID`      — the spreadsheet id from step 1
4. From the editor run **`setupDefaults`** once. This seeds the optional
   defaults (admin email / password / society name) and validates that the
   Drive folder and spreadsheet are accessible. It will **not** create any
   new Drive folder or spreadsheet.
5. **Deploy → New deployment → Web app**
   - *Execute as:* **Me**
   - *Who has access:* **Anyone within `yourdomain.com`**
   - Copy the resulting `/exec` URL.
6. Open your Google Site → **Insert → Embed → By URL**, paste the web-app
   URL. Publish the site.

## Changing settings after deployment

Open the deployed web app → click **🔐 Admin** → log in with the current
password. The *Settings* tab lets you update:

- Society manager email (receives a copy of every registration + PDF)
- Society name (used in PDF + subject line)
- Admin password
- Google Drive Folder ID
- Google Sheet ID

All of these are persisted via `PropertiesService.getScriptProperties()` —
no secrets are kept in the HTML.

## Script Property keys

| Key | Required | Default | Notes |
|---|---|---|---|
| `DRIVE_ROOT_ID` | **yes** | — | Must be set before first submission. |
| `SHEET_ID` | **yes** | — | Must be set before first submission. |
| `ADMIN_EMAIL` | no | `anupam.tripathi@blueridge.co.in` | CC'd on every submission email. |
| `ADMIN_PASSWORD` | no | `blueridge@123` | Change immediately after deployment. |
| `SOCIETY_NAME` | no | `Blue Ridge` | Appears on PDFs + emails. |

## Embedding tips

- Google Sites iframes resize height, so the form's sticky header and
  multi-step UI already work without extra JS.
- If you need the URL before completing deployment, run `getPublicConfig()`
  from the editor — `webAppUrl` is returned once the web app has been
  deployed at least once.

## Notes / differences from the original HTML version

- Removed the QR-code tab (the Google Sites page URL is what residents
  share; no need to self-generate a QR).
- Removed the in-page Excel export — the tracking Google Sheet is the
  source of truth. Open it directly from Admin → *Open Sheet*.
- PDF is now generated server-side from `Certificate.html` instead of
  browser-side jsPDF.
- No Google OAuth client ID is ever embedded on the page: the deploying
  account's identity is used for all Drive / Gmail actions.
