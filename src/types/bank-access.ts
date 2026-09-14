export type BankAccessStatus = "LOCKED" | "PENDING" | "APPROVED" | "REJECTED";

export interface CourseBank {
  id: string;
  name: string;
  description: string;
  status: "active" | "inactive";
  display_order: number;
  image_url: string | null;
  price: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BankAccessRequest {
  id: string;
  user_id: string;
  question_bank_id: string;
  status: Exclude<BankAccessStatus, "LOCKED">;
  requested_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface BankAccess {
  id: string;
  user_id: string;
  question_bank_id: string;
  status: "ACTIVE" | "REVOKED";
  granted_at: string;
  granted_by: string;
  request_id: string | null;
  price: number;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface StudentBank extends CourseBank {
  accessState: BankAccessStatus;
  rejectionReason: string | null;
}

export interface AdminAccessRequest extends BankAccessRequest {
  student_name: string;
  bank_name: string;
}

export interface StudentQuestion {
  id: string;
  question_bank_id: string;
  text: string;
  status: string;
  options: { id: string; text: string }[];
}

export interface AnswerSubmission {
  correct: boolean;
  attemptId: string;
  completed: boolean;
  scorePercentage: number;
}

export interface RecordedAnswer {
  questionId: string;
  selectedOptionId: string;
  isCorrect: boolean;
}
