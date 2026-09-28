export interface OwnProfileInput {
  readonly fullName: string;
  readonly countryCode: string | null;
  readonly phone: string | null;
  readonly age: number | null;
  readonly gender: "male" | "female" | null;
  readonly homeAddress: string | null;
}
