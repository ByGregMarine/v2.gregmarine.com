import { readable, writable } from 'svelte/store';

export const pageTitle = writable('Home');
export const collectionName = writable('');
export const documentName = writable('');

const fetchIndex = async (collection) => {
  const response = await fetch(`collections/${collection}/index.json`);
  const data = await response.json();
  return data;
};

export const zen = readable([], function (set) {
  fetchIndex('zen').then((data) => set(data));
  return () => {};
});

export const dadjokes = readable([], function (set) {
  fetchIndex('dadjokes').then((data) => set(data));
  return () => {};
});

export const blog = readable([], function (set) {
  fetchIndex('blog').then((data) => set(data));
  return () => {};
});

export const recipes = readable([], function (set) {
  fetchIndex('recipes').then((data) => set(data));
  return () => {};
});