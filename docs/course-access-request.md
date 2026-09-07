Update the authentication and course-access architecture to support the following business flow.

Preserve the existing UI design as much as possible.

Do not redesign unrelated areas.

# Business Requirement

Public users should be able to create an account and then sign in normally.

Account login should NOT depend on whether they are approved for a class/question bank.

Instead:

```text
Account authentication
```

and:

```text
Course / Question Bank access
```

must be separate concepts.

---

# 1. Sign In Logic

Sign In should be based on:

```text
Email
Password
```

Use the existing Supabase:

```ts
supabase.auth.signInWithPassword({
  email,
  password
})
```

Supabase is responsible for verifying whether the password matches the email account.

Do NOT implement custom password comparison.

Do NOT store passwords in application tables.

If credentials are wrong, display the existing safe generic error:

```text
Incorrect email or password.
```

After successful authentication:

```text
Supabase Auth success
↓
Load profile
↓
Determine role
↓
Redirect
```

Role routing should remain:

```text
ADMIN   → /admin
TEACHER → /teacher
STUDENT → /student
```

---

# 2. Important Change — Public Students Can Sign In

Currently public signup creates:

```text
STUDENT
INACTIVE
```

and INACTIVE users cannot sign in.

Change this behavior.

A normal public Student account should be allowed to sign in after account creation.

Do NOT use Student profile activation as the mechanism for controlling access to courses.

Course access must be controlled separately.

Review the existing:

```text
status
activation_start
activation_months
expiration_date
is_profile_access_active()
```

logic.

Do not blindly remove these fields because Admin/Teacher account controls may still depend on them.

Instead redesign the Student authentication path so that a normal registered Student can access the Student portal while having zero approved question banks.

Clearly document the chosen behavior.

---

# 3. Sign Up

Public Create Account should continue collecting the current fields:

```text
Full Name
Email
Country
Phone
Age
Gender
Home Address
Password
Confirm Password
```

Public signup must always create:

```text
role = STUDENT
```

The public user must NOT be allowed to choose:

```text
ADMIN
TEACHER
role
status
activation
expiration
```

After successful signup, the user should be able to sign in normally.

---

# 4. Question Banks Must Be Visible

After Student login, show all active/publicly available question banks/courses.

Example:

```text
Human Anatomy              🔒 Locked
Cardiology                 🔒 Locked
Nursing Fundamentals       🔒 Locked
Medical Terminology        🔒 Locked
```

The Student should be able to see:

* Bank/course name
* Description
* Image/icon if currently supported
* Access state

But they must NOT be able to open questions when access is not approved.

---

# 5. Access States

Implement explicit Student-bank access states.

Recommended values:

```text
LOCKED
PENDING
APPROVED
REJECTED
```

Prefer storing request state in a real Supabase table rather than deriving it from UI state.

Design or update the relevant schema.

A good model is:

```text
user_bank_access_requests
```

or extend the existing bank-access architecture if that is cleaner.

Suggested fields:

```text
id
user_id
question_bank_id
status
requested_at
reviewed_at
reviewed_by
rejection_reason
created_at
updated_at
```

Statuses:

```text
PENDING
APPROVED
REJECTED
```

Do not store `LOCKED` as a row unless needed.

No row can naturally mean:

```text
LOCKED
```

---

# 6. Student Request Access

When a locked bank is shown, display:

```text
Request Access
```

When Student clicks it:

```text
Student
↓
Request Access
↓
Create PENDING request
↓
Bank displays "Pending Approval"
```

Prevent duplicate pending requests.

For the same:

```text
student + question_bank
```

there should not be multiple active PENDING requests.

---

# 7. Pending UI

After request:

Instead of:

```text
Request Access
```

show something like:

```text
Pending Approval
```

The Student cannot enter the bank yet.

Refresh must preserve this state because it comes from Supabase.

---

# 8. Admin Request Management

Add an Admin section for course/bank access requests.

Admin should see:

```text
Student
Bank / Course
Request Date
Current Status
```

