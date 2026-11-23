interface QuotedGroup {
  quantity: number;
  groupCost?: number;
  variations?: { cost?: number }[];
}

export function quotedGroupUnitPrice(
  group: QuotedGroup,
  job: { costPerUnit?: number; variationsGroups: QuotedGroup[] },
  product: { setupPerGroup?: boolean; setupPrice?: number },
) {
  if (job.variationsGroups.length === 1) return job.costPerUnit;
  if (!group.quantity || group.groupCost == null || !group.variations ||
      group.variations.some(variation => variation.cost == null)) return undefined;

  // The server includes all option charges and any per-group setup fee in groupCost.
  const optionCharges = group.variations.reduce((sum, variation) => sum + Number(variation.cost), 0);
  const setup = product?.setupPerGroup ? Number(product.setupPrice) || 0 : 0;
  return (group.groupCost - optionCharges - setup) / group.quantity;
}
