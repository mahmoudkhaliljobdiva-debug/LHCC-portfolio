import { CoursePackageGrid } from "@/features/question-banks/course-package-grid";
import { getStudentCoursePackages } from "@/lib/bank-access/server";

export default async function StudentBanksPage() {
  const packages = await getStudentCoursePackages();
  return <main className="space-y-6">
    <header>
      <h1 className="text-2xl font-semibold text-slate-950 sm:text-3xl">Courses</h1>
      <p className="mt-2 text-sm text-slate-600">
        Your chosen specialty's courses and exams are listed here.
        Request access once; LHCC administration reviews your request.
      </p>
    </header>
    <CoursePackageGrid packages={packages} />
  </main>;
}
