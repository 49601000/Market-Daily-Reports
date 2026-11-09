const MarketReportRepository = (function () {
  function listFiles() {
    const folderId = getMarketReportFolderId_();
    let iterator;
    try {
      iterator = DriveApp.getFolderById(folderId).getFiles();
    } catch (error) {
      console.error('Market Report folder access failed: %s', error && error.stack ? error.stack : error);
      throw marketReportError_('FOLDER_ACCESS_FAILED');
    }

    const files = [];
    let scanned = 0;
    let truncated = false;
    while (iterator.hasNext()) {
      if (scanned >= MARKET_REPORT_CONFIG.maxFiles) {
        truncated = true;
        break;
      }
      const file = iterator.next();
      scanned += 1;
      if (!/\.json$/i.test(file.getName())) continue;
      files.push({ id: file.getId(), name: file.getName(), file: file });
    }
    return { folderId: folderId, files: files, scanned: scanned, truncated: truncated };
  }

  function readJson(file) {
    return JSON.parse(file.getBlob().getDataAsString('UTF-8'));
  }

  function getVerifiedFile(fileId) {
    if (typeof fileId !== 'string' || !/^[A-Za-z0-9_-]{10,}$/.test(fileId)) {
      throw marketReportError_('INVALID_FILE_ID');
    }
    const folderId = getMarketReportFolderId_();
    let file;
    try {
      file = DriveApp.getFileById(fileId);
    } catch (error) {
      throw marketReportError_('DETAIL_FETCH_FAILED');
    }
    if (!/\.json$/i.test(file.getName()) || !fileHasParent_(file, folderId)) {
      throw marketReportError_('INVALID_FILE_ID');
    }
    return file;
  }

  function fileHasParent_(file, folderId) {
    const parents = file.getParents();
    while (parents.hasNext()) {
      if (parents.next().getId() === folderId) return true;
    }
    return false;
  }

  return { listFiles: listFiles, readJson: readJson, getVerifiedFile: getVerifiedFile };
})();
