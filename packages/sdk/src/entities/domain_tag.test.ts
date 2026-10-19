import { Merchi } from '../merchi.js';

test('can make DomainTag', () => {
  const merchi = new Merchi();
  const domainTag = new merchi.DomainTag();
  expect(domainTag).toBeTruthy();
});

test('can set categories', () => {
  const merchi = new Merchi();
  const domainTag = new merchi.DomainTag();
  const category = new merchi.Category();
  category.id = 3;
  domainTag.categories = [category];
  expect(domainTag.categories?.map((item) => item.id)).toEqual([3]);
});
