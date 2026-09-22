export { SDK_VERSION, getProductFormSdkVersion } from './version.js';

export type { OptionJson, VariationFieldJson, VariationJson, VariationsGroupJson }
  from './types/variation.js';
export type { ProductJson } from './types/product.js';
export type { JobJson, QuoteFields } from './types/job.js';
export type { ProductFormProps, ProductFormComponent } from './types/form.js';

export { serializeJob, nonEmptyGroups } from './helpers/serialize.js';
export { formatCurrency, urlFor } from './helpers/format.js';
export {
  productHasGroups,
  groupFieldsOf,
  independentFieldsOf,
  isOptionQuantityGridProduct,
} from './helpers/product.js';
export {
  buildProductFormJob,
  jobToFormState,
  selectionsToVariations,
} from './helpers/buildJob.js';
export type {
  GroupRow,
  HydratedProductFormState,
  ProductFormJobState,
} from './helpers/buildJob.js';
export {
  OPTION_FIELD_TYPES,
  COLOUR_EXTRACT,
  FILE_FIELD_TYPES,
  AREA,
} from './helpers/constants.js';

export { createPricing } from './runtime/pricing.js';
export type { Pricing } from './runtime/pricing.js';
export { createProductFormRuntime } from './runtime/runtime.js';
export type {
  Actions,
  Helpers,
  ProductFormRuntime,
  ProductFormRuntimeConfig,
} from './runtime/runtime.js';

// UI component kit — the building blocks AI-built forms compose. Form authors
// import these from '@merchi/product-form-sdk' (the static gate allowlists it).
export {
  Section,
  Stack,
  Card,
  Heading,
  Text,
  Divider,
  Field,
  GroupRows,
  OptionQuantityGrid,
  ProductFormProvider,
  ProductFormShell,
  ProductFormActions,
  useProductForm,
  theme,
} from './components/index.js';
export type {
  ProductFormContextValue,
  ProductFormProviderProps,
  FieldSelection,
  SubmitAction,
  FooterAction,
} from './components/index.js';
