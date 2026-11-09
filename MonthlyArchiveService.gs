const MonthlyArchiveService = (function () {
  const STATUS = Object.freeze({ NO_CHANGE:'NO_CHANGE', UPDATED:'UPDATED', PARTIAL:'PARTIAL', FAILED:'FAILED', LOCK_BUSY:'LOCK_BUSY' });

  function emptyArchive_(yearMonth) {
    return { archive_schema_version: MONTHLY_ARCHIVE_CONFIG.schemaVersion, year_month: yearMonth, updated_at_jst: null, record_count: 0, records: [] };
  }

  function validateArchive(archive, expectedMonth) {
    if (!archive || typeof archive !== 'object' || Array.isArray(archive)) return invalid_('INVALID_ROOT');
    if (archive.archive_schema_version !== MONTHLY_ARCHIVE_CONFIG.schemaVersion) return invalid_('UNSUPPORTED_ARCHIVE_SCHEMA');
    if (!/^\d{4}-\d{2}$/.test(archive.year_month) || (expectedMonth && archive.year_month !== expectedMonth)) return invalid_('INVALID_YEAR_MONTH');
    if (!Array.isArray(archive.records) || archive.record_count !== archive.records.length) return invalid_('INVALID_RECORD_COUNT');
    const ids = Object.create(null);
    for (let i = 0; i < archive.records.length; i += 1) {
      const r = archive.records[i];
      if (!r || typeof r !== 'object' || !r.source_file_id || !r.source_file_name) return invalid_('INVALID_RECORD');
      if (ids[r.source_file_id]) return invalid_('DUPLICATE_SOURCE_FILE');
      ids[r.source_file_id] = true;
      const daily = Object.assign({}, r);
      daily.schema_version = daily.schema_version || MARKET_REPORT_CONFIG.schemaVersion;
      if (!MarketReportService.validate(daily).valid || daily.market_date.slice(0, 7) !== archive.year_month) return invalid_('INVALID_RECORD');
    }
    return { valid:true };
  }

  function recordFromDaily_(entry, raw) {
    const record = Object.assign({}, raw);
    record.source_file_id = entry.id;
    record.source_file_name = entry.name;
    record.source_content_sha256 = contentHash_(raw);
    return record;
  }

  function contentHash_(raw) {
    const text = JSON.stringify(raw);
    if (typeof Utilities === 'undefined' || !Utilities.computeDigest) return 'LOCAL-' + text.length + '-' + text;
    return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8).map(function (byte) {
      return ('0' + ((byte + 256) % 256).toString(16)).slice(-2);
    }).join('');
  }

  function sortArchiveRecords_(records) {
    records.sort(function (a, b) {
      return b.market_date.localeCompare(a.market_date) || b.generated_at_jst.localeCompare(a.generated_at_jst) || a.source_file_id.localeCompare(b.source_file_id);
    });
    return records;
  }

  function buildArchives(dailyEntries, existingByMonth, nowJst) {
    const archives = Object.create(null);
    const diagnostics = { detected:dailyEntries.length, added:0, existing:0, replaced:0, duplicates:[], modifiedSources:[], invalid:[], changedMonths:[] };
    Object.keys(existingByMonth || {}).forEach(function (month) {
      const archive = existingByMonth[month];
      const validation = validateArchive(archive, month);
      if (!validation.valid) throw marketReportError_('MONTHLY_ARCHIVE_CORRUPT', month + ':' + validation.code);
      archives[month] = JSON.parse(JSON.stringify(archive));
    });
    dailyEntries.forEach(function (entry) {
      let raw;
      try { raw = entry.raw || MarketReportRepository.readJson(entry.file); } catch (error) { diagnostics.invalid.push({fileName:entry.name, code:'INVALID_JSON'}); return; }
      const validation = MarketReportService.validate(raw);
      if (!validation.valid) { diagnostics.invalid.push({fileName:entry.name, code:validation.code}); return; }
      const month = raw.market_date.slice(0, 7);
      const archive = archives[month] || (archives[month] = emptyArchive_(month));
      const registeredIndex = archive.records.findIndex(function (r) { return r.source_file_id === entry.id; });
      if (registeredIndex >= 0) {
        const registered = archive.records[registeredIndex];
        diagnostics.existing += 1;
        if (registered.source_content_sha256 === contentHash_(raw)) return;
        diagnostics.modifiedSources.push({fileName:entry.name,sourceFileId:entry.id,market:raw.market,marketDate:raw.market_date});
        archive.records[registeredIndex] = recordFromDaily_(entry, raw);
        archive.updated_at_jst = nowJst;
        sortArchiveRecords_(archive.records);
        diagnostics.replaced += 1;
        if (diagnostics.changedMonths.indexOf(month) < 0) diagnostics.changedMonths.push(month);
        return;
      }
      const logical = archive.records.find(function (r) { return r.market === raw.market && r.market_date === raw.market_date; });
      if (logical) { diagnostics.duplicates.push({fileName:entry.name, sourceFileId:entry.id, conflictsWith:logical.source_file_id, market:raw.market, marketDate:raw.market_date}); return; }
      archive.records.push(recordFromDaily_(entry, raw));
      archive.record_count = archive.records.length;
      archive.updated_at_jst = nowJst;
      sortArchiveRecords_(archive.records);
      diagnostics.added += 1;
      if (diagnostics.changedMonths.indexOf(month) < 0) diagnostics.changedMonths.push(month);
    });
    diagnostics.changedMonths.sort();
    return { archives:archives, diagnostics:diagnostics };
  }

  function sync() {
    const started = new Date();
    const result = { status:STATUS.FAILED, startedAt:started.toISOString(), finishedAt:null, durationMs:0, detected:0, added:0, existing:0, replaced:0, duplicates:0, modifiedSources:0, invalid:0, updatedMonths:[], writesSucceeded:0, writesFailed:0, errors:[] };
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(MONTHLY_ARCHIVE_CONFIG.lockWaitMs)) { result.status=STATUS.LOCK_BUSY; return finish_(result, started); }
    try {
      const monthlyFolderId = getMonthlyArchiveFolderId_();
      if (monthlyFolderId === getMarketReportFolderId_()) throw marketReportError_('FOLDERS_MUST_BE_SEPARATE');
      const existing = Object.create(null);
      MonthlyArchiveRepository.listArchives().forEach(function (entry) {
        const month = entry.name.slice(0, 7);
        existing[month] = MonthlyArchiveRepository.readJson(entry.file);
      });
      const daily = MarketReportRepository.listFiles();
      const built = buildArchives(daily.files, existing, Utilities.formatDate(new Date(), 'Asia/Tokyo', "yyyy-MM-dd'T'HH:mm:ssXXX"));
      Object.assign(result, { detected:built.diagnostics.detected, added:built.diagnostics.added, existing:built.diagnostics.existing, replaced:built.diagnostics.replaced, duplicates:built.diagnostics.duplicates.length, modifiedSources:built.diagnostics.modifiedSources.length, invalid:built.diagnostics.invalid.length, updatedMonths:built.diagnostics.changedMonths });
      built.diagnostics.changedMonths.forEach(function (month) {
        try { MonthlyArchiveRepository.saveArchive(month, built.archives[month]); result.writesSucceeded += 1; }
        catch (error) { result.writesFailed += 1; result.errors.push(String(error && error.message || error)); }
      });
      const hasConflicts = result.duplicates || result.invalid || result.modifiedSources > result.replaced;
      result.status = result.writesFailed ? (result.writesSucceeded ? STATUS.PARTIAL : STATUS.FAILED) : (hasConflicts ? STATUS.PARTIAL : ((result.added || result.replaced) ? STATUS.UPDATED : STATUS.NO_CHANGE));
    } catch (error) {
      result.errors.push(String(error && error.message || error));
      result.status = STATUS.FAILED;
    } finally { lock.releaseLock(); }
    console.log(JSON.stringify(finish_(result, started)));
    return result;
  }

  function rebuildPreview() {
    const listed = MarketReportRepository.listFiles();
    return buildArchives(listed.files, {}, Utilities.formatDate(new Date(), 'Asia/Tokyo', "yyyy-MM-dd'T'HH:mm:ssXXX"));
  }

  function listMonths() {
    try { const files=MonthlyArchiveRepository.listArchives(); return {ok:true, months:files.map(function(e){return e.name.slice(0,7);}), latestMonth:files.length?files[0].name.slice(0,7):null}; }
    catch (error) { return failure_(error); }
  }

  function getMonth(yearMonth) {
    try {
      if (!/^\d{4}-\d{2}$/.test(yearMonth)) throw marketReportError_('INVALID_YEAR_MONTH');
      const file=MonthlyArchiveRepository.findArchive(yearMonth);
      if (!file) throw marketReportError_('MONTHLY_NOT_READY');
      const archive=MonthlyArchiveRepository.readJson(file);
      const validation=validateArchive(archive, yearMonth);
      if (!validation.valid) throw marketReportError_('MONTHLY_ARCHIVE_CORRUPT', validation.code);
      return {ok:true, archive:archive};
    } catch (error) { return failure_(error); }
  }

  function finish_(result, started) { const end=new Date(); result.finishedAt=end.toISOString(); result.durationMs=end.getTime()-started.getTime(); return result; }
  function invalid_(code) { return {valid:false, code:code}; }
  function failure_(error) {
    const messages={MONTHLY_PROPERTY_MISSING:'Script Properties に MARKET_MONTHLY_FOLDER_ID が設定されていません。',MONTHLY_FOLDER_ACCESS_FAILED:'月次DBフォルダを読み取れませんでした。',MONTHLY_NOT_READY:'月次DBはまだ生成されていません。',MONTHLY_ARCHIVE_CORRUPT:'月次DBが不正です。管理者による再構築が必要です。',INVALID_YEAR_MONTH:'年月の指定が不正です。',MONTHLY_DUPLICATE_FILE:'同じ年月の月次DBが複数あります。',FOLDERS_MUST_BE_SEPARATE:'日次JSONと月次DBには別のフォルダを設定してください。'};
    const code=error&&error.code&&messages[error.code]?error.code:'MONTHLY_FOLDER_ACCESS_FAILED';
    return {ok:false,status:'error',error:{code:code,message:messages[code]}};
  }

  return { STATUS:STATUS, validateArchive:validateArchive, buildArchives:buildArchives, sortArchiveRecords:sortArchiveRecords_, sync:sync, rebuildPreview:rebuildPreview, listMonths:listMonths, getMonth:getMonth };
})();
