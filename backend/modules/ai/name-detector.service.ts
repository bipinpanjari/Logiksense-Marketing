import { Injectable, Logger } from '@nestjs/common';

export interface NameDetectorInput {
  email?: string | null;
  linkedinName?: string | null;
  companyName?: string | null;
  jobTitle?: string | null;
  industry?: string | null;
  location?: string | null;
  tenureYears?: number | null;
  source?: 'linkedin' | 'email' | 'google_places' | 'manual';
  contactId?: string | null;
}

export interface NameDetectionResult {
  method:
    | 'linkedin_name'
    | 'email_firstname_lastname'
    | 'email_firstname_only'
    | 'email_firstname_no_separator'
    | 'not_detected';
  confidence: 'high' | 'medium' | 'low' | 'none';
  rawValue: string | null;
  firstName: string | null;
  fullName: string | null;
  culturalFlag:
    | null
    | 'east_asian'
    | 'south_asian'
    | 'middle_eastern'
    | 'hyphenated'
    | 'mc_mac'
    | 'apostrophe';
}

export interface GreetingResult {
  salutation: string;
  fallbackUsed: false | 'team' | 'universal' | 'role';
  fallbackReason:
    | null
    | 'role_based_email'
    | 'generic_email'
    | 'no_name_in_email'
    | 'ambiguous_name';
}

export interface PersonalizationResult {
  nameDetection: NameDetectionResult;
  greeting: GreetingResult;
  company: { displayName: string; domain: string | null; source: string };
  subjectLineToken: { useName: boolean; token: string; suggestedSubjectPattern: string };
  anchors: {
    industry: string | null;
    location: string | null;
    jobTitle: string | null;
    companyDisplay: string | null;
    tenureSignal: 'new_role' | 'established' | 'unknown';
    persona: 'business_owner' | 'manager' | 'gatekeeper' | 'unknown';
  };
  flags: { doNotPersonalise: boolean; reviewRequired: boolean; reviewReason: string | null };
}

const GENERIC_LOCAL_PARTS = new Set([
  'info',
  'hello',
  'sales',
  'enquiries',
  'admin',
  'office',
  'contact',
  'mail',
  'accounts',
  'billing',
  'support',
  'help',
  'reception',
  'team',
  'general',
  'news',
  'noreply',
  'no-reply',
  'donotreply',
  'bookings',
  'reservations',
  'orders',
  'jobs',
  'careers',
  'hr',
  'marketing',
]);

const KNOWN_FIRST_NAMES = new Set([
  'john', 'michael', 'robert', 'james', 'william', 'david', 'richard', 'charles', 'joseph',
  'thomas', 'christopher', 'daniel', 'matthew', 'anthony', 'mark', 'donald', 'steven', 'paul',
  'andrew', 'joshua', 'kenneth', 'kevin', 'brian', 'george', 'edward', 'ronald', 'timothy',
  'jason', 'jeffrey', 'ryan', 'jacob', 'gary', 'nicholas', 'eric', 'jonathan', 'stephen',
  'larry', 'justin', 'scott', 'brandon', 'benjamin', 'samuel', 'frank', 'gregory', 'alexander',
  'raymond', 'patrick', 'jack', 'dennis', 'jerry', 'tyler', 'aaron', 'jose', 'adam', 'henry',
  'douglas', 'zachary', 'peter', 'kyle', 'walter', 'harold', 'keith', 'christian', 'roger',
  'terry', 'sean', 'austin', 'gerald', 'carl', 'arthur', 'wayne', 'billy', 'bruce', 'nathan',
  'ralph', 'roy', 'eugene', 'bobby', 'johnny', 'tommy',
  'mary', 'patricia', 'barbara', 'linda', 'susan', 'jessica', 'sarah', 'karen', 'nancy', 'lisa',
  'betty', 'margaret', 'sandra', 'ashley', 'kimberly', 'emily', 'donna', 'michelle', 'carolyn',
  'rebecca', 'sharon', 'laura', 'cynthia', 'kathleen', 'amy', 'angela', 'shirley', 'anna',
  'brenda', 'pamela', 'emma', 'nicole', 'helen', 'samantha', 'katherine', 'christine', 'debra',
  'rachel', 'catherine', 'janet', 'ruth', 'maria', 'heather', 'diane', 'virginia', 'julie',
  'joyce', 'victoria', 'olivia', 'kelly', 'christina', 'lauren', 'joan', 'evelyn', 'judith',
  'megan', 'andrea', 'cheryl', 'hannah', 'jacqueline', 'martha', 'fiona', 'sophia', 'madison',
  'teresa', 'gloria', 'sara', 'gail', 'jackie', 'tiffany', 'bonnie', 'sheila',
  'raj', 'rajesh', 'priya', 'amit', 'anita', 'arjun', 'deepak', 'aarav', 'samir', 'aisha',
  'fatima', 'mohammed', 'ahmad', 'hassan', 'ali', 'ahmed', 'omar', 'muhammad', 'wei', 'ming',
  'juan', 'carlos', 'diego', 'antonio', 'pierre', 'marie', 'jean', 'hans', 'franz', 'klaus',
  'ivan', 'dimitri', 'alexei', 'natasha', 'igor', 'piotr', 'jozef', 'fardin', 'arman',
]);

