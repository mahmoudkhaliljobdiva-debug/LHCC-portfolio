import "server-only";
import {z} from "zod";
import {requireRole} from "@/lib/auth/server";
import {createClient} from "@/lib/supabase/server";

const recentSchema=z.array(z.object({
  attemptId:z.uuid(),
  examTitle:z.string().nullable(),
  bankName:z.string(),
  questionId:z.string(),
  questionText:z.string(),
  answeredAt:z.string(),
  selectedOptionId:z.string(),
  correctOptionId:z.string(),
  selectedText:z.string().nullable(),
  correctText:z.string().nullable(),
  isCorrect:z.boolean(),
}));
export type RecentAnswer=z.infer<typeof recentSchema>[number];

export async function getStudentRecentAnswers(limit=15):Promise<RecentAnswer[]>{
  await requireRole("STUDENT");
  if(!Number.isInteger(limit)||limit<1||limit>30)throw new Error("Invalid answer history limit");
  const db=await createClient();
  const {data,error}=await db.rpc("student_recent_answers",{max_answers:limit});
  if(error)throw new Error("Unable to load recent completed answers.");
  return recentSchema.parse(data);
}
