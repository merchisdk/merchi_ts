import { CartItem } from './cart_item.js';
import { Entity } from '../entity.js';
import { MerchiFile } from './file.js';
import { Job } from './job.js';
import { VariationField } from './variation_field.js';
import { VariationOption } from './variation_option.js';
import { VariationsGroup } from './variations_group.js';

/** Appearance of a text box the customer added in the designer. */
export interface DesignerTextStyle {
  colour?: string;
  textSize?: number;
  font?: string;
  align?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
}

/**
 * Runtime type tag only. The API returns `textStyle` as JSON; the entity
 * layer refuses `Object` from decorator metadata.
 */
const textStylePropertyType = class {};

export class Variation extends Entity {
  protected static resourceName = 'variations';
  protected static singularName = 'variation';
  protected static pluralName = 'variations';

  @Variation.property({type: Date})
  public archived?: Date | null;

  @Variation.property()
  public id?: number;

  @Variation.property({type: String})
  public value?: string | null;

  // Catalog variations leave this empty. Set for a text box added in the
  // designer: colour, size, font, alignment, and placement.
  @Variation.property({type: textStylePropertyType})
  public textStyle?: DesignerTextStyle | null;

  @Variation.property()
  public currency?: string;

  @Variation.property()
  public cost?: number;

  @Variation.property()
  public quantity?: number;

  @Variation.property()
  public onceOffCost?: number;

  @Variation.property()
  public unitCost?: number;

  @Variation.property()
  public unitCostTotal?: number;

  @Variation.property()
  public isVisible?: boolean;

  @Variation.property()
  public variationField?: VariationField;

  @Variation.property({type: VariationsGroup})
  public variationsGroup?: VariationsGroup | null;

  @Variation.property({type: Job})
  public job?: Job | null;

  @Variation.property({type: CartItem})
  public cartItem?: CartItem | null;

  @Variation.property({arrayType: 'MerchiFile'})
  public variationFiles?: MerchiFile[];

  @Variation.property({arrayType: 'VariationOption'})
  public selectedOptions?: VariationOption[];

  @Variation.property({arrayType: 'VariationOption'})
  public selectableOptions?: VariationOption[];
}