Actions:

```text
Approve
Reject
```

Example:

```text
Mahmoud Khalil
Human Anatomy
Requested: Sep 6, 2026

[Approve] [Reject]
```

---

# 9. Admin Approve

When Admin approves:

```text
Request
↓
APPROVED
↓
Student gets active bank access
```

Use the existing:

```text
user_bank_access
```

architecture if already implemented.

Recommended final relationship:

```text
Access Request
    ↓ approved
user_bank_access
```

The operation should be atomic where practical.

Do not create duplicate access rows.

---

# 10. Admin Reject

When Admin rejects:

```text
status = REJECTED
reviewed_by = admin
reviewed_at = database/server time
```

Student sees:

```text
Access Request Rejected
```

Provide a reasonable mechanism for requesting again later.

Do not silently delete rejected request history.

---

# 11. Approved Student Experience

After approval:

```text
Human Anatomy
✓ Access Granted

[Open Course]
```

The Student can enter the bank and use its questions.

Server/database authorization must verify access.

Do NOT rely only on whether the button is visible.

For every protected question-bank request verify:

```text
authenticated user
AND
student owns access
AND
access is APPROVED/ACTIVE
AND
bank is active
```

---

# 12. Locked Student Experience

If Student manually enters a URL such as:

```text
/student/banks/123
```

without approval:

Do NOT return the questions.

Redirect/show:

```text
You don't have access to this course.
```

Do not leak:

* Questions
* Options
* Correct answers
* Hidden course data

---

# 13. Correct Answer Security

Continue protecting:

```text
is_correct
```

Students must never receive correct-answer metadata before submitting an answer.

Approval for a bank does not mean authorization to receive solution metadata.

---

# 14. Authentication vs Course Authorization

Keep these concepts separate.

## Authentication

Answers:

```text
Who is this user?
```

Handled by:

```text
Supabase Auth
Email + Password
```

## Portal Role

Answers:

```text
Which portal?
```

Handled by:

```text
profiles.role
```

## Course Authorization

Answers:

```text
Which bank/course can this Student open?
```

Handled by:

```text
user_bank_access
/
approved access request
```

Do not mix them together.

---

# 15. Student Profile Status

Inspect the existing `INACTIVE`, `ACTIVE`, and `EXPIRED` profile system carefully.

Current behavior was designed around account-level activation.

Change it so public Students are not blocked from the whole site merely because they have no class approval.

If profile status remains necessary for administrative suspension, preserve that capability.

A recommended distinction is:

```text
Account enabled/disabled
```

versus:

```text
Course access approved/not approved
```

For example an Admin may still deactivate an abusive account, which should block login/site access.

But a normal newly registered Student should not start administratively disabled.

Document exactly how this is implemented.

---

# 16. Recommended New Student Signup State

Unless the existing architecture requires another secure solution, public signup should effectively result in:

```text
role = STUDENT
account usable = true
course accesses = none
```

Meaning:

```text
Student can sign in
Student sees dashboard
Student sees locked banks
Student requests access
```

Do not automatically grant any course.

---

# 17. Admin / Teacher Accounts

Do not accidentally change existing Admin and Teacher security.

Admin-created Teacher accounts may continue to use the existing activation/expiration mechanism if required.

Admin accounts must remain protected.

Public signup must never create Teacher/Admin users.

---

# 18. RLS

Add/update appropriate RLS.

Student should be able to:

```text
SELECT own access requests
INSERT own access request
SELECT own approved bank access
```

Student must NOT be able to:

```text
Approve own request
Change request to APPROVED
Change reviewed_by
Grant themselves bank access
View another Student's requests
```

Admin approval must happen through trusted server-side authorization.

Do not create a broad:

```sql
TO authenticated
USING (true)
```

policy.

---

# 19. Server Actions

Prefer server actions for mutations such as:

```text
requestBankAccess()
approveBankAccessRequest()
rejectBankAccessRequest()
```

Each action must perform authorization.

Example:

