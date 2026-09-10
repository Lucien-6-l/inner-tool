// 时间线功能 API 封装
import { request } from './api';

export interface TimelineUser {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string | null;
  bio?: string | null;
}

export interface Timeline {
  id: string;
  name: string;
  description: string | null;
  creatorId: string;
  creator: TimelineUser;
  status: string;
  createdAt: string;
  participants?: { user: TimelineUser; joinedAt: string }[];
  branches?: TimelineBranch[];
  _count?: { participants: number; branches: number; mergeRequests: number };
}

export interface TimelineBranch {
  id: string;
  timelineId: string;
  ownerId: string | null;
  owner?: TimelineUser | null;
  isMain: boolean;
  createdAt: string;
  files?: TimelineFile[];
  _count?: { files: number };
}

export interface TimelineFile {
  id: string;
  branchId: string;
  filename: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  version: number;
  uploadedById: string;
  uploadedBy?: TimelineUser;
  uploadedAt: string;
  isConflict?: boolean;
  mainVersion?: number | null;
}

export interface MergeRequestVote {
  id: string;
  voterId: string;
  voter: TimelineUser;
  vote: 'approve' | 'reject' | 'abstain';
  comment: string | null;
  createdAt: string;
}

export interface MergeRequestComment {
  id: string;
  userId: string;
  user: TimelineUser;
  content: string;
  createdAt: string;
}

export interface MergeRequest {
  id: string;
  timelineId: string;
  sourceBranchId: string;
  sourceBranch?: TimelineBranch;
  title: string;
  description: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'merged';
  createdById: string;
  createdBy?: TimelineUser;
  createdAt: string;
  mergedAt: string | null;
  resubmitCount: number;
  votes?: MergeRequestVote[];
  comments?: MergeRequestComment[];
  _count?: { votes: number; comments: number };
  files?: TimelineFile[];
  participantCount?: number;
  requiredApprovals?: number;
  approveCount?: number;
  rejectCount?: number;
  canMerge?: boolean;
}

export interface TimelineActivity {
  id: string;
  timelineId: string;
  branchId: string | null;
  userId: string;
  user: TimelineUser;
  actionType: string;
  detail: string | null;
  createdAt: string;
}

// ===== 时间线 =====
export const getTimelines = () => request<{ list: Timeline[] }>('/api/timelines');
export const createTimeline = (data: { name: string; description?: string; participantIds?: string[] }) =>
  request<{ id: string }>('/api/timelines', { method: 'POST', body: JSON.stringify(data) });
export const getTimeline = (id: string) => request<Timeline>(`/api/timelines/${id}`);
export const addParticipants = (id: string, userIds: string[]) =>
  request<{ addedCount: number }>(`/api/timelines/${id}/participants`, { method: 'POST', body: JSON.stringify({ userIds }) });
export const removeParticipant = (id: string, userId: string) =>
  request(`/api/timelines/${id}/participants/${userId}`, { method: 'DELETE' });

// ===== 分支与文件 =====
export const getMyBranch = (timelineId: string) => request<TimelineBranch>(`/api/timelines/${timelineId}/my-branch`);
export const getBranchFiles = (branchId: string) =>
  request<{ files: TimelineFile[]; totalVersions: number }>(`/api/timelines/branches/${branchId}/files`);
export const uploadBranchFile = (timelineId: string, file: File) => {
  const form = new FormData();
  form.append('file', file);
  return request<TimelineFile>(`/api/timelines/${timelineId}/my-branch/files`, { method: 'POST', body: form, form: true });
};
export const deleteBranchFile = (branchId: string, fileId: string) =>
  request(`/api/timelines/branches/${branchId}/files/${fileId}`, { method: 'DELETE' });

// ===== 活动记录 =====
export const getTimelineActivity = (id: string) =>
  request<{ list: TimelineActivity[] }>(`/api/timelines/${id}/activity`);

// ===== 汇入请求 =====
export const getMergeRequests = (timelineId: string) =>
  request<{ list: MergeRequest[]; participantCount: number; requiredApprovals: number }>(`/api/timelines/${timelineId}/merge-requests`);
export const createMergeRequest = (timelineId: string, data: { title: string; description?: string }) =>
  request<{ id: string }>(`/api/timelines/${timelineId}/merge-requests`, { method: 'POST', body: JSON.stringify(data) });
export const getMergeRequest = (id: string) => request<MergeRequest>(`/api/merge-requests/${id}`);
export const voteMergeRequest = (id: string, vote: 'approve' | 'reject' | 'abstain', comment?: string) =>
  request<{ status: string; approveCount: number; threshold: number }>(`/api/merge-requests/${id}/vote`, {
    method: 'POST',
    body: JSON.stringify({ vote, comment }),
  });
export const commentMergeRequest = (id: string, content: string) =>
  request<{ id: string }>(`/api/merge-requests/${id}/comments`, { method: 'POST', body: JSON.stringify({ content }) });
export const mergeMergeRequest = (id: string) =>
  request<{ mergedCount: number }>(`/api/merge-requests/${id}/merge`, { method: 'POST' });
export const resubmitMergeRequest = (id: string, data?: { title?: string; description?: string }) =>
  request(`/api/merge-requests/${id}/resubmit`, { method: 'POST', body: JSON.stringify(data || {}) });
