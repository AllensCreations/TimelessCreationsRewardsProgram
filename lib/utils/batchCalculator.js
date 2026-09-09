export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export const MONTH_MAP = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12
};

/**
 * Returns complete batch and 1st month calculation info.
 * Rule: If batch is August 2026, 1st Month is September 2026.
 *
 * @param {string} batchMonthStr e.g. "August 2026" or "August"
 * @returns {object} batch & 1st month metadata
 */
export function getFirstMonthInfo(batchMonthStr) {
  if (!batchMonthStr || typeof batchMonthStr !== 'string') {
    return {
      batchMonthName: "August",
      batchYear: 2026,
      batchDisplay: "August 2026",
      firstMonthName: "September",
      firstMonthYear: 2026,
      firstMonthDisplay: "September 2026",
      firstMonthNum: 9
    };
  }

  const str = batchMonthStr.toLowerCase().trim();
  let batchMonthIdx = -1;
  for (let i = 0; i < MONTH_NAMES.length; i++) {
    if (str.includes(MONTH_NAMES[i].toLowerCase())) {
      batchMonthIdx = i; // 0-indexed (e.g. August = 7)
      break;
    }
  }
  if (batchMonthIdx === -1) batchMonthIdx = 7; // Default to August

  const yearMatch = batchMonthStr.match(/\b(20\d\d)\b/);
  const now = new Date();
  const batchYear = yearMatch ? parseInt(yearMatch[1], 10) : now.getFullYear();

  const firstMonthIdx = (batchMonthIdx + 1) % 12; // (7 + 1)%12 = 8 (September)
  const firstMonthYear = (batchMonthIdx === 11) ? batchYear + 1 : batchYear;

  return {
    batchMonthName: MONTH_NAMES[batchMonthIdx],
    batchYear: batchYear,
    batchDisplay: `${MONTH_NAMES[batchMonthIdx]} ${batchYear}`,
    firstMonthName: MONTH_NAMES[firstMonthIdx],
    firstMonthYear: firstMonthYear,
    firstMonthDisplay: `${MONTH_NAMES[firstMonthIdx]} ${firstMonthYear}`,
    firstMonthNum: firstMonthIdx + 1 // 1-12
  };
}

/**
 * Calculates the current mission month for a missionary.
 * Month 0: Arrival / Batch Month (e.g. August)
 * Month 1: 1st Month (e.g. September)
 * Month 2: 2nd Month (e.g. October), up to maxMonths.
 *
 * @param {string} batchMonthStr
 * @param {number} maxMonths (18 for Sisters, 24 for Elders)
 * @param {Date} targetDate
 * @returns {number} 0..maxMonths
 */
export function calculateMissionMonth(batchMonthStr, maxMonths = 24, targetDate = new Date()) {
  const info = getFirstMonthInfo(batchMonthStr);
  const targetYear = targetDate.getFullYear();
  const targetMonth = targetDate.getMonth() + 1; // 1-12

  const elapsed = (targetYear - info.firstMonthYear) * 12 + (targetMonth - info.firstMonthNum) + 1;
  return Math.max(0, Math.min(elapsed, maxMonths));
}

/**
 * Returns the estimated 1st dispatch date (YYYY-MM-DD) for a missionary's batch cohort.
 * e.g., if batch is September 2026 and base date is 2026-09-09, returns "2026-10-09".
 *
 * @param {string} batchMonthStr
 * @param {Date} baseDate
 * @returns {string} ISO Date String YYYY-MM-DD
 */
export function getFirstDispatchDate(batchMonthStr, baseDate = new Date()) {
  const info = getFirstMonthInfo(batchMonthStr);
  const y = info.firstMonthYear;
  const m = info.firstMonthNum;
  const maxDays = new Date(y, m, 0).getDate();
  const targetDay = Math.min(Math.max(1, baseDate.getDate()), maxDays);
  return `${y}-${String(m).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;
}

/**
 * Determines whether a missionary is currently eligible to receive a monthly drip dispatch.
 * Criteria:
 * 1. Must be active (status == 'active', is_active != 0)
 * 2. Must not be completed (months_sent < max_months)
 * 3. Must have reached at least Month 1 (currentMissionMonth > 0; arrival month / Month 0 is NOT due yet)
 * 4. Must not have already received their drip for the current mission month (months_sent < currentMissionMonth)
 * 5. Must not have been sent today
 * 6. Explicit next_send_date must not be in the future
 *
 * @param {object} missionary
 * @param {Date} targetDate
 * @param {string} todayIso YYYY-MM-DD
 * @returns {boolean}
 */
export function isMissionaryEligibleForDispatch(missionary, targetDate = new Date(), todayIso = null) {
  if (!missionary) return false;
  const status = (missionary.status || 'active').toLowerCase();
  if (status !== 'active') return false;

  const isSister = (missionary.cohort || '').toLowerCase().includes('sister') || (missionary.name || '').toLowerCase().startsWith('sister');
  const maxMonths = Number(missionary.max_months) || (isSister ? 18 : 24);
  const monthsSent = Number(missionary.months_sent) || 0;
  if (monthsSent >= maxMonths) return false;

  const curMissionMonth = calculateMissionMonth(missionary.batch_month || 'August 2026', maxMonths, targetDate);
  // Month 0 missionaries (in their arrival batch month) are NOT due yet; first dispatch is next month (Month 1)
  if (curMissionMonth <= 0) return false;
  // If already sent all dispatches due up to current month, not due
  if (monthsSent >= curMissionMonth) return false;

  const todayStr = todayIso || targetDate.toISOString().slice(0, 10);
  if (missionary.last_sent_at && missionary.last_sent_at.slice(0, 10) === todayStr) return false;
  if (missionary.next_send_date && missionary.next_send_date.slice(0, 10) > todayStr) return false;

  return true;
}
