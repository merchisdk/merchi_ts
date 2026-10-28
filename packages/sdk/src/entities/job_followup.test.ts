import { NotificationType } from '../constants/notification_types.js';
import { JobFollowupType } from '../constants/job_followup_types.js';
import { Merchi } from '../merchi.js';

test('job follow-up notification type is 109', () => {
  expect(NotificationType.JOB_FOLLOWUP).toBe(109);
});

test('can make a follow-up template', () => {
  const merchi = new Merchi();
  const template = new merchi.JobFollowupTemplate();
  template.fromJson({
    id: 11,
    name: 'Completion',
    followupType: JobFollowupType.COMPLETION,
    defaultKey: 'completion',
    subject: 'Your order is complete',
    body: 'Hi {{client_first_name}}',
  });
  expect(template.name).toBe('Completion');
  expect(template.followupType).toBe(0);
  expect(template.defaultKey).toBe('completion');
});

test('job complete posts the follow-up sequence', async () => {
  const merchi = new Merchi();
  const job = new merchi.Job();
  job.id = 85;
  const fetch = jest.spyOn(merchi, 'authenticatedFetch').mockResolvedValue({
    jobFollowups: [{
      id: 4,
      jobId: 85,
      templateId: 11,
      templateName: 'Review request',
      followupType: JobFollowupType.REVIEW_REQUEST,
      subject: 'How did we do?',
      sendAt: '2026-11-04T09:00:00Z',
      sendEmail: true,
      sendSms: false,
      status: 'pending',
      sentAt: null,
    }],
  });

  const rows = await job.complete([{
    templateId: 11,
    sendAt: '2026-11-04T09:00',
    timezone: 'Australia/Melbourne',
    sendEmail: true,
    sendSms: false,
  }]);

  expect(fetch).toHaveBeenCalledWith(
    '/jobs/85/complete/',
    expect.objectContaining({method: 'POST'})
  );
  const body = fetch.mock.calls[0][1].body as FormData;
  expect(JSON.parse(String(body.get('followups')))).toEqual([{
    templateId: 11,
    sendAt: '2026-11-04T09:00',
    timezone: 'Australia/Melbourne',
    sendEmail: true,
    sendSms: false,
  }]);
  expect(rows).toHaveLength(1);
  expect(rows[0].sendAt).toBe('2026-11-04T09:00:00Z');
  expect(rows[0].status).toBe('pending');
  expect(rows[0].templateName).toBe('Review request');
});

test('can update and cancel a pending follow-up', async () => {
  const merchi = new Merchi();
  const job = new merchi.Job();
  job.id = 85;
  const fetch = jest.spyOn(merchi, 'authenticatedFetch').mockResolvedValue({
    jobFollowup: {
      id: 4,
      status: 'cancelled',
      sendAt: '2026-12-01T09:00:00Z',
    },
  });

  const updated = await job.updateFollowup(4, {
    sendAt: '2026-12-01T09:00',
    timezone: 'Australia/Melbourne',
  });
  expect(fetch).toHaveBeenCalledWith(
    '/jobs/85/followups/4/',
    expect.objectContaining({method: 'PATCH'})
  );
  expect(updated.sendAt).toBe('2026-12-01T09:00:00Z');

  const cancelled = await job.cancelFollowup(4);
  expect(fetch).toHaveBeenCalledWith(
    '/jobs/85/followups/4/cancel/',
    expect.objectContaining({method: 'POST'})
  );
  expect(cancelled.status).toBe('cancelled');
});
