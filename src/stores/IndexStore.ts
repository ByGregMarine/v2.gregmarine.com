import { readable } from "svelte/store";

const fetchIndex = async (collection) => {
  const response = await fetch(`collections/${collection}/index.json`);
  const data = await response.json();
  return data;
};

export const zen = readable([], function (set) {
  fetchIndex('zen').then((data) => set(data));
  return () => {};
});

export const dadJokes = readable([], function (set) {
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