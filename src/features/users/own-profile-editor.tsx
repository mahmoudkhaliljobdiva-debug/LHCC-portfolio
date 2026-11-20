import { countryOptions } from "@/data/countries";
import { ProfileEditor } from "@/features/users/profile-editor";
import type { Profile } from "@/types/profile";

export function OwnProfileEditor({ profile }: { readonly profile: Profile }) {
  return <ProfileEditor role={profile.role} countries={countryOptions} initial={{ fullName: profile.full_name, countryCode: profile.country_code, phone: profile.phone, age: profile.age, gender: profile.gender === "MALE" ? "male" : profile.gender === "FEMALE" ? "female" : null, homeAddress: profile.home_address }} />;
}
