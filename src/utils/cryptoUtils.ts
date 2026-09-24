export function isWeakPassword(password: string): boolean {
  if (!password || password.length < 8) return true;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);

  const classesCount = [hasUpper, hasLower, hasDigit, hasSymbol].filter(Boolean).length;

  if (password.length < 12 && classesCount < 3) return true;
  if (classesCount < 2) return true;

  return false;
}

export function calculateEntropy(password: string): { bits: number; crackTime: string; crackTimeDisplay: string } {
  if (!password) return { bits: 0, crackTime: 'Instant', crackTimeDisplay: 'Instant' };

  let poolSize = 0;
  if (/[a-z]/.test(password)) poolSize += 26;
  if (/[A-Z]/.test(password)) poolSize += 26;
  if (/[0-9]/.test(password)) poolSize += 10;
  if (/[^A-Za-z0-9]/.test(password)) poolSize += 33;

  if (poolSize === 0) return { bits: 0, crackTime: 'Instant', crackTimeDisplay: 'Instant' };

  const bits = Math.round(password.length * Math.log2(poolSize));

  let crackTime = 'Instant';
  if (bits < 28) {
    crackTime = 'Instant';
  } else if (bits < 36) {
    crackTime = 'A few seconds';
  } else if (bits < 48) {
    crackTime = 'Several hours';
  } else if (bits < 60) {
    crackTime = 'Few months';
  } else if (bits < 75) {
    crackTime = 'Decades';
  } else if (bits < 90) {
    crackTime = 'Centuries';
  } else {
    crackTime = 'Millions of years';
  }

  return { bits, crackTime, crackTimeDisplay: crackTime };
}

export function calculatePasswordStrength(password: string): {
  score: number; // 0 to 4
  label: 'Very Weak' | 'Weak' | 'Fair' | 'Strong' | 'Very Strong';
  color: string;
} {
  if (!password) return { score: 0, label: 'Very Weak', color: 'bg-rose-500' };

  const { bits } = calculateEntropy(password);

  let score = 0;
  if (bits >= 80) {
    score = 4;
  } else if (bits >= 60) {
    score = 3;
  } else if (bits >= 45) {
    score = 2;
  } else if (bits >= 30) {
    score = 1;
  } else {
    score = 0;
  }

  const map: Record<number, { label: 'Very Weak' | 'Weak' | 'Fair' | 'Strong' | 'Very Strong'; color: string }> = {
    0: { label: 'Very Weak', color: 'bg-rose-500' },
    1: { label: 'Weak', color: 'bg-rose-400' },
    2: { label: 'Fair', color: 'bg-amber-400' },
    3: { label: 'Strong', color: 'bg-emerald-400' },
    4: { label: 'Very Strong', color: 'bg-emerald-300' },
  };

  return { score, ...map[score] };
}
