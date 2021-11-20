import { readable } from "svelte/store";

const fetchIndex = async (collection) => {
  const response = await fetch(`collections/${collection}/index.json`);
  const data = await response.json();
  return data;
};

export interface Zen {
  readonly id: string;
  readonly published: string;
  readonly title: string;
  readonly text: string;
}
export const zen = readable([], function (set) {
  fetchIndex('zen').then((data) => {
    const today = new Date();
    set(data.filter((item: Zen) => {
      const published = new Date(item.published);
      return published.getTime() <= today.getTime();
    }));
  });
  return () => {};
});

export interface DadJoke {
  readonly id: string;
  readonly published: string;
  readonly title: string;
  readonly youtube: string;
  readonly setup: string;
  readonly punchline: string;
}
export const dadJokes = readable([], function (set) {
  fetchIndex('dad-jokes').then((data) => {
    const today = new Date();
    set(data.filter((item: DadJoke) => {
      const published = new Date(item.published);
      return published.getTime() <= today.getTime();
    }));
  });
  return () => {};
});

export interface Blog {
  readonly id: string;
  readonly published: string;
  readonly title: string;
  readonly author: string;
  readonly tags: string[];
  readonly text: string;
}
export const blog = readable([], function (set) {
  fetchIndex('blog').then((data) => {
    const today = new Date();
    set(data.filter((item: Blog) => {
      const published = new Date(item.published);
      return published.getTime() <= today.getTime();
    }));
  });
  return () => {};
});

export interface Recipe {
  readonly id: string;
  readonly published: string;
  readonly title: string;
  readonly author: string;
  readonly tags: string[];
  readonly text: string;
}
export const recipes = readable([], function (set) {
  fetchIndex('recipes').then((data) => {
    const today = new Date();
    set(data.filter((item: Recipe) => {
      const published = new Date(item.published);
      return published.getTime() <= today.getTime();
    }));
  });
  return () => {};
});