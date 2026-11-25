import {
  draftTextStyle,
  templateDownloadHref,
  templateImageSources,
} from './draftExport';

test('templateImageSources prefers the public file view and resolves relative URLs', () => {
  expect(templateImageSources({
    file: {
      id: 44,
      viewUrl: '/testfiles/abc/',
      cachedViewUrl: 'https://cdn.example/template.png',
    },
  }, 'http://127.0.0.1:5000/v6/')).toEqual([
    'http://127.0.0.1:5000/v6/public-files/44/view/',
    'http://127.0.0.1:5000/testfiles/abc/',
    'https://cdn.example/template.png',
  ]);
});

test('templateDownloadHref uses a stable public download link', () => {
  expect(templateDownloadHref({
    file: {
      id: 44,
      viewUrl: '/testfiles/abc/',
      downloadUrl: 'https://bucket.s3.amazonaws.com/file?X-Amz-Expires=604800',
    },
  }, 'http://127.0.0.1:5000/v6/')).toBe(
    'http://127.0.0.1:5000/v6/public-files/44/download/',
  );
});

test('templateDownloadHref keeps a direct download URL when the file has no id', () => {
  expect(templateDownloadHref({
    file: {
      viewUrl: '/testfiles/abc/',
      downloadUrl: '/files/44/download/',
    },
  }, 'http://127.0.0.1:5000/v6/')).toBe('http://127.0.0.1:5000/files/44/download/');
});

test('templateDownloadHref falls back to the public view when nothing else is available', () => {
  expect(templateDownloadHref({
    file: { viewUrl: '/testfiles/abc/' },
  }, 'http://127.0.0.1:5000/v6/')).toBe('http://127.0.0.1:5000/testfiles/abc/');
});

test('draft export keeps explicit line breaks and uses the designer defaults', () => {
  expect(draftTextStyle({
    id: 'text',
    type: 'text',
    x: 0,
    y: 0,
    width: 100,
    height: 50,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    text: 'Outside\nSecond line',
  })).toMatchObject({
    text: 'Outside\nSecond line',
    align: 'left',
    verticalAlign: 'middle',
    wrap: 'none',
  });
});
