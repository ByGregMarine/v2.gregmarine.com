<script lang="ts">
  import { fade } from "svelte/transition";
  import {
    pageTitle,
    collectionName,
    documentName,
  } from "../stores/stores.js";

  pageTitle.set("Not Found");
  collectionName.set("");
  documentName.set("");
</script>

<div class="container mx-auto flex flex-wrap pt-4 pb-12" in:fade>
  <div class="w-full mb-4">
    <div class="h-1 mx-auto gradient w-64 opacity-25 my-0 py-0 rounded-t" />
  </div>
  <h2
    class="w-full my-2 text-xl lg:text-2xl font-bold leading-tight text-center"
    in:fade
  >
    Well, this is embarrassing! We can't find the page you're looking for!
  </h2>
</div>