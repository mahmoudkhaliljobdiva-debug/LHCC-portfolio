import { getCountries, getCountryCallingCode, type CountryCode } from "libphonenumber-js/min";

export interface CountryOption {
  readonly code: CountryCode;
  readonly name: string;
  readonly callingCode: string;
  readonly flag: string;
}

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

export const countryOptions: readonly CountryOption[] = getCountries()
  .map((code) => ({
    code,
    name: regionNames.of(code) ?? code,
    callingCode: `+${getCountryCallingCode(code)}`,
    flag: countryFlag(code),
  }))
  .sort((left, right) => left.name.localeCompare(right.name));

export const DEFAULT_COUNTRY_CODE: CountryCode = "LB";

export function countryFlag(code: CountryCode): string {
  return String.fromCodePoint(...code.split("").map((letter) => 127397 + letter.charCodeAt(0)));
}