```text
requestBankAccess()
```

must verify:

```text
authenticated student
valid bank
bank active
no existing active access
no duplicate pending request
```

Admin actions must verify active Admin authorization before using privileged access.

---

# 20. Database Time

Use database/server timestamps for:

```text
requested_at
reviewed_at
access granted_at
```

Do not trust browser time.

---

# 21. Student Bank Cards

Update the existing bank/course cards to display these states:

### Locked

```text
🔒 Locked
[Request Access]
```

### Pending

```text
⏳ Pending Approval
```

### Approved

```text
✓ Access Granted
[Open Course]
```

### Rejected

```text
Access Request Rejected
[Request Again]
```

Preserve the current visual design.

Do not redesign the entire Student dashboard.

---

# 22. Refresh Behavior

All access state must come from Supabase.

Therefore:

```text
Student requests access
↓
refresh
↓
still Pending
```

and:

```text
Admin approves
↓
Student refreshes
↓
course becomes unlocked
```

No localStorage should be used as the source of truth.

---

# 23. Fix Existing Signup Issue

The current authentication audit found that public signup code expects email confirmation to be disabled while the current Supabase configuration was still returning an unconfirmed account.

Resolve this cleanly according to the intended signup experience.

The desired experience is:

```text
Create Account
↓
Account successfully created
↓
User can sign in
```

Do not leave the current partial-success state where Supabase creates an account but the UI reports signup failure.

---

# 24. Keep Password Authentication Simple

Sign In logic must remain:

```text
Email
+
Password
↓
Supabase Auth verification
```

Do not compare plaintext passwords manually.

Do not query password hashes.

Do not store custom passwords.

---

# 25. Migration Safety

Do not modify already-applied migrations.

Create new Supabase migrations.

Existing users must continue working.

If changing existing Student profile status behavior, migrate existing records carefully.

Do not accidentally activate administratively disabled users without determining why they were disabled.

---

# 26. Testing

Test at minimum:

### Signup

1. New user creates account.
2. Role is STUDENT.
3. User cannot choose ADMIN/TEACHER.
4. Profile data persists.
5. User can sign in.

### Login

6. Correct email/password succeeds.
7. Wrong password fails.
8. Wrong email fails.
9. Password remains Supabase-managed.

### Locked banks

10. Student sees banks.
11. Student without access cannot enter.
12. Student cannot bypass lock through URL.

### Request

13. Request Access creates PENDING request.
14. Refresh keeps PENDING.
15. Duplicate PENDING request is prevented.

### Admin

16. Admin sees request.
17. Admin approves.
18. Approval creates/grants bank access.
19. Admin rejects another request.
20. Student cannot approve own request.

### Approved

21. Approved Student refreshes.
22. Bank shows unlocked.
23. Student can open questions.

### Security

24. Student cannot view another student's requests.
25. Student cannot modify request status directly.
26. Student cannot insert `user_bank_access` directly to grant themselves access.
27. Student cannot see correct-answer metadata prematurely.

---

# 27. Validation

Run:

```bash
npm run typecheck
npm run lint
npm run build
git diff --check
```

Run relevant Supabase security/database advisors.

Fix issues caused by this change.

---

# 28. Git / Vercel

After everything is verified:

1. Review `git diff`.
2. Review `git status`.
3. Commit the completed change.
4. Push to the established Git branch.
5. Let Vercel automatically deploy through Git integration.

Do not manually redeploy if Git auto-deployment is working.

---

# Final Report

Report:

1. Previous auth behavior
2. New auth behavior
3. Public signup default role/status
4. How Student account access now works
5. Database migration(s)
6. Access-request schema
7. RLS policies
8. Student request server action
9. Admin approval/rejection actions
10. How approved access becomes `user_bank_access`
11. Locked/Pending/Approved/Rejected UI behavior
12. Signup email-confirmation fix
13. Security test results
14. Typecheck result
15. Lint result
16. Build result
17. Commit hash
18. Git push result
19. Vercel deployment status
