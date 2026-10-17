export interface User { id: number; email: string; name: string | null; avatar: string | null }

export type EmailStatus = "scheduled" | "processing" | "sent" | "failed";

export interface EmailItem {
  id: string;
  to_email: string;
  subject: string;
  preview: string;
  scheduled_at: string;
  sent_at: string | null;
  status: EmailStatus;
  error: string | null;
  preview_url: string | null;
}

export interface EmailDetail extends Omit<EmailItem, "preview"> {
  body: string;
  sender_email: string;
}

export interface Counts { scheduled: number; sent: number }

export interface ScheduleRequest {
  subject: string;
  body: string;
  recipients: string[];
  startTime: string;
  delaySeconds: number;
  hourlyLimit?: number;
}
