export const INTERNAL_STATUSES = {
  give_attention: { label: "Give Attention", color: "bg-red-500/10 text-red-500 border-red-500/20" },
  attention_given: { label: "Attention Given", color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" },
  feedback_received: { label: "Feedback Received", color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" }
} as const;

export type InternalStatus = keyof typeof INTERNAL_STATUSES;
