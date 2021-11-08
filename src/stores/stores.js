import { readable, writable } from 'svelte/store';

export const pageTitle = writable('Home');
export const collectionName = writable('');
export const documentName = writable('');

export const scroll = writable({
  previousTop: 0,
  previousPath: '',
  currentTop: 0,
  currentPath: '',
});

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
  fetchIndex('dad-jokes').then((data) => set(data));
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