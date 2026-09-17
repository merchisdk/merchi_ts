import {
  FieldType,
  MerchiFile,
  Product,
  Variation,
  VariationField,
  VariationFieldsOption,
  DraftTemplate,
  DraftTemplateData,
} from '../types';

// Add a UUID generator for unique IDs
export const generateUniqueId = () => {
  return 'canvas-obj-' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
};

export function findTemplatesSelectedByVarations(draftTemplates: DraftTemplate[], variations: Variation[]) {
  // filter all the selected variation values
  const selectedVarationValues: string[] = variations
    .filter((v: Variation) => v.value !== undefined && v.value !== null && v.value !== '')
    .map((v: Variation) => String(v.value));

  // return all the draft templates that have a selectedByVariationFieldOptions that includes
  // any of the selected variation values
  return draftTemplates.filter((template: DraftTemplate) => {
    if (!template?.selectedByVariationFieldOptions) {
      return false;
    }
    return !!template.selectedByVariationFieldOptions?.find(
      (o: VariationFieldsOption) => selectedVarationValues.includes(String(o.id))
    );
  });
}

export function filterVariationsByTemplate(variations: Variation[], template: DraftTemplate) {
  // filter the variations by the template and only return the variations which edit the template
  // we will use these variations to add canvas objects to the canvas
  const editFieldIds = template.editedByVariationFields?.map((field: VariationField) => field.id);
  return variations.filter(
    (v: Variation) => editFieldIds?.includes(v.variationField?.id)
  );
}

export function buildVariationFieldCanvasObject(variation: Variation) {
  // takes a variation and returns an associated canvas object to redner
  const { value, variationField, variationFiles = [] } = variation;
  const { fieldType = FieldType.TEXT_INPUT, id } = variationField || {};
  if ([FieldType.TEXT_INPUT, FieldType.TEXT_AREA, FieldType.NUMBER_INPUT].includes(fieldType)) {
    // if value is null or empty, do not create a text object
    if (value === null || value === undefined || value === '') {
      return {
        fieldId: id,
        value: null,
        uniqueId: generateUniqueId()
      };
    }
    // Used to add a text to the canvas
    return [{
      canvasObjectType: 'text',
      value,
      fieldId: id,
      text: value,
      fontSize: 24,
      fontFamily: 'Nunito',
      uniqueId: generateUniqueId(),
    }];
  }
  if (fieldType === FieldType.FILE_UPLOAD) {
    // Used to add an image to the canvas
    return variationFiles.map((file: MerchiFile) => ({
      canvasObjectType: 'image',
      fieldId: id,
      fileId: file.id,
      value,
      file: file,
      uniqueId: generateUniqueId(),
    }));
  }
  if ([FieldType.COLOUR_PICKER, FieldType.COLOUR_SELECT].includes(fieldType)) {
    // Used to add a colour to the canvas
    return [{
      canvasObjectType: 'colour',
      fieldId: id,
      value,
      colour: value,
      uniqueId: generateUniqueId(),
    }];
  }
  return [{
    fieldId: id,
    value,
    uniqueId: generateUniqueId(),
  }];
}

export function canvasTemplateVariationObjects(variations: Variation[], template: DraftTemplate) {
  // takes a list of variations and a template and returns a list of canvas objects to render
  const templateVariations = filterVariationsByTemplate(variations, template);

  return templateVariations
    .flatMap((v: Variation) => buildVariationFieldCanvasObject(v))
    .filter((obj: any) => obj.canvasObjectType);
}

export function initDraftTemplates(variations: Variation[], product: Product): DraftTemplateData[] {
  const { draftTemplates = [] } = product;

  // Check for any templates that are selected by the variation options
  const templates = findTemplatesSelectedByVarations(draftTemplates, variations) || [];

  // If there are no templates selected, return the draft templates
  const useTemplates = templates.length ? templates : draftTemplates;

  return useTemplates.map((template: DraftTemplate) => {
    // find the variations which edit the template
    const templateVariations = filterVariationsByTemplate(variations, template);
    // build the canvas objects for the template
    const variationObjects = canvasTemplateVariationObjects(templateVariations, template);
    return {
      template,
      variationFieldIds: templateVariations
        .map((v: Variation) => v.variationField?.id)
        .filter(Boolean)
        .map(id => Number(id)),
      variationObjects,
    };
  });
}
