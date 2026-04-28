/**
 * Blue Ridge — Resident Registry
 * Google Apps Script web-app backend.
 *
 * Deploy as: Web app
 *   Execute as: Me (the script owner)
 *   Who has access: Anyone within <your workspace domain>
 *
 * CONFIGURATION (required before first use):
 *   Set the following Script Properties manually
 *   (Project Settings → Script Properties) OR via Admin → Settings:
 *     • DRIVE_ROOT_ID — id of an existing Google Drive folder
 *     • SHEET_ID      — id of an existing Google Spreadsheet
 *
 *   Optional properties (have sensible defaults):
 *     • ADMIN_EMAIL, ADMIN_PASSWORD, SOCIETY_NAME
 *
 * The script will NOT create Drive folders or Spreadsheets on its own.
 * It will only ensure the required tabs / header rows exist inside the
 * spreadsheet you provide.
 */

// ─── Script Property keys ─────────────────────────────────────────────
var PROP = {
  ADMIN_EMAIL:    'ADMIN_EMAIL',
  ADMIN_PASSWORD: 'ADMIN_PASSWORD',
  SOCIETY_NAME:   'SOCIETY_NAME',
  DRIVE_ROOT_ID:  'DRIVE_ROOT_ID',
  SHEET_ID:       'SHEET_ID',
};

var DEFAULTS = {
  ADMIN_EMAIL:    'anupam.tripathi@blueridge.co.in',
  ADMIN_PASSWORD: 'blueridge@123',
  SOCIETY_NAME:   'Blue Ridge',
};

var SHEET_REGISTRATIONS = 'Registrations';
var SHEET_MEMBERS       = 'Family Members';
var SHEET_DELETIONS     = 'Deletion Log';

