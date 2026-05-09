export function companyPrefix(index: number): string {
  if (index < 0 || !Number.isInteger(index)) {
    throw new Error(`Invalid company index: ${index}`);
  }

  const alphabetSize = 26;
  let value = index;
  let prefix = '';

  do {
    prefix = String.fromCharCode(65 + (value % alphabetSize)) + prefix;
    value = Math.floor(value / alphabetSize) - 1;
  } while (value >= 0);

  return prefix;
}

export function companyName(index: number): string {
  return `${companyPrefix(index)} Rocket`;
}
