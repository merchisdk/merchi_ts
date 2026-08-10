export { SDK_VERSION, getProductFormSdkVersion } from './version';

export type { OptionJson, VariationFieldJson, VariationJson, VariationsGroupJson }
  from './types/variation';
export type { ProductJson } from './types/product';
export type { JobJson, QuoteFields } from './types/job';
export type { ProductFormProps, ProductFormComponent } from './types/form';

export { serializeJob, nonEmptyGroups } from './helpers/serialize';
export { formatCurrency, urlFor } from './helpers/format';
export {
  productHasGroups,
  groupFieldsOf,
  independentFieldsOf,
  isOptionQuantityGridProduct,
} from './helpers/product';
export {
  buildProductFormJob,
  jobToFormState,
  selectionsToVariations,
} from './helpers/buildJob';
export type {
  GroupRow,
  HydratedProductFormState,
  ProductFormJobState,
} from './helpers/buildJob';
export {
  OPTION_FIELD_TYPES,
  COLOUR_EXTRACT,
  FILE_FIELD_TYPES,
  AREA,
} from './helpers/constants';

export { createPricing } from './runtime/pricing';
export type { Pricing } from './runtime/pricing';
export { createProductFormRuntime } from './runtime/runtime';
export type {
  Actions,
  Helpers,
  ProductFormRuntime,
  ProductFormRuntimeConfig,
} from './runtime/runtime';

// UI component kit — the building blocks AI-built forms compose. Form authors
// import these from 'merchi_sdk_product_form' (the static gate allowlists it).
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
  useProductForm,
  theme,
} from './components';
export type {
  ProductFormContextValue,
  ProductFormProviderProps,
  FieldSelection,
  SubmitAction,
} from './components';
