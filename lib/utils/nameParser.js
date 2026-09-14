/**
 * TCRP Universal Missionary Name Parser & Normalizer
 * Automatically detects Title (Elder/Sister), First Name, Last Name,
 * formats Title & Name ('Elder Dela Cruz'), and auto-generates missionary emails.
 */

// Surnames with multi-word particles (Philippine, Spanish, Dutch, etc.)
const MULTI_WORD_PREFIXES = [
  'de la', 'dela',
  'de los', 'delos',
  'del', 'de',
  'san', 'santa', 'sto', 'sta',
  'van', 'von', 'al', 'el'
];

/**
 * Capitalizes the first letter of each word (Title Case)
 */
export function toTitleCase(str) {
  if (!str) return '';
  return String(str)
    .trim()
    .toLowerCase()
    .replace(/(?:^|[\s\-\.\/])\S/g, char => char.toUpperCase());
}

/**
 * Normalizes email address to all lower case and standard missionary domain
 */
export function sanitizeEmail(email) {
  if (!email) return '';
  let clean = String(email).trim().toLowerCase();
  if (clean && !clean.includes('@')) clean += '@missionary.org';
  return clean;
}

/**
 * Generates an all-lowercase missionary email from First Name and Last Name
 * e.g., 'Charlie', 'Dela Cruz' -> 'charlie.dela.cruz@missionary.org'
 */
export function generateMissionaryEmail(firstName, lastName) {
  const cleanParts = [];
  if (firstName) {
    const fParts = firstName.toLowerCase().split(/[\s\-\.]+/).filter(Boolean);
    if (fParts.length > 0) cleanParts.push(...fParts);
  }
  if (lastName) {
    const lParts = lastName.toLowerCase().split(/[\s\-\.]+/).filter(Boolean);
    if (lParts.length > 0) cleanParts.push(...lParts);
  }
  if (cleanParts.length === 0) return '';
  return `${cleanParts.join('.')}@missionary.org`;
}

/**
 * Parses any raw missionary name string into its constituent components:
 * Title, First Name, Last Name, Title & Name (e.g. 'Elder Dela Cruz'), cohort, max_months.
 * 
 * Enforces explicit Title ('Elder' or 'Sister', or shortcuts 'e ', 's ', etc.).
 */
export function parseMissionaryName(rawInput) {
  if (!rawInput || typeof rawInput !== 'string') {
    return {
      valid: false,
      error: "Missionary name cannot be empty."
    };
  }

  let text = rawInput.trim();

  // 1. Detect and extract Title (Elder / Sister)
  let title = null;
  let cohort = null;
  let maxMonths = 24;

  // Check for parenthetical or suffixed title: e.g. "Smith, John (Elder)"
  const parenTitleMatch = text.match(/\((elder|sister)\)/i);
  if (parenTitleMatch) {
    const matched = parenTitleMatch[1].toLowerCase();
    title = matched === 'elder' ? 'Elder' : 'Sister';
    text = text.replace(parenTitleMatch[0], '').trim();
  }

  // Check prefix: "Elder", "Sister", or shortcuts "e ", "s ", "e.", "s."
  if (!title) {
    if (/^elder\b/i.test(text)) {
      title = 'Elder';
      text = text.replace(/^elder\b[\.\s,]*/i, '').trim();
    } else if (/^sister\b/i.test(text)) {
      title = 'Sister';
      text = text.replace(/^sister\b[\.\s,]*/i, '').trim();
    } else if (/^e[\.\s]+/i.test(text)) {
      title = 'Elder';
      text = text.replace(/^e[\.\s,]+/i, '').trim();
    } else if (/^s[\.\s]+/i.test(text)) {
      title = 'Sister';
      text = text.replace(/^s[\.\s,]+/i, '').trim();
    }
  }

  // If no explicit title was found, strictly require one per design
  if (!title) {
    return {
      valid: false,
      error: "Title ('Elder' or 'Sister') is strictly required."
    };
  }

  cohort = title.toLowerCase();
  maxMonths = cohort === 'sister' ? 18 : 24;

  // Remove any trailing comma or punctuation
  text = text.replace(/^[,.\s]+|[,.\s]+$/g, '').trim();

  // 2. Parse First Name and Last Name
  let firstName = '';
  let lastName = '';

  // Handle "Last, First" format (e.g. "Dela Cruz, Charlie")
  if (text.includes(',')) {
    const parts = text.split(',').map(s => s.trim()).filter(Boolean);
    lastName = toTitleCase(parts[0] || '');
    firstName = toTitleCase(parts.slice(1).join(' ') || '');
  } else {
    const words = text.split(/\s+/).filter(Boolean);

    if (words.length === 0) {
      return {
        valid: false,
        error: "Last name is required after Title."
      };
    }

    if (words.length === 1) {
      // Single name given (e.g. "Elder Bachini" or "Sister Mamon")
      lastName = toTitleCase(words[0]);
      firstName = '';
    } else {
      // Check for multi-word Philippine / Spanish surnames
      // Match candidate prefix from end of words
      let splitIndex = -1;

      // Check 3-word prefixes (e.g. "de la", "de los")
      if (words.length >= 3) {
        const last3Prefix = `${words[words.length - 3]} ${words[words.length - 2]}`.toLowerCase();
        if (MULTI_WORD_PREFIXES.includes(last3Prefix)) {
          splitIndex = words.length - 3;
        }
      }

      // Check 2-word prefixes (e.g. "dela", "san", "del", "delos", "de", "sta")
      if (splitIndex === -1 && words.length >= 2) {
        const last2Prefix = words[words.length - 2].toLowerCase();
        if (MULTI_WORD_PREFIXES.includes(last2Prefix)) {
          splitIndex = words.length - 2;
        }
      }

      if (splitIndex !== -1 && splitIndex > 0) {
        firstName = toTitleCase(words.slice(0, splitIndex).join(' '));
        lastName = toTitleCase(words.slice(splitIndex).join(' '));
      } else {
        // Standard First + Last split:
        // Everything before the final word is First Name, final word is Last Name
        firstName = toTitleCase(words.slice(0, words.length - 1).join(' '));
        lastName = toTitleCase(words[words.length - 1]);
      }
    }
  }

  // 3. Format Title & Name (e.g. 'Elder Dela Cruz', 'Sister Mamon')
  const titleAndName = `${title} ${lastName}`.trim();
  const email = generateMissionaryEmail(firstName, lastName);

  return {
    valid: true,
    title,
    cohort,
    maxMonths,
    firstName,
    lastName,
    name: titleAndName,       // "Title & Name" mapped directly to missionaries.name
    titleAndName,
    email: email.toLowerCase() // strictly all lower case
  };
}
