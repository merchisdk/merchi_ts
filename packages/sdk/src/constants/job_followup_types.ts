export enum JobFollowupType {
  COMPLETION = 0,
  REVIEW_REQUEST = 1,
  REORDER = 2,
  FEEDBACK = 3,
  CUSTOM = 4,
}

export type JobFollowupStatus = 'pending' | 'sent' | 'cancelled' | 'failed';
