import { writable } from "svelte/store";

export const previousScrollTop = writable(0);
export const currentScrollTop = writable(0);
export const previousPath = writable("");
export const currentPath = writable("");