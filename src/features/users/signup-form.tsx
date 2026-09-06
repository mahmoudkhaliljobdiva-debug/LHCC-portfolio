"use client";

import { ArrowLeft } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useState } from "react";

import { registerAccount } from "@/actions/auth";
import { MAX_HOME_ADDRESS_LENGTH, MAX_PROFILE_AGE, MIN_PROFILE_AGE } from "@/constants/profile";
import { countryOptions, DEFAULT_COUNTRY_CODE } from "@/data/countries";
import type { ProfileGender } from "@/types/account";

type RegistrationField = "fullName" | "email" | "password" | "confirmPassword" | "age" | "gender" | "homeAddress" | "countryCode" | "phone";

const inputClassName = "h-12 rounded-xl border bg-white px-4 text-slate-900 placeholder:text-slate-400";

export function SignupForm() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<ProfileGender | "">("");
  const [homeAddress, setHomeAddress] = useState("");
  const [countryCode, setCountryCode] = useState<string>(DEFAULT_COUNTRY_CODE);
  const [phone, setPhone] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Readonly<Record<string, readonly string[]>>>({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField(field: RegistrationField, value: string) {
    if (field === "fullName") setFullName(value);
    if (field === "email") setEmail(value);
    if (field === "password") setPassword(value);
    if (field === "confirmPassword") setConfirmPassword(value);
    if (field === "age") setAge(value);
    if (field === "gender") setGender(value as ProfileGender | "");
    if (field === "homeAddress") setHomeAddress(value);
    if (field === "countryCode") setCountryCode(value);
    if (field === "phone") setPhone(value);
    setFieldErrors((current) => {
      const remaining = { ...current };
      delete remaining[field];
      return remaining;
    });
    setError("");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const result = await registerAccount({
        fullName,
        email,
        password,
        confirmPassword,
        age: age === "" ? 0 : Number(age),
        gender,
        homeAddress,
        countryCode,
        phone,
      });
      if (!result.ok) {
        setError(result.error.message);
        setFieldErrors(result.error.fieldErrors ?? {});
        return;
      }

      setSuccess("Account created. An administrator must activate your account before you can sign in.");
      setPassword("");
      setConfirmPassword("");
    } catch {
      setError("Registration is temporarily unavailable. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="w-full max-w-md">
      <Link href={"/login" as Route} className="inline-flex items-center gap-2 text-sm font-semibold text-teal-700 hover:text-teal-800">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to sign in
      </Link>
      <p className="mt-8 text-sm font-semibold text-teal-700">Account registration</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Create Account</h1>
      <p className="mt-3 text-sm leading-6 text-slate-500">
        Enter your details to request access. An administrator will review and activate your account.
      </p>

      {error && <div role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}
      {success && <div role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{success}</div>}

      <form onSubmit={submit} className="mt-7 grid gap-5">
        <Field label="Full name" error={fieldErrors.fullName?.[0]}>
          <input type="text" required autoComplete="name" maxLength={200} value={fullName} onChange={(event) => updateField("fullName", event.target.value)} placeholder="Your full name" aria-invalid={Boolean(fieldErrors.fullName?.length)} className={inputClassName} />
        </Field>
        <Field label="Email address" error={fieldErrors.email?.[0]}>
          <input type="email" required autoComplete="email" value={email} onChange={(event) => updateField("email", event.target.value)} placeholder="you@institution.edu" aria-invalid={Boolean(fieldErrors.email?.length)} className={inputClassName} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <Field label="Country" error={fieldErrors.countryCode?.[0]}>
            <select required value={countryCode} onChange={(event) => updateField("countryCode", event.target.value)} aria-invalid={Boolean(fieldErrors.countryCode?.length)} autoComplete="country" className={inputClassName}>
              {countryOptions.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.flag} {country.name} ({country.callingCode})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Phone number" error={fieldErrors.phone?.[0]}>
            <input type="tel" required autoComplete="tel-national" inputMode="tel" maxLength={30} value={phone} onChange={(event) => updateField("phone", event.target.value)} placeholder="71 056 331" aria-invalid={Boolean(fieldErrors.phone?.length)} className={inputClassName} />
          </Field>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Age" error={fieldErrors.age?.[0]}>
            <input type="number" required inputMode="numeric" min={MIN_PROFILE_AGE} max={MAX_PROFILE_AGE} step={1} value={age} onChange={(event) => updateField("age", event.target.value)} placeholder="Your age" aria-invalid={Boolean(fieldErrors.age?.length)} className={inputClassName} />
          </Field>
          <Field label="Gender" error={fieldErrors.gender?.[0]}>
            <select required value={gender} onChange={(event) => updateField("gender", event.target.value)} aria-invalid={Boolean(fieldErrors.gender?.length)} className={inputClassName}>
              <option value="" disabled hidden>Select gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </Field>
        </div>
        <Field label="Home Address" error={fieldErrors.homeAddress?.[0]}>
          <textarea required autoComplete="street-address" maxLength={MAX_HOME_ADDRESS_LENGTH} rows={3} value={homeAddress} onChange={(event) => updateField("homeAddress", event.target.value)} placeholder="Your home address" aria-invalid={Boolean(fieldErrors.homeAddress?.length)} className="rounded-xl border bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400" />
        </Field>
        <Field label="Password" error={fieldErrors.password?.[0]} hint="Use 8 or more characters.">
          <input type="password" required minLength={8} maxLength={72} autoComplete="new-password" value={password} onChange={(event) => updateField("password", event.target.value)} placeholder="Create a password" aria-invalid={Boolean(fieldErrors.password?.length)} className={inputClassName} />
        </Field>
        <Field label="Confirm password" error={fieldErrors.confirmPassword?.[0]}>
          <input type="password" required minLength={8} maxLength={72} autoComplete="new-password" value={confirmPassword} onChange={(event) => updateField("confirmPassword", event.target.value)} placeholder="Repeat your password" aria-invalid={Boolean(fieldErrors.confirmPassword?.length)} className={inputClassName} />
        </Field>
        <button type="submit" disabled={isSubmitting || Boolean(success)} className="mt-1 rounded-xl bg-teal-700 px-5 py-3.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50">
          {isSubmitting ? "Creating account…" : "Create Account"}
        </button>
      </form>
      <p className="mt-5 text-center text-xs leading-5 text-slate-500">
        Account roles and access are assigned securely by an L.H.C.C administrator.
      </p>
    </section>
  );
}

function Field({
  label,
  error,
  hint,
  children,
}: {
  readonly label: string;
  readonly error: string | undefined;
  readonly hint?: string;
  readonly children: React.ReactNode;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-slate-700">
      {label}
      {children}
      {error ? <span className="text-xs text-rose-700">{error}</span> : hint ? <span className="text-xs font-normal text-slate-500">{hint}</span> : null}
    </label>
  );
}
