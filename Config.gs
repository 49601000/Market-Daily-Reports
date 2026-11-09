const MARKET_REPORT_CONFIG = Object.freeze({
  appId: 'market',
  folderProperty: 'MARKET_REPORT_FOLDER_ID',
  schemaVersion: '1.0.0',
  supportedSchemaVersions: Object.freeze(['1.0.0', '1.1.0']),
  cacheKey: 'market-report-curator:m1:index',
  cacheSeconds: 180,
  maxFiles: 2000,
  allowedMarkets: ['US', 'JP'],
  requiredFields: ['schema_version', 'market', 'market_date', 'generated_at_jst', 'session_status'],
});

const MONTHLY_ARCHIVE_CONFIG = Object.freeze({
  folderProperty: 'MARKET_MONTHLY_FOLDER_ID',
  schemaVersion: '1.0.0',
  filePattern: /^\d{4}-\d{2}\.json$/,
  maxFiles: 240,
  lockWaitMs: 1000,
  triggerHours: [7, 8, 9, 18, 19, 20],
  triggerMinutes: [30, 30, 30, 0, 0, 0],
  triggerHandler: 'syncMonthlyReports',
});

function getMarketReportFolderId_() {
  const folderId = PropertiesService.getScriptProperties().getProperty(MARKET_REPORT_CONFIG.folderProperty);
  if (!folderId || !folderId.trim()) throw marketReportError_('PROPERTY_MISSING');
  return folderId.trim();
}

function getMonthlyArchiveFolderId_() {
  const folderId = PropertiesService.getScriptProperties().getProperty(MONTHLY_ARCHIVE_CONFIG.folderProperty);
  if (!folderId || !folderId.trim()) throw marketReportError_('MONTHLY_PROPERTY_MISSING');
  return folderId.trim();
}

function marketReportError_(code, detail) {
  const error = new Error(code);
  error.code = code;
  error.detail = detail || '';
  return error;
}
