import { derived, writable } from "svelte/store";

export const collection = writable("");
export const document = writable("");

export const title = derived(
  [collection, document],
  ([$collection, $document]) => {
    if($document !== "") {
      return `${$collection} - ${$document}`;
    } else {
      return $collection;
    }
  }
);