import { Merchi } from '@merchi/sdk';

export function makeJob(
  jobJson: any, makeDirty?: boolean, arrayValueStrict?: boolean
) {
  const merchi = new Merchi();
  const job = new merchi.Job();

  return job.fromJson(
    jobJson,
    {makeDirty: !!makeDirty, arrayValueStrict: !!arrayValueStrict}
  );
}
