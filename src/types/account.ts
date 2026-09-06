export type ProfileGender = "male" | "female";

export interface AccountRegistrationInput {
  readonly fullName: string;
  readonly email: string;
  readonly password: string;
  readonly confirmPassword: string;
  readonly age: number;
  readonly gender: ProfileGender | "";
  readonly homeAddress: string;
  readonly countryCode: string;
  readonly phone: string;
}
