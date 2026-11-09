function getMarketNavigationData() {
  return {
    ok: true,
    data: {
      heading: 'L1 RESEARCH WORKSPACE',
      currentAppId: MARKET_REPORT_CONFIG.appId,
      apps: [{
        id: MARKET_REPORT_CONFIG.appId,
        label: 'Market Report Curator',
        description: '日本・米国市場レポート',
        url: null,
        current: true,
      }],
    },
  };
}
