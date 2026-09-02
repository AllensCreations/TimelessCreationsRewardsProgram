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
