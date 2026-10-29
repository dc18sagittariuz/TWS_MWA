// Dispatches the "Sync Google Sheet data" workflow every 15 minutes.
// GitHub's own cron on this repo only fires every 2-7 hours, so this keeps the snapshot fresh.
//
// Setup (once):
// 1. GitHub → Settings → Developer settings → Fine-grained tokens → new token
//    Repository access: only dc18sagittariuz/TWS_MWA · Permissions: Actions = Read and write
// 2. Apps Script → Project Settings → Script Properties → add GH_TOKEN = <token>
// 3. Run installSyncTrigger() once and approve the permissions prompt.

const SYNC_DISPATCH_URL =
  'https://api.github.com/repos/dc18sagittariuz/TWS_MWA/actions/workflows/sync-sheets.yml/dispatches';

function triggerSync() {
  const token = PropertiesService.getScriptProperties().getProperty('GH_TOKEN');
  if (!token) throw new Error('GH_TOKEN is not set in Script Properties');
  const res = UrlFetchApp.fetch(SYNC_DISPATCH_URL, {
    method: 'post',
    muteHttpExceptions: true,
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' },
    payload: JSON.stringify({ ref: 'main' })
  });
  if (res.getResponseCode() !== 204) {
    throw new Error('Dispatch failed: ' + res.getResponseCode() + ' ' + res.getContentText());
  }
}

function installSyncTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'triggerSync')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('triggerSync').timeBased().everyMinutes(15).create();
  triggerSync(); // test once now
}
