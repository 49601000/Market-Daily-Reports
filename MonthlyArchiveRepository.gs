const MonthlyArchiveRepository = (function () {
  function getFolder_() {
    try {
      return DriveApp.getFolderById(getMonthlyArchiveFolderId_());
    } catch (error) {
      throw marketReportError_('MONTHLY_FOLDER_ACCESS_FAILED', String(error));
    }
  }

  function listArchives() {
    const files = [];
    const iterator = getFolder_().getFiles();
    let scanned = 0;
    while (iterator.hasNext() && scanned < MONTHLY_ARCHIVE_CONFIG.maxFiles) {
      const file = iterator.next();
      scanned += 1;
      if (MONTHLY_ARCHIVE_CONFIG.filePattern.test(file.getName())) {
        files.push({ id: file.getId(), name: file.getName(), file: file });
      }
    }
    files.sort(function (a, b) { return b.name.localeCompare(a.name); });
    return files;
  }

  function findArchive(yearMonth) {
    const name = yearMonth + '.json';
    const matches = [];
    const iterator = getFolder_().getFilesByName(name);
    while (iterator.hasNext()) matches.push(iterator.next());
    if (matches.length > 1) throw marketReportError_('MONTHLY_DUPLICATE_FILE', name);
    return matches.length ? matches[0] : null;
  }

  function readJson(file) {
    return JSON.parse(file.getBlob().getDataAsString('UTF-8'));
  }

  function saveArchive(yearMonth, archive) {
    const validation = MonthlyArchiveService.validateArchive(archive, yearMonth);
    if (!validation.valid) throw marketReportError_('MONTHLY_CANDIDATE_INVALID', validation.code);
    const folder = getFolder_();
    const canonicalName = yearMonth + '.json';
    const content = JSON.stringify(archive, null, 2);
    const candidate = folder.createFile(canonicalName + '.candidate-' + Date.now(), content, MimeType.PLAIN_TEXT);
    let current = null;
    let backupName = null;
    try {
      const persisted = readJson(candidate);
      const persistedValidation = MonthlyArchiveService.validateArchive(persisted, yearMonth);
      if (!persistedValidation.valid || JSON.stringify(persisted) !== JSON.stringify(archive)) {
        throw marketReportError_('MONTHLY_WRITE_VERIFY_FAILED', persistedValidation.code);
      }
      current = findArchive(yearMonth);
      backupName = canonicalName + '.backup-' + Date.now();
      if (current) current.setName(backupName);
      candidate.setName(canonicalName);
      return { id: candidate.getId(), name: canonicalName, backupId: current ? current.getId() : null };
    } catch (error) {
      try { candidate.setTrashed(true); } catch (ignored) {}
      try { if (current && current.getName() === backupName) current.setName(canonicalName); } catch (rollbackError) {
        console.error('Monthly archive rollback failed for %s: %s', canonicalName, rollbackError && rollbackError.stack ? rollbackError.stack : rollbackError);
      }
      throw error;
    }
  }

  return { listArchives: listArchives, findArchive: findArchive, readJson: readJson, saveArchive: saveArchive };
})();
