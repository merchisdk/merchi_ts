import type { Domain } from './domain.js';
import { Entity } from '../entity.js';
import type { Job } from './job.js';
import type { JobFollowupTemplate } from './job_followup_template.js';
import type { JobFollowupStatus } from '../constants/job_followup_types.js';
import type { User } from './user.js';

export interface ScheduledJobFollowup {
  templateId: number;
  sendAt: string;
  timezone: string;
  sendEmail: boolean;
  sendSms: boolean;
  subject?: string;
  body?: string;
}

export interface JobFollowupUpdate {
  sendAt?: string;
  timezone?: string;
  sendEmail?: boolean;
  sendSms?: boolean;
  subject?: string;
  body?: string;
}

export class JobFollowup extends Entity {
  // Scheduled rows are listed and updated under /jobs/<id>/followups/,
  // not this collection path.
  protected static resourceName = 'job_followups';
  protected static singularName = 'jobFollowup';
  protected static pluralName = 'jobFollowups';

  @JobFollowup.property()
  public id?: number;

  @JobFollowup.property()
  public jobId?: number;

  @JobFollowup.property()
  public domainId?: number;

  @JobFollowup.property({type: Number})
  public templateId?: number | null;

  @JobFollowup.property()
  public templateName?: string;

  @JobFollowup.property()
  public followupType?: number;

  @JobFollowup.property()
  public subject?: string;

  @JobFollowup.property()
  public body?: string;

  // The job follow-up endpoints return an ISO timestamp, not unix seconds.
  @JobFollowup.property()
  public sendAt?: string;

  @JobFollowup.property()
  public sendEmail?: boolean;

  @JobFollowup.property()
  public sendSms?: boolean;

  @JobFollowup.property({type: String})
  public status?: JobFollowupStatus;

  @JobFollowup.property({type: String})
  public sentAt?: string | null;

  @JobFollowup.property({type: String})
  public lastError?: string | null;

  @JobFollowup.property({type: Date})
  public created?: Date;

  @JobFollowup.property({type: 'Job'})
  public job?: Job;

  @JobFollowup.property({type: 'Domain'})
  public domain?: Domain;

  @JobFollowup.property({type: 'JobFollowupTemplate'})
  public template?: JobFollowupTemplate;

  @JobFollowup.property({type: 'User'})
  public createdBy?: User;
}
