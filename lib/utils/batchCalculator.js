export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export const MONTH_MAP = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12
};

/**
 * Parses any batch month string (e.g. "April 2026", "September 2026", "August")
 * into normalized month (1-12) and year.
 *
 * @param {string} batchMonthStr
 * @returns {object} { monthIdx (0-11), monthNum (1-12), year, monthName, display }
 */
export function parseBatchCohort(batchMonthStr) {
  if (!batchMonthStr || typeof batchMonthStr !== 'string') {
    const now = new Date();
    return {
      monthIdx: 7, // August
      monthNum: 8,
      year: 2026,
      monthName: "August",
      display: "August 2026"
    };
  }

  const str = batchMonthStr.toLowerCase().trim();
  let monthIdx = -1;
  for (let i = 0; i < MONTH_NAMES.length; i++) {
    if (str.includes(MONTH_NAMES[i].toLowerCase())) {
      monthIdx = i;
      break;
    }
  }
  if (monthIdx === -1) {
    // Check if format is YYYY-MM
    const isoMatch = str.match(/\b(20\d\d)-(\d{1,2})\b/);
    if (isoMatch) {
      const m = parseInt(isoMatch[2], 10);
      if (m >= 1 && m <= 12) monthIdx = m - 1;
    }
  }
  if (monthIdx === -1) monthIdx = 7; // Default August

  const yearMatch = batchMonthStr.match(/\b(20\d\d)\b/);
  const now = new Date();
  const year = yearMatch ? parseInt(yearMatch[1], 10) : now.getFullYear();

  return {
    monthIdx,
    monthNum: monthIdx + 1,
    year,
    monthName: MONTH_NAMES[monthIdx],
    display: `${MONTH_NAMES[monthIdx]} ${year}`
  };
}

/**
 * Calculates calendar month and year for any mission month index k using Batch Cohort as Month 0.
 * Month 0 = Batch Arrival Month (e.g. September 2026)
 * Month 1 = 1st Drip Dispatch Month (e.g. October 2026)
 * Month k = Mk Dispatch Month
 *
 * Formula:
 *   Month_k = ((M0 - 1 + k) % 12) + 1
 *   Year_k  = Y0 + Math.floor((M0 - 1 + k) / 12)
 *
 * @param {string} batchMonthStr e.g. "April 2026" or "September 2026"
 * @param {number} monthIndex k >= 0
 * @returns {object} { monthNum, year, monthName, display, tenureIndex, label }
 */
export function getMissionMonthInfo(batchMonthStr, monthIndex = 0) {
  const base = parseBatchCohort(batchMonthStr);
  const k = Math.max(0, parseInt(monthIndex, 10) || 0);

  const totalMonths = (base.monthNum - 1) + k;
  const calMonthNum = (totalMonths % 12) + 1;
  const calYear = base.year + Math.floor(totalMonths / 12);
  const calMonthName = MONTH_NAMES[calMonthNum - 1];
  const display = `${calMonthName} ${calYear}`;

  return {
    monthNum: calMonthNum,
    year: calYear,
    monthName: calMonthName,
    display,
    tenureIndex: k,
    label: k === 0 ? `${display} (Month 0)` : `${display} (M${k})`
  };
}

/**
 * Formats any date / ISO string / timestamp into "MONTH YEAR" format without day.
 * e.g., "2026-09-09" -> "September 2026", "2026-10-09" -> "October 2026"
 *
 * @param {string|Date} dateVal
 * @param {string} fallback
 * @returns {string} e.g. "April 2026"
 */
export function formatMonthYear(dateVal, fallback = 'Never') {
  if (!dateVal) return fallback;
  if (typeof dateVal === 'string') {
    const trimmed = dateVal.trim();
    // Check if already "Month Year" e.g. "April 2026"
    for (let i = 0; i < MONTH_NAMES.length; i++) {
      const mName = MONTH_NAMES[i];
      if (trimmed.toLowerCase().startsWith(mName.toLowerCase())) {
        const yMatch = trimmed.match(/\b(20\d\d)\b/);
        return yMatch ? `${mName} ${yMatch[1]}` : mName;
      }
    }
    // Check YYYY-MM or YYYY-MM-DD
    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})/);
    if (isoMatch) {
      const y = parseInt(isoMatch[1], 10);
      const m = parseInt(isoMatch[2], 10);
      if (m >= 1 && m <= 12) {
        return `${MONTH_NAMES[m - 1]} ${y}`;
      }
    }
  }

  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    // Adjust for PHT +8h
    const phtDate = new Date(d.getTime() + (d.getTimezoneOffset() * 60000) + (8 * 3600000));
    return `${MONTH_NAMES[phtDate.getMonth()]} ${phtDate.getFullYear()}`;
  } catch (_) {
    return String(dateVal);
  }
}

/**
 * Returns complete batch and 1st month calculation info.
 * Month 0: Batch Cohort (e.g. September 2026)
 * Month 1: 1st Month (e.g. October 2026)
 *
 * @param {string} batchMonthStr e.g. "August 2026" or "September 2026"
 * @returns {object} batch & 1st month metadata
 */
export function getFirstMonthInfo(batchMonthStr) {
  const m0 = getMissionMonthInfo(batchMonthStr, 0);
  const m1 = getMissionMonthInfo(batchMonthStr, 1);

  return {
    batchMonthName: m0.monthName,
    batchYear: m0.year,
    batchDisplay: m0.display,
    firstMonthName: m1.monthName,
    firstMonthYear: m1.year,
    firstMonthDisplay: m1.display,
    firstMonthNum: m1.monthNum
  };
}

/**
 * Calculates the elapsed mission month for a missionary relative to Month 0 (Batch Cohort).
 * Month 0: Arrival / Batch Month (e.g. September 2026 when current is September 2026)
 * Month 1: 1st Drip Month (e.g. October 2026)
 *
 * Formula:
 *   elapsed = (targetYear - batchYear) * 12 + (targetMonth - batchMonthNum)
 *
 * @param {string} batchMonthStr
 * @param {number} maxMonths (18 for Sisters, 24 for Elders)
 * @param {Date} targetDate
 * @returns {number} 0..maxMonths
 */
export function calculateMissionMonth(batchMonthStr, maxMonths = 24, targetDate = new Date()) {
  const base = parseBatchCohort(batchMonthStr);
  const targetYear = targetDate.getFullYear();
  const targetMonth = targetDate.getMonth() + 1; // 1-12

  const elapsed = (targetYear - base.year) * 12 + (targetMonth - base.monthNum);
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
