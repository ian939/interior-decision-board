import { z } from "zod";

export const cardStatuses = [
  "decision_needed",
  "reviewing",
  "supplement",
  "approved",
  "requested",
  "dropped",
] as const;

export const cardStatusSchema = z.enum(cardStatuses);
export type CardStatus = z.infer<typeof cardStatusSchema>;

export const statusDefinitions: ReadonlyArray<{
  id: CardStatus;
  label: string;
  description: string;
  color: string;
}> = [
  { id: "decision_needed", label: "결정 필요", description: "새로 도착한 자료", color: "ochre" },
  { id: "reviewing", label: "확인 중", description: "공간을 정하고 검토 중", color: "blue" },
  { id: "supplement", label: "보완", description: "추가 자료와 비교 필요", color: "violet" },
  { id: "approved", label: "승인", description: "한 사람이 채택한 아이디어", color: "green" },
  { id: "requested", label: "반영 요청", description: "실제 작업 요청 목록", color: "terracotta" },
  { id: "dropped", label: "드롭", description: "이번 공사에서는 제외", color: "gray" },
];

export const sourceTypes = ["youtube", "reels", "blog", "shopping", "web", "image", "file", "other"] as const;
export const sourceTypeSchema = z.enum(sourceTypes);
export type SourceType = z.infer<typeof sourceTypeSchema>;

export const sourceTypeLabels: Record<SourceType, string> = {
  youtube: "YouTube",
  reels: "Instagram/Reels",
  blog: "블로그",
  shopping: "쇼핑/제품",
  web: "웹",
  image: "이미지",
  file: "파일",
  other: "기타",
};

export const preferenceValues = ["like", "dislike", "hold"] as const;
export const preferenceSchema = z.enum(preferenceValues);
export type PreferenceValue = z.infer<typeof preferenceSchema>;

export const topicOptions = [
  "구조/동선",
  "마감재",
  "가구",
  "조명",
  "수납",
  "가전",
  "색상",
  "욕실 설비",
  "주방 설비",
  "예산",
  "시공 디테일",
  "기타",
] as const;

export interface UserSummary {
  id: string;
  name: string;
  role: "owner" | "partner";
}

export interface Space {
  id: string;
  name: string;
  sortOrder: number;
  active: boolean;
  isUnassigned: boolean;
}

export interface Attachment {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  kind: "source" | "thumbnail" | "supplement";
  url: string;
  createdAt: string;
}

export interface Comment {
  id: string;
  body: string;
  author: UserSummary;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityLog {
  id: string;
  action: string;
  detail: string | null;
  actor: UserSummary | null;
  createdAt: string;
}

export interface RelatedSource {
  id: string;
  url: string | null;
  title: string;
  summary: string | null;
  sourceType: SourceType;
  aiStatus: "queued" | "processing" | "ready" | "failed" | "manual";
  thumbnailUrl: string | null;
  createdAt: string;
}

export interface Comparison {
  id: string;
  content: string;
  createdAt: string;
}

export interface WorkRequest {
  id: string;
  cardId: string;
  title: string;
  body: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
  spaces: Space[];
  sourceUrl: string | null;
  thumbnailUrl: string | null;
}

export interface CardSummary {
  id: string;
  title: string;
  summary: string | null;
  status: CardStatus;
  sourceUrl: string | null;
  sourceType: SourceType;
  sourceChannel: "web" | "telegram";
  thumbnailUrl: string | null;
  metadataQuality: "full" | "partial" | "unavailable" | null;
  aiStatus: "queued" | "processing" | "ready" | "failed" | "manual";
  aiError: string | null;
  topicTags: string[];
  spaces: Space[];
  createdBy: UserSummary;
  approvedBy: UserSummary | null;
  preferences: Partial<Record<string, PreferenceValue>>;
  commentCount: number;
  relatedSourceCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CardDetail extends CardSummary {
  sourceNote: string | null;
  supplementRequest: string | null;
  droppedReason: string | null;
  approvalReason: string | null;
  approvedAt: string | null;
  attachments: Attachment[];
  comments: Comment[];
  activities: ActivityLog[];
  relatedSources: RelatedSource[];
  comparison: Comparison | null;
  workRequest: WorkRequest | null;
}

export interface DashboardResponse {
  cards: CardSummary[];
  spaces: Space[];
  users: UserSummary[];
  counts: Record<CardStatus, number>;
}

export interface SessionResponse {
  token: string;
  user: UserSummary;
  expiresAt: string;
}

export const transitionInputSchema = z.object({
  status: cardStatusSchema,
  spaceIds: z.array(z.string()).optional(),
  reason: z.string().trim().max(2000).optional(),
  workRequestTitle: z.string().trim().max(200).optional(),
  workRequestBody: z.string().trim().max(5000).optional(),
});

export type TransitionInput = z.infer<typeof transitionInputSchema>;

export const allowedTransitions: Record<CardStatus, readonly CardStatus[]> = {
  decision_needed: ["reviewing", "dropped"],
  reviewing: ["supplement", "approved", "dropped"],
  supplement: ["reviewing", "approved", "dropped"],
  approved: ["reviewing", "requested", "dropped"],
  requested: ["approved"],
  dropped: ["decision_needed", "reviewing"],
};

export function canTransition(from: CardStatus, to: CardStatus): boolean {
  return from === to || allowedTransitions[from].includes(to);
}

export function statusLabel(status: CardStatus): string {
  return statusDefinitions.find((definition) => definition.id === status)?.label ?? status;
}
