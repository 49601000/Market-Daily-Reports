function syncMonthlyReports() { return MonthlyArchiveService.sync(); }

function inspectMonthlySyncTriggers() {
  const managed = ScriptApp.getProjectTriggers().filter(function (trigger) { return trigger.getHandlerFunction() === MONTHLY_ARCHIVE_CONFIG.triggerHandler; });
  return { count:managed.length, expected:6, healthy:managed.length===6, triggerIds:managed.map(function(t){return t.getUniqueId();}) };
}

function removeMonthlySyncTriggers() {
  let removed=0;
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === MONTHLY_ARCHIVE_CONFIG.triggerHandler) { ScriptApp.deleteTrigger(trigger); removed += 1; }
  });
  return {removed:removed};
}

function installMonthlySyncTriggers() {
  removeMonthlySyncTriggers();
  MONTHLY_ARCHIVE_CONFIG.triggerHours.forEach(function (hour, index) {
    ScriptApp.newTrigger(MONTHLY_ARCHIVE_CONFIG.triggerHandler).timeBased().atHour(hour).nearMinute(MONTHLY_ARCHIVE_CONFIG.triggerMinutes[index]).everyDays(1).inTimezone('Asia/Tokyo').create();
  });
  return inspectMonthlySyncTriggers();
}
