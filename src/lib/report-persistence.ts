const REPORT_STATE_KEY = "report-page-restore";

export interface ReportRestoreState {
  reportId: string;
  data: any[];
}

export function saveReportState(state: ReportRestoreState) {
  try {
    // Strip heavy points arrays to avoid quota issues
    const lightweight = state.data.map((row) => {
      if (Array.isArray(row.points) && row.points.length > 50) {
        const step = Math.ceil(row.points.length / 50);
        return { ...row, points: row.points.filter((_: any, i: number) => i % step === 0 || i === row.points.length - 1) };
      }
      return row;
    });
    sessionStorage.setItem(REPORT_STATE_KEY, JSON.stringify({ reportId: state.reportId, data: lightweight }));
  } catch {
    // If still too large, save without points
    try {
      const noPoints = state.data.map(({ points, ...rest }) => rest);
      sessionStorage.setItem(REPORT_STATE_KEY, JSON.stringify({ reportId: state.reportId, data: noPoints }));
    } catch {}
  }
}

export function loadReportState(): ReportRestoreState | null {
  try {
    const raw = sessionStorage.getItem(REPORT_STATE_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(REPORT_STATE_KEY);
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