// ─── Web entry point ──────────────────────────────────────────────────
function doGet(e) {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Blue Ridge — Resident Registry')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ─── Initialisation ───────────────────────────────────────────────────
// Seeds optional defaults (admin email / password / society name) and
// verifies that the required Drive folder + spreadsheet IDs exist and
// are accessible. Does NOT create any Drive folder or Spreadsheet.
function setupDefaults() {
  var props = PropertiesService.getScriptProperties();
  Object.keys(DEFAULTS).forEach(function (k) {
    if (!props.getProperty(k)) props.setProperty(k, DEFAULTS[k]);
  });
  getDriveRoot_();   // validates DRIVE_ROOT_ID
  initSheetTabs_();  // validates SHEET_ID + ensures tabs/headers
  return {
    driveFolderId: props.getProperty(PROP.DRIVE_ROOT_ID),
    sheetId:       props.getProperty(PROP.SHEET_ID),
  };
}

function getDriveRoot_() {
  var id = PropertiesService.getScriptProperties().getProperty(PROP.DRIVE_ROOT_ID);
  if (!id) throw new Error('DRIVE_ROOT_ID is not configured. Set it in Script Properties or Admin → Settings.');
  try {
    return DriveApp.getFolderById(id);
  } catch (e) {
    throw new Error('Unable to open Drive folder with id "' + id + '". Check the id and that the script owner has access.');
  }
}

function getSpreadsheet_() {
  var id = PropertiesService.getScriptProperties().getProperty(PROP.SHEET_ID);
  if (!id) throw new Error('SHEET_ID is not configured. Set it in Script Properties or Admin → Settings.');
  try {
    return SpreadsheetApp.openById(id);
  } catch (e) {
    throw new Error('Unable to open Spreadsheet with id "' + id + '". Check the id and that the script owner has access.');
  }
}

// Ensures the three required tabs + header rows exist in the provided
// spreadsheet. Does not modify any other tabs or data.
function initSheetTabs_() {
  var ss = getSpreadsheet_();
  var sheets = {
    regs: ss.getSheetByName(SHEET_REGISTRATIONS) || ss.insertSheet(SHEET_REGISTRATIONS),
    mem:  ss.getSheetByName(SHEET_MEMBERS)       || ss.insertSheet(SHEET_MEMBERS),
    del:  ss.getSheetByName(SHEET_DELETIONS)     || ss.insertSheet(SHEET_DELETIONS),
  };

  if (sheets.regs.getLastRow() === 0) {
    sheets.regs.appendRow([
      'Timestamp', 'BIN', 'Type', 'Type Label', 'Tower', 'Flat', 'Residing',
      'Primary ID', 'Full Name', 'Mobile', 'Email',
      'ID Document', 'ID Number', 'Agreement No', 'Police Verif No',
      'Family Members', 'Member IDs', 'Member Names',
      'Drive Folder URL', 'Registration Date', 'Status',
    ]);
    sheets.regs.setFrozenRows(1);
  }
  if (sheets.mem.getLastRow() === 0) {
    sheets.mem.appendRow(['Timestamp', 'BIN', 'Member ID', 'Name', 'ID Number', 'Photo File', 'ID Doc File']);
    sheets.mem.setFrozenRows(1);
  }
  if (sheets.del.getLastRow() === 0) {
    sheets.del.appendRow([
      'Deleted Timestamp', 'BIN', 'Tower', 'Flat', 'Type', 'Type Label',
      'Primary Name', 'Primary Mobile', 'Primary Email', 'Member Count',
      'Registered On', 'Reason', 'Remarks', 'Drive Folder URL', 'Deleted By',
    ]);
    sheets.del.setFrozenRows(1);
  }
  return ss.getId();
}

// ─── Config (client-readable) ─────────────────────────────────────────
function getPublicConfig() {
  var p = PropertiesService.getScriptProperties();
  return {
    societyName: p.getProperty(PROP.SOCIETY_NAME) || DEFAULTS.SOCIETY_NAME,
    webAppUrl:   ScriptApp.getService().getUrl() || '',
  };
}

function getAdminConfig_(pw) {
  requireAdmin_(pw);
  var p = PropertiesService.getScriptProperties();
  return {
    societyName: p.getProperty(PROP.SOCIETY_NAME)  || '',
    adminEmail:  p.getProperty(PROP.ADMIN_EMAIL)   || '',
    driveRootId: p.getProperty(PROP.DRIVE_ROOT_ID) || '',
    sheetId:     p.getProperty(PROP.SHEET_ID)      || '',
  };
}

function adminLogin(pw) {
  var p = PropertiesService.getScriptProperties();
  var expected = p.getProperty(PROP.ADMIN_PASSWORD) || DEFAULTS.ADMIN_PASSWORD;
  if (pw !== expected) throw new Error('Incorrect password.');
  return getAdminConfig_(pw);
}

function requireAdmin_(pw) {
  var p = PropertiesService.getScriptProperties();
  var expected = p.getProperty(PROP.ADMIN_PASSWORD) || DEFAULTS.ADMIN_PASSWORD;
  if (pw !== expected) throw new Error('Admin authentication required.');
}

function saveAdminSettings(pw, settings) {
  requireAdmin_(pw);
  var p = PropertiesService.getScriptProperties();
  if (settings.societyName) p.setProperty(PROP.SOCIETY_NAME, settings.societyName);
  if (settings.adminEmail)  p.setProperty(PROP.ADMIN_EMAIL, settings.adminEmail);
  if (settings.driveRootId) p.setProperty(PROP.DRIVE_ROOT_ID, settings.driveRootId.trim());
  if (settings.sheetId)     p.setProperty(PROP.SHEET_ID, settings.sheetId.trim());
  if (settings.newPassword) p.setProperty(PROP.ADMIN_PASSWORD, settings.newPassword);
  return getAdminConfig_(settings.newPassword || pw);
}

// ─── Validation ───────────────────────────────────────────────────────
function validateRegistration_(r) {
  function bad(m) { throw new Error(m); }
  if (!r || typeof r !== 'object')               bad('Invalid payload.');
  if (r.type !== 'OWN' && r.type !== 'TEN')      bad('Invalid registration type.');
  if (!r.tower || !String(r.tower).trim())       bad('Tower is required.');
  if (!r.flat  || !String(r.flat).trim())        bad('Flat is required.');
  if (r.type === 'OWN' && r.residing !== true && r.residing !== false)
    bad('Please specify whether you are residing.');
  if (!r.bin || !/^T[^-]+-F[^-]+-(OWN|OWN-NR|TEN)$/.test(r.bin))
    bad('Invalid BIN.');
  if (!r.primary || !r.primary.name || !r.primary.name.trim()) bad('Primary full name is required.');
  if (!/^\d{10}$/.test(String(r.primary.mobile || '')))        bad('Valid 10-digit mobile required.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(r.primary.email || ''))) bad('Valid email required.');
  if (!r.primary.idType)                                       bad('ID document type required.');
  if (r.primary.idType === 'Other' && !r.primary.idOtherName)  bad('Specify ID document name.');
  if (!r.primary.idNo || !String(r.primary.idNo).trim())       bad('ID document number required.');

  var files = r.primary.files || {};
  if (!files.iddoc) bad('Upload ID document.');
  if (!files.photo) bad('Upload passport-size photograph.');
  if (r.type === 'OWN') {
    if (!files.indexii) bad('Upload Index II.');
  } else {
    if (!r.primary.agrNo) bad('Agreement number required.');
    if (!files.agr)       bad('Upload registered agreement.');
    if (!r.primary.pvNo)  bad('Police verification number required.');
    if (!files.pv)        bad('Upload police verification.');
  }

  (r.members || []).forEach(function (m, i) {
    if (!m.name || !m.name.trim()) bad('Name required for family member ' + (i + 1) + '.');
  });
}

// ─── Core: submit registration ────────────────────────────────────────
function submitRegistration(payload) {
  setupDefaults();
  validateRegistration_(payload);

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    // Duplicate check via sheet
    var ss = getSpreadsheet_();
    var regs = ss.getSheetByName(SHEET_REGISTRATIONS);
    var existingBins = regs.getLastRow() > 1
      ? regs.getRange(2, 2, regs.getLastRow() - 1, 1).getValues().map(function (r) { return r[0]; })
      : [];
    if (existingBins.indexOf(payload.bin) !== -1) {
      throw new Error('BIN "' + payload.bin + '" is already registered.');
    }

    // Drive structure
    var root = getDriveRoot_();
    var binFolder  = getOrCreateFolder_(root, payload.bin);
    var typeFolder = getOrCreateFolder_(binFolder, payload.type === 'OWN' ? 'Owner' : 'Tenant');
    var primaryId  = payload.bin + '-A';
    var primFolder = getOrCreateFolder_(typeFolder, primaryId);

    var labelMap = { indexii: 'IndexII', agr: 'Agreement', pv: 'PoliceVerification', iddoc: 'ID_Document', photo: 'Photo' };
    var primFiles = payload.primary.files || {};
    Object.keys(primFiles).forEach(function (k) {
      var f = primFiles[k];
      if (f && f.base64) {
        var ext = (f.name || '').split('.').pop() || 'bin';
        saveFile_(primFolder, (labelMap[k] || k) + '.' + ext, f);
      }
    });

    (payload.members || []).forEach(function (m, idx) {
      var memId = payload.bin + '-' + String.fromCharCode(66 + idx); // B, C, ...
      m._assignedId = memId;
      var memFolder = getOrCreateFolder_(typeFolder, memId);
      var mf = m.files || {};
      Object.keys(mf).forEach(function (k) {
        var f = mf[k];
        if (f && f.base64) {
          var ext = (f.name || '').split('.').pop() || 'bin';
          saveFile_(memFolder, (k === 'photo' ? 'Photo' : 'ID_Document') + '.' + ext, f);
        }
      });
    });

    var now = new Date();
    var dateStr = Utilities.formatDate(now, Session.getScriptTimeZone() || 'Asia/Kolkata', 'dd MMM yyyy');
    var typeLabel = payload.type === 'OWN'
      ? (payload.residing ? 'Owner (Residing)' : 'Owner (Not Residing)')
      : 'Tenant';
    var driveFolderUrl = binFolder.getUrl();

    // Sheet rows
    regs.appendRow([
      now, payload.bin, payload.type, typeLabel, payload.tower, payload.flat,
      payload.residing === null || payload.residing === undefined ? 'N/A' : (payload.residing ? 'Yes' : 'No'),
      primaryId, payload.primary.name, payload.primary.mobile, payload.primary.email,
      payload.primary.idType === 'Other' ? payload.primary.idOtherName : payload.primary.idType,
      payload.primary.idNo || '',
      payload.primary.agrNo || '',
      payload.primary.pvNo || '',
      (payload.members || []).length,
      (payload.members || []).map(function (m) { return m._assignedId; }).join(' | '),
      (payload.members || []).map(function (m) { return m.name; }).join(' | '),
      driveFolderUrl, dateStr, 'ACTIVE',
    ]);

    var memSheet = ss.getSheetByName(SHEET_MEMBERS);
    (payload.members || []).forEach(function (m) {
      memSheet.appendRow([
        now, payload.bin, m._assignedId, m.name, m.idNo || '',
        (m.files && m.files.photo && m.files.photo.name) || '',
        (m.files && m.files.iddoc && m.files.iddoc.name) || '',
      ]);
    });

    // Build record for PDF + email
    var record = {
      bin: payload.bin, tower: payload.tower, flat: payload.flat,
      type: payload.type, typeLabel: typeLabel, residing: payload.residing,
      primary: {
        id: primaryId,
        name: payload.primary.name, mobile: payload.primary.mobile, email: payload.primary.email,
        idType: payload.primary.idType === 'Other' ? payload.primary.idOtherName : payload.primary.idType,
        idNo: payload.primary.idNo || '',
        agrNo: payload.primary.agrNo || '', pvNo: payload.primary.pvNo || '',
        fileNames: mapFileNames_(primFiles),
      },
      members: (payload.members || []).map(function (m) {
        return {
          id: m._assignedId, name: m.name, idNo: m.idNo || '',
          fileNames: mapFileNames_(m.files || {}),
        };
      }),
      ts: now.toISOString(), dateStr: dateStr,
      driveFolderUrl: driveFolderUrl,
    };

    // PDF
    var pdfBlob = buildRegistrationPdf_(record);
    binFolder.createFile(pdfBlob.setName(payload.bin + '_Registration.pdf'));

    // Email
    try {
      var adminEmail = PropertiesService.getScriptProperties().getProperty(PROP.ADMIN_EMAIL) || DEFAULTS.ADMIN_EMAIL;
      var societyName = PropertiesService.getScriptProperties().getProperty(PROP.SOCIETY_NAME) || DEFAULTS.SOCIETY_NAME;
      MailApp.sendEmail({
        to: payload.primary.email,
        cc: adminEmail,
        subject: '[' + societyName + '] Registration Certificate — BIN: ' + payload.bin + ' | ' + payload.primary.name,
        body: buildEmailBody_(record, societyName),
        attachments: [pdfBlob],
        name: societyName + ' Registry',
      });
    } catch (e) {
      // Email failures should not fail the registration.
      Logger.log('Email failed: ' + e);
    }

    return { ok: true, bin: payload.bin, driveFolderUrl: driveFolderUrl, dateStr: dateStr };
  } finally {
    lock.releaseLock();
  }
}

function mapFileNames_(files) {
  var out = {};
  Object.keys(files || {}).forEach(function (k) { out[k] = files[k] && files[k].name || ''; });
  return out;
}

function getOrCreateFolder_(parent, name) {
  var it = parent.getFoldersByName(name);
  if (it.hasNext()) return it.next();
  return parent.createFolder(name);
}

function saveFile_(folder, name, f) {
  var bytes = Utilities.base64Decode(f.base64);
  var blob = Utilities.newBlob(bytes, f.mimeType || 'application/octet-stream', name);
  return folder.createFile(blob);
}

function buildEmailBody_(reg, societyName) {
  var lines = [
    '══════════════════════════════════════════',
    societyName.toUpperCase() + ' — RESIDENT REGISTRATION CERTIFICATE',
    '══════════════════════════════════════════',
    '',
    'BIN : ' + reg.bin,
    'Type: ' + reg.typeLabel,
    'Date: ' + reg.dateStr,
    '',
    '── PROPERTY ──────────────────────────────',
    'Tower : ' + reg.tower + '   Flat : ' + reg.flat,
    '',
    '── PRIMARY MEMBER (ID: ' + reg.primary.id + ') ────────',
    'Name      : ' + reg.primary.name,
    'Mobile    : ' + reg.primary.mobile,
    'Email     : ' + reg.primary.email,
    'ID Type   : ' + reg.primary.idType,
    'ID Number : ' + (reg.primary.idNo || '—'),
  ];
  if (reg.type === 'TEN') {
    lines.push('Agr. No.  : ' + reg.primary.agrNo);
    lines.push('Police V. : ' + reg.primary.pvNo);
  }
  if (reg.members.length) {
    lines.push('', '── FAMILY MEMBERS ────────────────────────');
    reg.members.forEach(function (m) {
      lines.push(m.id + ' : ' + m.name + (m.idNo ? '  [' + m.idNo + ']' : ''));
    });
  }
  if (reg.driveFolderUrl) {
    lines.push('', '── DOCUMENTS ─────────────────────────────');
    lines.push('Drive Folder: ' + reg.driveFolderUrl);
  }
  lines.push('', '══════════════════════════════════════════');
  lines.push('This is a system-generated email from ' + societyName + ' Resident Registry.');
  return lines.join('\n');
}

// Build a simple HTML → PDF using Utilities (Apps Script converts text/html blobs to PDF).
function buildRegistrationPdf_(reg) {
  var tpl = HtmlService.createTemplateFromFile('Certificate');
  tpl.reg = reg;
  tpl.societyName = PropertiesService.getScriptProperties().getProperty(PROP.SOCIETY_NAME) || DEFAULTS.SOCIETY_NAME;
  var html = tpl.evaluate().getContent();
  return Utilities.newBlob(html, 'text/html', reg.bin + '.html').getAs('application/pdf');
}

// ─── Admin: list / delete ─────────────────────────────────────────────
function listRegistrations(pw) {
  requireAdmin_(pw);
  initSheetTabs_();
  var ss = getSpreadsheet_();
  var sh = ss.getSheetByName(SHEET_REGISTRATIONS);
  if (sh.getLastRow() < 2) return { regs: [], deletions: readDeletions_(ss) };

  var values = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  var regs = values.filter(function (row) { return row[20] === 'ACTIVE'; }).map(function (row) {
    return {
      ts: row[0] instanceof Date ? row[0].toISOString() : row[0],
      bin: row[1], type: row[2], typeLabel: row[3], tower: row[4], flat: row[5], residing: row[6],
      primary: { id: row[7], name: row[8], mobile: row[9], email: row[10], idType: row[11], idNo: row[12], agrNo: row[13], pvNo: row[14] },
      memberCount: row[15], memberIds: row[16], memberNames: row[17],
      driveFolderUrl: row[18], dateStr: row[19],
    };
  });
  return { regs: regs, deletions: readDeletions_(ss) };
}

function readDeletions_(ss) {
  var sh = ss.getSheetByName(SHEET_DELETIONS);
  if (sh.getLastRow() < 2) return [];
  var rows = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  return rows.map(function (row) {
    return {
      deletedTs: row[0] instanceof Date ? row[0].toISOString() : row[0],
      bin: row[1], tower: row[2], flat: row[3], type: row[4], typeLabel: row[5],
      primaryName: row[6], primaryMobile: row[7], primaryEmail: row[8], memberCount: row[9],
      registeredOn: row[10], reason: row[11], remarks: row[12], driveFolderUrl: row[13], deletedBy: row[14],
    };
  });
}

function deleteRegistration(pw, bin, reason, remarks) {
  requireAdmin_(pw);
  if (!bin)    throw new Error('BIN is required.');
  if (!reason) throw new Error('Reason is required.');

  var ss = getSpreadsheet_();
  var sh = ss.getSheetByName(SHEET_REGISTRATIONS);
  var data = sh.getRange(2, 1, Math.max(sh.getLastRow() - 1, 0), sh.getLastColumn()).getValues();
  var rowIdx = -1, row = null;
  for (var i = 0; i < data.length; i++) {
    if (data[i][1] === bin && data[i][20] === 'ACTIVE') { rowIdx = i + 2; row = data[i]; break; }
  }
  if (rowIdx === -1) throw new Error('BIN not found or already deleted.');

  // Mark as deleted
  sh.getRange(rowIdx, 21).setValue('DELETED');

  var delSheet = ss.getSheetByName(SHEET_DELETIONS);
  delSheet.appendRow([
    new Date(), row[1], row[4], row[5], row[2], row[3],
    row[8], row[9], row[10], row[15], row[19],
    reason, remarks || '', row[18], Session.getActiveUser().getEmail(),
  ]);
  return listRegistrations(pw);
}

function getSpreadsheetUrl(pw) {
  requireAdmin_(pw);
  return getSpreadsheet_().getUrl();
}

// ══════════════════════════════════════════════════════════════════════
// TEST / DIAGNOSTIC FUNCTIONS
// Run these from the Apps Script editor (function picker → Run).
// Each one logs its progress; open View → Executions to see the output.
// ══════════════════════════════════════════════════════════════════════

/**
 * Uploads a tiny text file into the configured Drive root folder, then
 * deletes it (trashes it). Verifies that DRIVE_ROOT_ID is correct and
 * that the script-owner account can both read AND write to the folder.
 */
function testUpload() {
  Logger.log('── testUpload ──────────────────────────────');
  var root = getDriveRoot_();
  Logger.log('Drive folder OK : ' + root.getName() + '  (' + root.getId() + ')');
  Logger.log('Folder URL      : ' + root.getUrl());

  var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Kolkata', 'yyyyMMdd-HHmmss');
  var blob  = Utilities.newBlob('Blue Ridge test upload @ ' + stamp, 'text/plain', '__test_' + stamp + '.txt');
  var file  = root.createFile(blob);
  Logger.log('Created file    : ' + file.getName() + '  (' + file.getId() + ')');
  Logger.log('File URL        : ' + file.getUrl());

  // Clean up — move to trash so the folder stays uncluttered.
  file.setTrashed(true);
  Logger.log('Trashed test file. ✔  Upload + write access confirmed.');
  return { ok: true, folderId: root.getId(), folderUrl: root.getUrl() };
}

/**
 * Submits a fake OWN registration end-to-end:
 *   • writes rows to the Registrations + Family Members sheets
 *   • creates the BIN folder in Drive and uploads a small dummy file
 *   • generates the PDF certificate
 *   • sends the confirmation email to the admin address only
 *
 * Uses a unique test BIN like TZZ-F9999-OWN so it doesn't collide.
 * Note: this leaves a real row in the sheet and a real folder in Drive.
 * Delete them manually (or via the Admin dashboard) after inspection.
 */
function testSubmission() {
  Logger.log('── testSubmission ──────────────────────────');
  var adminEmail = PropertiesService.getScriptProperties().getProperty(PROP.ADMIN_EMAIL) || DEFAULTS.ADMIN_EMAIL;
  var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Kolkata', 'HHmmss');
  var flat  = '9' + stamp.slice(-3); // e.g. 9421
  var bin   = 'TZZ-F' + flat + '-OWN';

  // Tiny 1x1 PNG (base64) used for every "uploaded" file.
  var onePxPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  function dummyFile(name, mime) {
    return { name: name, mimeType: mime || 'image/png', base64: onePxPng };
  }

  var payload = {
    type: 'OWN',
    tower: 'ZZ',
    flat: flat,
    residing: true,
    bin: bin,
    primary: {
      name:    'Test Resident ' + stamp,
      mobile:  '9999999999',
      email:   adminEmail,
      idType:  'Aadhaar Card',
      idNo:    '0000 0000 0000',
      files: {
        indexii: dummyFile('IndexII.png'),
        iddoc:   dummyFile('Aadhaar.png'),
        photo:   dummyFile('Photo.png'),
      },
    },
    members: [
      {
        name:  'Test Spouse ' + stamp,
        idNo:  '1111 1111 1111',
        files: { iddoc: dummyFile('Spouse_ID.png'), photo: dummyFile('Spouse_Photo.png') },
      },
    ],
  };

  Logger.log('Submitting BIN  : ' + bin);
  var res = submitRegistration(payload);
  Logger.log('Result          : ' + JSON.stringify(res));
  Logger.log('✔  Check the sheet, Drive folder, and ' + adminEmail + '\'s inbox.');
  Logger.log('   Delete the test row via Admin → Records when done.');
  return res;
}

/**
 * Sends a plain-text diagnostic email to the configured admin address
 * to verify MailApp quota / permissions are working. Does not touch
 * Drive or Sheets.
 */
function testMailSend() {
  Logger.log('── testMailSend ────────────────────────────');
  var props       = PropertiesService.getScriptProperties();
  var adminEmail  = props.getProperty(PROP.ADMIN_EMAIL)  || DEFAULTS.ADMIN_EMAIL;
  var societyName = props.getProperty(PROP.SOCIETY_NAME) || DEFAULTS.SOCIETY_NAME;
  var remaining   = MailApp.getRemainingDailyQuota();
  Logger.log('Sending as      : ' + Session.getEffectiveUser().getEmail());
  Logger.log('Recipient       : ' + adminEmail);
  Logger.log('Daily quota left: ' + remaining);

  if (remaining <= 0) throw new Error('MailApp daily quota exhausted. Try again tomorrow.');

  var stamp = new Date().toISOString();
  MailApp.sendEmail({
    to: adminEmail,
    subject: '[' + societyName + '] Test email from Resident Registry — ' + stamp,
    body: [
      societyName + ' — Resident Registry',
      '',
      'This is a diagnostic test message sent by testMailSend().',
      'Timestamp: ' + stamp,
      'Running as: ' + Session.getEffectiveUser().getEmail(),
      '',
      'If you received this, MailApp is configured correctly.',
    ].join('\n'),
    name: societyName + ' Registry',
  });
  Logger.log('✔  Email dispatched. Check ' + adminEmail + '.');
  return { ok: true, to: adminEmail };
}
