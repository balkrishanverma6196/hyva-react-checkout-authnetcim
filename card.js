/**
 * Client-side card checks so the customer gets instant feedback; Authorize.Net
 * validates again when tokenizing and charging.
 */
const TYPES = [
  { code: 'AE', pattern: /^3[47]/, cvv: 4 },
  { code: 'VI', pattern: /^4/, cvv: 3 },
  { code: 'MC', pattern: /^(5[1-5]|2(2[2-9]|[3-6]|7[01]|720))/, cvv: 3 },
  { code: 'DI', pattern: /^(6011|65|64[4-9]|622)/, cvv: 3 },
];

export const digitsOnly = (value) => String(value || '').replace(/\D/g, '');

export function detectType(number) {
  const digits = digitsOnly(number);
  return TYPES.find((type) => type.pattern.test(digits)) || null;
}

function passesLuhn(digits) {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let n = Number(digits[i]);
    if (double) {
      n *= 2;
      if (n > 9) {
        n -= 9;
      }
    }
    sum += n;
    double = !double;
  }
  return digits.length >= 13 && sum % 10 === 0;
}

/**
 * @returns {string} error message, '' when valid
 */
export function validateCard(card, allowedTypes) {
  const digits = digitsOnly(card.number);
  const type = detectType(digits);
  if (!passesLuhn(digits)) {
    return 'Please enter a valid card number.';
  }
  if (!type || (allowedTypes.length && !allowedTypes.includes(type.code))) {
    return 'This card type is not accepted.';
  }
  const month = Number(card.month);
  const year = Number(card.year);
  const now = new Date();
  if (
    !month ||
    !year ||
    year < now.getFullYear() ||
    (year === now.getFullYear() && month < now.getMonth() + 1)
  ) {
    return 'Please enter a valid expiration date.';
  }
  if (digitsOnly(card.cvv).length !== type.cvv) {
    return 'Please enter the security code (CVV) on your card.';
  }
  return '';
}
