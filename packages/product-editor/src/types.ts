export enum FieldType {
  TEXT_INPUT = 1,
  SELECT = 2,
  FILE_UPLOAD = 3,
  TEXT_AREA = 4,
  NUMBER_INPUT = 5,
  CHECKBOX = 6,
  RADIO = 7,
  FIELD_INSTRUCTIONS = 8,
  IMAGE_SELECT = 9,
  COLOUR_PICKER = 10,
  COLOUR_SELECT = 11,
}

export interface Draft {
  id?: number;
  // Add other draft properties as needed
}

export interface MerchiFile {
  id?: number;
  uploadId?: string;
  name?: string | null;
  mimetype?: string | null;
  size?: number;
  creationDate?: Date | null;
  cachedViewUrl?: string | null;
  viewUrlExpires?: Date | null;
  cachedDownloadUrl?: string | null;
  downloadUrlExpires?: Date | null;
  viewUrl: string;
  downloadUrl?: string;
  thumbnailUrl?: string;
  previewUrl?: string;
}

export interface DraftTemplate {
  id?: number;
  name?: string;
  description?: string;
  width?: number;
  height?: number;
  file?: MerchiFile;
  product?: Product | null;
  editedByVariationFields?: VariationField[];
  selectedByVariationFieldOptions?: VariationFieldsOption[];
  draftPreviewLayers?: DraftPreviewLayer[];
}

export interface DraftPreview {
  id?: number;
  file?: MerchiFile;
  product?: Product;
  description?: string | null;
  name?: string | null;
  date?: Date | null;
  height?: number;
  width?: number;
  draftPreviewLayers?: DraftPreviewLayer[];
}

export interface DraftPreviewLayer {
  id?: number;
  layerName?: string;
  draftPreview?: DraftPreview;
  draftTemplate?: DraftTemplate;
}

export interface VariationFieldsOption {
  id?: number;
  archived?: Date | null;
  value?: string | null;
  colour?: string | null;
  currency?: string;
  default?: boolean;
  include?: boolean;
  noInventory?: boolean;
  position?: number;
  variationCost?: number;
  variationUnitCost?: number;
  buyUnitCost?: number;
  buyCost?: number;
  variationField?: VariationField | null;
  linkedFile?: MerchiFile | null;
  selectedByVariations?: Variation[];
}

export interface VariationField {
  id?: number;
  archived?: Date | null;
  position?: number;
  required?: boolean;
  independent?: boolean;
  name?: string;
  instructions?: string;
  placeholder?: string | null;
  defaultValue?: string;
  currency?: string;
  fieldType?: FieldType;
  margin?: number;
  variationCost?: number;
  variationUnitCost?: number;
  buyUnitCost?: number;
  buyCost?: number;
  rows?: number;
  fieldMin?: number | null;
  fieldMax?: number | null;
  allowDecimal?: boolean;
  sellerProductEditable?: boolean;
  multipleSelect?: boolean;
  showFilePreview?: boolean;
  allowFileMultiple?: boolean;
  allowFileJpeg?: boolean;
  allowFileGif?: boolean;
  allowFilePdf?: boolean;
  allowFilePng?: boolean;
  allowFileAi?: boolean;
  product?: Product;
  variations?: Variation[];
  options?: VariationFieldsOption[];
}

export interface VariationOption {
  optionId?: number;
  value?: string | null;
  colour?: string | null;
  position?: number;
  available?: boolean;
  default?: boolean;
  include?: boolean;
  linkedFile?: MerchiFile | null;
  fieldName?: string;
  quantity?: number;
  currency?: string;
  onceOffCost?: number;
  unitCost?: number;
  unitCostTotal?: number;
  totalCost?: number;
} 

export interface Variation {
  id?: number;
  archived?: Date | null;
  value?: string | null;
  currency?: string;
  cost?: number;
  quantity?: number;
  onceOffCost?: number;
  unitCost?: number;
  unitCostTotal?: number;
  variationField?: VariationField;
  variationsGroup?: VariationsGroup | null;
  job?: Job | null;
  variationFiles?: MerchiFile[];
  selectedOptions?: VariationOption[];
  selectableOptions?: VariationOption[];
}

export interface VariationsGroup {
  id?: number;
  archived?: Date | null;
  quantity?: number;
  groupCost?: number | null;
  job?: Job | null;
  variations?: Variation[];
  inventoryCount?: number;
  inventorySufficient?: boolean;
}

export interface Product {
  id?: number;
  name?: string;
  description?: string | null;
  draftTemplates?: DraftTemplate[];
  draftPreviews?: DraftPreview[];
  featureImage?: MerchiFile;
  groupVariationFields?: VariationField[];
  independentVariationFields?: VariationField[];
  images?: MerchiFile[];
}

export interface Job {
  id?: number;
  quantity?: number;
  currency?: string;
  jobInfoApprovedByClient?: boolean;
  costPerUnit?: number | null;
  cost?: number | null;
  taxAmount?: number | null;
  totalCost?: number | null;
  drafts?: Draft[];
  sharedDrafts?: Draft[];
  ownDrafts?: Draft[];
  product?: Product;
  variationsGroups?: VariationsGroup[];
  variations?: Variation[];
} 

export interface ProductEditorProps {
  product: Product;
  width?: number;
  height?: number;
  onSave?: (editedImage: string) => void;
  onCancel?: () => void;
  psdTemplateUrl?: string;
}

export interface SavedCanvasObject {
  fieldId: string;
  fileId?: string;
  uniqueId?: string; // Add uniqueId property to the interface
  type: string;
  left: number;
  top: number;
  scaleX: number;
  scaleY: number;
  angle: number;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fill?: string;
  width?: number;
  height?: number;
  src?: string;
  [key: string]: any; // Allow for other properties
}

// New DraftTemplateData type definition that includes all requested properties
export interface DraftTemplateData {
  template: DraftTemplate;
  variationFieldIds: number[]; // List of IDs for all variation fields in this template
  variationObjects: any[];     // Objects associated with the variation fields
}

export interface RenderedDraftPreview {
  templateId: number;
  draft: string; // base64 string of the template artwork as a draft
  canvasPreview: string; // base64 string of the template rendered with the full canvas
}

export interface MappedPreview {
  draftPreview: DraftPreview;
  draftPreviewLayers: {
    layerName: string | undefined;
    renderedLayer: RenderedDraftPreview | null;
  }[];
}
