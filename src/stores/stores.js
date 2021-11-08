import { writable } from 'svelte/store';

export const scroll = writable({
  previousTop: 0,
  previousPath: '',
  currentTop: 0,
  currentPath: '',
});