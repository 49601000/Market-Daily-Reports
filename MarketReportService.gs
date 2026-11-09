const MarketReportService = (function () {
  const PUBLIC_MESSAGES = Object.freeze({
    PROPERTY_MISSING: 'Script Properties に MARKET_REPORT_FOLDER_ID が設定されていません。',
    FOLDER_ACCESS_FAILED: 'Google Drive のレポートフォルダを読み取れませんでした。',
    INVALID_FILE_ID: '指定されたレポートを参照できません。',
    DETAIL_FETCH_FAILED: 'レポート詳細の取得に失敗しました。',
  });

  function getIndex(forceRefresh) {
    const cache = CacheService.getScriptCache();
    if (!forceRefresh) {
      const cached = cache.get(MARKET_REPORT_CONFIG.cacheKey);
      if (cached) return JSON.parse(cached);
    }
    try {
      const listed = MarketReportRepository.listFiles();
      const records = [];
      const issues = [];
      listed.files.forEach(function (entry) {
        try {
          const raw = MarketReportRepository.readJson(entry.file);
          const validation = validate(raw);
          if (!validation.valid) {
            issues.push(issue_(entry, validation.code));
            console.warn('Skipped market report %s: %s', entry.name, validation.code);
            return;
          }
          records.push(toSummary_(entry, raw));
        } catch (error) {
          issues.push(issue_(entry, error instanceof SyntaxError ? 'INVALID_JSON' : 'READ_FAILED'));
          console.warn('Skipped unreadable market report %s: %s', entry.name, error && error.message ? error.message : error);
        }
      });
      sortRecords_(records);
      const duplicates = findDuplicates_(records);
      duplicates.forEach(function (duplicate) {
        console.warn('Duplicate market/date retained: %s %s (%s)', duplicate.market, duplicate.marketDate, duplicate.count);
      });
      const months = buildMonths_(records);
      const payload = {
        ok: true,
        status: records.length ? 'ok' : 'empty',
        records: records,
        months: months,
        latestMonth: months.length ? months[0] : null,
        diagnostics: {
          scanned: listed.scanned,
          valid: records.length,
          skipped: issues.length,
          truncated: listed.truncated,
          issues: issues,
          duplicates: duplicates,
        },
        fetchedAt: new Date().toISOString(),
      };
      cache.put(MARKET_REPORT_CONFIG.cacheKey, JSON.stringify(payload), MARKET_REPORT_CONFIG.cacheSeconds);
      return payload;
    } catch (error) {
      return failure_(error);
    }
  }

  function getDetail(fileId) {
    try {
      const file = MarketReportRepository.getVerifiedFile(fileId);
      const raw = MarketReportRepository.readJson(file);
      const validation = validate(raw);
      if (!validation.valid) throw marketReportError_('DETAIL_FETCH_FAILED', validation.code);
      return {
        ok: true,
        report: {
          id: file.getId(),
          market: raw.market,
          marketDate: raw.market_date,
          generatedAtJst: raw.generated_at_jst,
          sessionStatus: raw.session_status,
          reportText: typeof raw.report_text === 'string' && raw.report_text.length ? raw.report_text : null,
          structured: pickStructured_(raw),
        },
      };
    } catch (error) {
      console.error('Market Report detail failed: %s', error && error.stack ? error.stack : error);
      return failure_(error);
    }
  }

  function validate(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return invalid_('INVALID_ROOT');
    if (raw.schema_version !== MARKET_REPORT_CONFIG.schemaVersion) return invalid_('UNSUPPORTED_SCHEMA');
    if (MARKET_REPORT_CONFIG.requiredFields.some(function (key) { return !Object.prototype.hasOwnProperty.call(raw, key); })) return invalid_('MISSING_REQUIRED_FIELD');
    if (MARKET_REPORT_CONFIG.allowedMarkets.indexOf(raw.market) < 0) return invalid_('INVALID_MARKET');
    if (!isCalendarDate_(raw.market_date)) return invalid_('INVALID_MARKET_DATE');
    if (!isJstDateTime_(raw.generated_at_jst)) return invalid_('INVALID_GENERATED_AT');
    if (['open', 'closed'].indexOf(raw.session_status) < 0) return invalid_('INVALID_SESSION_STATUS');
    if (Object.prototype.hasOwnProperty.call(raw, 'report_text') && raw.report_text !== null && typeof raw.report_text !== 'string') return invalid_('INVALID_REPORT_TEXT');
    return { valid: true };
  }

  function toSummary_(entry, raw) {
    return {
      id: entry.id,
      fileName: entry.name,
      market: raw.market,
      marketDate: raw.market_date,
      month: raw.market_date.slice(0, 7),
      generatedAtJst: raw.generated_at_jst,
      sessionStatus: raw.session_status,
      hasReportText: typeof raw.report_text === 'string' && raw.report_text.length > 0,
    };
  }

  function sortRecords_(records) {
    records.sort(function (a, b) {
      return b.marketDate.localeCompare(a.marketDate) ||
        b.generatedAtJst.localeCompare(a.generatedAtJst) ||
        a.id.localeCompare(b.id);
    });
    return records;
  }

  function buildMonths_(records) {
    return Array.from(new Set(records.map(function (record) { return record.month; }))).sort().reverse();
  }

  function findDuplicates_(records) {
    const counts = Object.create(null);
    records.forEach(function (record) {
      const key = record.market + '|' + record.marketDate;
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.keys(counts).filter(function (key) { return counts[key] > 1; }).map(function (key) {
      const parts = key.split('|');
      return { market: parts[0], marketDate: parts[1], count: counts[key] };
    });
  }

  function pickStructured_(raw) {
    const keys = ['indices', 'drivers', 'upcoming_events', 'outlook', 'vix', 'futures_volume', 'futures_price', 'crypto_weekend_snapshot', 'sources', 'data_quality_notes'];
    const result = {};
    keys.forEach(function (key) {
      if (Object.prototype.hasOwnProperty.call(raw, key)) result[key] = raw[key];
    });
    return result;
  }

  function isCalendarDate_(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(value + 'T00:00:00Z');
    return !isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }

  function isJstDateTime_(value) {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?\+09:00$/.test(value) && !isNaN(Date.parse(value));
  }

  function invalid_(code) { return { valid: false, code: code }; }
  function issue_(entry, code) { return { fileName: entry.name, code: code }; }
  function failure_(error) {
    const code = error && error.code && PUBLIC_MESSAGES[error.code] ? error.code : 'DETAIL_FETCH_FAILED';
    return { ok: false, status: 'error', error: { code: code, message: PUBLIC_MESSAGES[code] } };
  }

  return {
    getIndex: getIndex,
    getDetail: getDetail,
    validate: validate,
    sortRecords: sortRecords_,
    buildMonths: buildMonths_,
    findDuplicates: findDuplicates_,
  };
})();
