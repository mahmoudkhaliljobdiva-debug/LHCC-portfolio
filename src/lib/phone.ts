import {
  getCountries,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js/min";

const supportedCountryCodes = new Set<string>(getCountries());

export function isCountryCode(value: string): value is CountryCode {
  return supportedCountryCodes.has(value);
}

export function normalizePhoneNumber(
  nationalNumber: string,
  countryCode: CountryCode,
): string | null {
  const phoneNumber = parsePhoneNumberFromString(nationalNumber.trim(), countryCode);

  if (!phoneNumber?.isValid()) return null;
  return phoneNumber.number;
}
