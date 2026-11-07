/**
 * Feature switches shared by the page and the API routes.
 *
 * EXCEL_IMPORT_ENABLED — the hospital wants สถิติจ่าย from the CSSD database
 * only for now, so Excel import is switched off everywhere: the upload box,
 * the header button, the `?src=` / postMessage deep links (DEPLOY.md ข้อ 5–6)
 * and the /api/parse-xlsx route. The code all stays; set this back to true
 * and rebuild to bring it back.
 */
export const EXCEL_IMPORT_ENABLED = false;
