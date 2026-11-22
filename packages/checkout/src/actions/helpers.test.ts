import { encodeMerchiApiData } from './helpers';

test('encodeMerchiApiData sends variation textStyle as one JSON value', () => {
  const textStyle = {
    colour: '#112233',
    textSize: 56,
    font: 'Oswald',
    align: 'center',
    x: 12,
    y: 20,
    width: 240,
    height: 64,
    rotation: 9,
    scaleX: 1.1,
    scaleY: 0.7,
  };
  const data = encodeMerchiApiData({
    variations: [{ value: 'Team night', textStyle }],
    designInputs: [{
      kind: 'text',
      name: 'Team night',
      value: 'Team night',
      textStyle,
    }],
  });

  const saved = {
    colour: '#112233',
    textSize: 56,
    font: 'Oswald',
    align: 'center',
    x: 12,
    y: 20,
    width: 240,
    height: 64,
    rotation: 9,
    scaleX: 1.1,
    scaleY: 0.7,
  };
  expect(data.get('variations-0-value')).toBe('Team night');
  expect(JSON.parse(String(data.get('variations-0-textStyle')))).toEqual(saved);
  expect(data.get('variations-0-textStyle-0-colour')).toBeNull();
  expect(data.get('designInputs-0-kind')).toBe('text');
  expect(data.get('designInputs-0-value')).toBe('Team night');
  expect(JSON.parse(String(data.get('designInputs-0-textStyle')))).toEqual(saved);
  expect(data.get('designInputs-0-textStyle-0-colour')).toBeNull();
});