const PREFIXES = ['dr', 'dr.', 'mr', 'mr.', 'mrs', 'mrs.', 'ms', 'ms.', 'prof', 'prof.'];
const SUFFIXES = ['jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv', 'phd', 'mba', 'cpa', 'cfa', 'esq', 'md', 'dds'];
const NOREPLY = ['noreply', 'no-reply', 'donotreply', 'do-not-reply', 'no_reply', 'not-reply', 'automated'];

function titleCase(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(' ')
    .map((word) => {
      if (/^mc[a-z]/.test(word)) return 'Mc' + word.charAt(2).toUpperCase() + word.slice(3);
      if (/^mac[a-z]/.test(word)) return 'Mac' + word.charAt(3).toUpperCase() + word.slice(4);
      if (/^o'[a-z]/.test(word)) return "O'" + word.charAt(2).toUpperCase() + word.slice(3);
      if (word.includes('-')) {
        return word
          .split('-')
          .map((p) => (p ? p.charAt(0).toUpperCase() + p.slice(1) : p))
          .join('-');
      }
      return word ? word.charAt(0).toUpperCase() + word.slice(1) : word;
    })
    .join(' ');
}

function splitEmail(email: string): { local: string | null; domain: string | null } {
  if (!email || !email.includes('@')) return { local: null, domain: null };
  const [local, domain] = email.split('@');
  return { local: local?.toLowerCase() ?? null, domain: (domain ?? '').toLowerCase() || null };
}

function extractCompanyFromDomain(domain: string): string {
  let slug = domain
    .replace(/\.(com|co|net|org|io|ai|app|uk|au|us|ca|de|fr)(\.[a-z]{2})?$/i, '')
    .replace(/^www\./, '');
  slug = slug.replace(/[-_]/g, ' ');
  return titleCase(slug);
}

function isLikelyFirstName(word: string): boolean {
  if (!word || word.length < 2 || word.length > 20) return false;
  const lower = word.toLowerCase();
  if (KNOWN_FIRST_NAMES.has(lower)) return true;
  if (GENERIC_LOCAL_PARTS.has(lower)) return false;
  return /^[A-Z][a-z]+$/.test(word);
}

function stripAffixes(name: string): string {
  let s = name.toLowerCase().trim();
  for (const p of PREFIXES) {
    if (s.startsWith(p + ' ')) s = s.slice(p.length).trim();
  }
  const parts = s.split(/\s+/);
  while (parts.length > 1 && SUFFIXES.includes(parts[parts.length - 1].replace(/[.,]/g, ''))) {
    parts.pop();
  }
  return titleCase(parts.join(' '));
}

function detectCultural(name: string): NameDetectionResult['culturalFlag'] {
  if (!name) return null;
  const lower = name.toLowerCase();
  if (name.includes('-')) return 'hyphenated';
  if (name.includes("'")) return 'apostrophe';
  if (/^mc[a-z]/i.test(name)) return 'mc_mac';
  if (/^mac[a-z]/i.test(name)) return 'mc_mac';
  const parts = name.split(/\s+/);
  if (
    parts.length >= 2 &&
    ['wang', 'li', 'zhang', 'liu', 'chen', 'yang', 'nguyen', 'tran', 'pham'].includes(parts[0].toLowerCase())
  ) {
    return 'east_asian';
  }
  if (
    parts.length >= 2 &&
    ['kumar', 'singh', 'sharma', 'patel', 'gupta', 'verma', 'malhotra', 'nair'].includes(
      parts[parts.length - 1].toLowerCase(),
    )
  ) {
    return 'south_asian';
  }
  if (lower.includes('al-') || /(al-|bin |abu )/i.test(lower)) return 'middle_eastern';
  return null;
}

@Injectable()
export class NameDetectorService {
  private readonly logger = new Logger(NameDetectorService.name);

  detect(input: NameDetectorInput): PersonalizationResult {
    const nameDetection = this.runDetection(input);
    const { local, domain } = splitEmail(input.email ?? '');

    let companyDisplay = input.companyName?.trim() || '';
    let companySource: string = 'unknown';
    if (companyDisplay) {
      companySource = 'company_name_field';
    } else if (domain && !/gmail|hotmail|yahoo|outlook|icloud/.test(domain)) {
      companyDisplay = extractCompanyFromDomain(domain);
      companySource = 'domain_extracted';
    }

    const greeting = this.buildGreeting(nameDetection, companyDisplay, local);
    const subjectLineToken = this.buildSubjectToken(nameDetection, companyDisplay, input);
    const persona = this.detectPersona(input.jobTitle ?? null);

    const isNoreply = !!local && NOREPLY.some((p) => local.includes(p));
    const flags = {
      doNotPersonalise: isNoreply,
      reviewRequired: false,
      reviewReason: isNoreply ? 'noreply_email' : null,
    } as PersonalizationResult['flags'];

    if (nameDetection.culturalFlag === 'east_asian') {
      flags.reviewRequired = true;
      flags.reviewReason = 'east_asian_name_order';
    }
    if (
      nameDetection.firstName &&
      (nameDetection.firstName.length <= 2 || /[0-9]/.test(nameDetection.firstName))
    ) {
      flags.reviewRequired = true;
      flags.reviewReason = 'name_too_short_or_contains_numbers';
    }

    let tenureSignal: 'new_role' | 'established' | 'unknown' = 'unknown';
    if (typeof input.tenureYears === 'number') {
      tenureSignal = input.tenureYears < 2 ? 'new_role' : 'established';
    }

    return {
      nameDetection,
      greeting,
      company: { displayName: companyDisplay, domain, source: companySource },
      subjectLineToken,
      anchors: {
        industry: input.industry ?? null,
        location: input.location ?? null,
        jobTitle: input.jobTitle ?? null,
        companyDisplay: companyDisplay || null,
        tenureSignal,
        persona,
      },
      flags,
    };
  }

  private runDetection(input: NameDetectorInput): NameDetectionResult {
    const linkedin = this.fromLinkedIn(input.linkedinName ?? null);
    if (linkedin) return linkedin;
    const email = this.fromEmailLocalPart(input.email ?? null);
    if (email) return email;
    return {
      method: 'not_detected',
      confidence: 'none',
      rawValue: null,
      firstName: null,
      fullName: null,
      culturalFlag: null,
    };
  }

  private fromLinkedIn(name: string | null): NameDetectionResult | null {
    if (!name || !name.trim()) return null;
    const stripped = stripAffixes(name.trim());
    const parts = stripped.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return null;
    const cultural = detectCultural(stripped);
    let firstName = parts[0];
    if (cultural === 'east_asian' && parts.length === 2) firstName = parts[1];
    firstName = titleCase(firstName);
    if (!isLikelyFirstName(firstName)) return null;
    return {
      method: 'linkedin_name',
      confidence: 'high',
      rawValue: name,
      firstName,
      fullName: stripped,
      culturalFlag: cultural,
    };
  }

  private fromEmailLocalPart(email: string | null): NameDetectionResult | null {
    if (!email || !email.includes('@')) return null;
    const { local } = splitEmail(email);
    if (!local) return null;

    if (local.includes('.') || local.includes('-') || local.includes('_')) {
      const sep = local.includes('.') ? '.' : local.includes('-') ? '-' : '_';
      const parts = local.split(sep).filter(Boolean);
      if (parts.length === 2 && parts[0].length > 1) {
        const firstName = titleCase(parts[0]);
        if (isLikelyFirstName(firstName)) {
          return {
            method: 'email_firstname_lastname',
            confidence: 'medium',
            rawValue: local,
            firstName,
            fullName: titleCase(parts.join(' ')),
            culturalFlag: null,
          };
        }
      }
      return null;
    }

    const alpha = local.split(/([0-9]+)/)[0];
    if (alpha.length > 4) {
      for (let i = 2; i < Math.min(alpha.length - 1, 10); i++) {
        const candidate = alpha.substring(0, i);
        if (isLikelyFirstName(candidate)) {
          const firstName = titleCase(candidate);
          const lastName = titleCase(alpha.substring(i));
          return {
            method: 'email_firstname_no_separator',
            confidence: 'medium',
            rawValue: local,
            firstName,
            fullName: `${firstName} ${lastName}`.trim(),
            culturalFlag: null,
          };
        }
      }
    }

    if (local.length >= 2 && local.length <= 15 && /^[a-z]+$/.test(local)) {
      const firstName = titleCase(local);
      if (isLikelyFirstName(firstName) && !GENERIC_LOCAL_PARTS.has(local)) {
        return {
          method: 'email_firstname_only',
          confidence: 'medium',
          rawValue: local,
          firstName,
          fullName: firstName,
          culturalFlag: null,
        };
      }
    }

    return null;
  }

  private buildGreeting(
    det: NameDetectionResult,
    companyDisplay: string,
    local: string | null,
  ): GreetingResult {
    if (det.firstName && det.confidence !== 'none') {
      return { salutation: `Hi ${det.firstName},`, fallbackUsed: false, fallbackReason: null };
    }
    if (local && GENERIC_LOCAL_PARTS.has(local)) {
      if (companyDisplay) {
        return {
          salutation: `Hi ${companyDisplay} team,`,
          fallbackUsed: 'team',
          fallbackReason: 'role_based_email',
        };
      }
      return { salutation: 'Hi there,', fallbackUsed: 'universal', fallbackReason: 'generic_email' };
    }
    if (companyDisplay) {
      return {
        salutation: `Hi ${companyDisplay} team,`,
        fallbackUsed: 'team',
        fallbackReason: 'no_name_in_email',
      };
    }
    return { salutation: 'Hi there,', fallbackUsed: 'universal', fallbackReason: 'no_name_in_email' };
  }

  private buildSubjectToken(
    det: NameDetectionResult,
    companyDisplay: string,
    input: NameDetectorInput,
  ) {
    const useName = !!det.firstName && det.confidence !== 'none';
    const token = det.firstName || companyDisplay || input.industry || 'there';
    let pattern: string;
    if (useName && det.firstName) {
      pattern = companyDisplay
        ? `${det.firstName}, quick question about ${companyDisplay}`
        : `${det.firstName}, a quick thought`;
    } else if (companyDisplay) {
      pattern = `${companyDisplay} — quick question`;
    } else if (input.industry && input.location) {
      pattern = `${input.location} ${input.industry} businesses`;
    } else {
      pattern = 'Quick thought about your business';
    }
    return { useName, token, suggestedSubjectPattern: pattern };
  }

  private detectPersona(jobTitle: string | null) {
    if (!jobTitle) return 'unknown' as const;
    const lower = jobTitle.toLowerCase();
    if (/(owner|founder|director|ceo|md|managing director|president)/.test(lower)) return 'business_owner' as const;
    if (/(manager|supervisor|lead|head of)/.test(lower)) return 'manager' as const;
    if (/(receptionist|admin|assistant|secretary)/.test(lower)) return 'gatekeeper' as const;
    return 'unknown' as const;
  }
}
