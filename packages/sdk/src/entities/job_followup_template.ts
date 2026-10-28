import type { Domain } from './domain.js';
import { Entity } from '../entity.js';
import type { User } from './user.js';

export class JobFollowupTemplate extends Entity {
  protected static resourceName = 'job_followup_templates';
  protected static singularName = 'jobFollowupTemplate';
  protected static pluralName = 'jobFollowupTemplates';

  @JobFollowupTemplate.property({type: Date})
  public archived?: Date | null;

  @JobFollowupTemplate.property()
  public id?: number;

  @JobFollowupTemplate.property()
  public name?: string;

  @JobFollowupTemplate.property()
  public followupType?: number;

  @JobFollowupTemplate.property({type: String})
  public defaultKey?: string | null;

  @JobFollowupTemplate.property()
  public subject?: string;

  @JobFollowupTemplate.property()
  public body?: string;

  @JobFollowupTemplate.property({type: Date})
  public created?: Date;

  @JobFollowupTemplate.property({type: Date})
  public updated?: Date;

  @JobFollowupTemplate.property({type: Date})
  public removed?: Date | null;

  @JobFollowupTemplate.property({type: 'Domain'})
  public domain?: Domain;

  @JobFollowupTemplate.property({type: 'User'})
  public createdBy?: User;
}
