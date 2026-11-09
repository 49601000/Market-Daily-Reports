function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Market Report Curator')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function getMarketReportIndex(forceRefresh) {
  return MarketReportService.getIndex(forceRefresh === true);
}

function getMarketReportDetail(fileId) {
  return MarketReportService.getDetail(fileId);
}

function getMonthlyReportMonths() {
  return MonthlyArchiveService.listMonths();
}

function getMonthlyReportArchive(yearMonth) {
  return MonthlyArchiveService.getMonth(yearMonth);
}
