# Merchi Product Editor

A React-based product editor component that allows users to edit product templates using Fabric.js. This library enables customization of product designs through variations, template switching, and canvas manipulation.

## Features

- **Multiple Template Support**: Select and switch between different draft templates
- **Variation Management**: Update canvas objects based on product variations
- **Responsive Design**: Works on both desktop and mobile devices
- **Canvas Customization**: Grid toggle, image upload
- **Context-based Architecture**: Uses React Context API for state management
- **Type-safe**: Written in TypeScript with proper type definitions

## Installation

```bash
npm install merchi_product_editor
```

## Usage

### Basic Example

```jsx
import { ProductEditor } from 'merchi_product_editor';

function App() {
  const product = {
    id: 1,
    name: "Sample Product",
    draftTemplates: [
      {
        id: 1,
        name: "Template 1",
        file: {
          viewUrl: "https://example.com/template1.jpg"
        },
        width: 800,
        height: 600
      }
    ]
  };

  const variations = [
    {
      variationField: {
        id: 1,
        fieldType: "TEXT_INPUT"
      },
      value: "Sample Text"
    }
  ];

  const handleSave = () => {
    // Handle save action
    console.log('Saved product design');
  };

  const handleCancel = () => {
    // Handle cancel action
    console.log('Editing cancelled');
  };

  return (
    <ProductEditor
      product={product}
      job={{id: 1}}
      width={800}
      height={600}
      onSave={handleSave}
      onCancel={handleCancel}
      variations={variations}
      groupVariations={[]}
    />
  );
}
```

### Using the Context API

You can access the editor's context in child components:

```jsx
import { useProductEditor } from 'merchi_product_editor';

function CustomButton() {
  const { handleSave, updateCanvasFromVariations } = useProductEditor();
  
  const handleUpdate = () => {
    const newVariations = [/* updated variations */];
    updateCanvasFromVariations(newVariations);
  };

  return (
    <button onClick={handleUpdate}>Update Design</button>
  );
}
```

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| product | Product | Yes | - | Merchi Product entity containing draft templates |
| job | Job | Yes | - | Job information |
| width | number | No | 800 | Width of the editor canvas |
| height | number | No | 600 | Height of the editor canvas |
| onSave | () => void | Yes | - | Callback function when saving the edited image |
| onCancel | () => void | Yes | - | Callback function when canceling the edit |
| variations | Variation[] | Yes | [] | Array of variations to apply to the templates |
| groupVariations | Variation[] | Yes | [] | Array of group variations to apply |
| fontOptions | FontOption[] | No | Default list | Custom fonts for text toolbar |
| colorPalette | (string \| null)[][] | No | Default palette | Custom color palette for text toolbar |

## Context API

The `useProductEditor` hook provides access to the following properties and methods:

| Property/Method | Type | Description |
|----------------|------|-------------|
| canvas | fabric.Canvas | The Fabric.js canvas instance |
| draftTemplates | Array | Available draft templates with associated variation objects |
| selectedTemplate | number | ID of the currently selected template |
| handleTemplateChange | Function | Method to switch between templates |
| showGrid | boolean | Whether the grid is currently displayed |
| setShowGrid | Function | Toggle grid visibility |
| showPreview | boolean | Whether the preview area is displayed |
| togglePreview | Function | Toggle preview area visibility |
| canvasObjects | Map | Map of canvas objects indexed by variation field ID |
| updateCanvasFromVariations | Function | Update canvas objects based on changed variations |

## ImageGallery Component

The `ImageGallery` component provides a simple way to display images in your product editor when other images fail to load.

```jsx
import { ImageGallery } from 'merchi_product_editor';

function Example() {
  return (
    <ImageGallery 
      fallbackImageUrl="https://example.com/default-image.jpg"
    />
  );
}
```

### Props for ImageGallery

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| fallbackImageUrl | string | No | null | URL to an image that will be displayed when the primary image fails to load |

The ImageGallery component is designed to be simple and focused on providing fallback functionality for image loading errors.

## Development

```bash
# Install dependencies
npm install

# Start development server
npm start

# Build the library
npm run build

# Run tests
npm test
```

## License

MIT 
