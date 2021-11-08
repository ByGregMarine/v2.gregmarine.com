<script lang="ts">
  import { afterUpdate } from 'svelte';
  import { fade } from "svelte/transition";
  import { link, navigate } from "svelte-routing";
  import {
    dadjokes,
  } from "../stores/stores.js";

  import { collection, document } from "../stores/PageStore";

  export let id: string | null | undefined;

  collection.set("Dad Jokes");
  document.set("");

  type Doc = {
    id: string;
    title: string;
    youtube: string;
    setup: string;
    punchline: string;
  };
  let doc: Doc;

  let docLoaded = false;

  afterUpdate(() => {
    if($dadjokes.length > 0 && !docLoaded) {
      if (id) {
        $dadjokes.find(element => {
          if (element.id === id) {
            document.set(element.title);
            doc = element;
            return true;
          }
        });

        if (!doc) {
          navigate("404");
        }
      } else {
        document.set("");
        doc = null;
      }
      docLoaded = true;
    }
	});
</script>

{#if !id}
  <div class="container mx-auto flex flex-wrap pt-4 pb-12" in:fade>
    <div class="w-full mb-4">
      <div class="h-1 mx-auto gradient w-64 opacity-25 my-0 py-0 rounded-t" />
    </div>
    <h2
      class="w-full my-2 text-xl lg:text-2xl font-bold leading-tight text-center"
      in:fade
    >
      Currated List of Eye Rolling Humor
    </h2>

    {#each $dadjokes as doc}
      <div class="flex md:w-1/2 lg:w-1/3 xl:w-1/4 p-2" in:fade>
        <div class="card bordered shadow-lg image-full">
          <div class="card-body">
            <h2 class="card-title">{doc.title}</h2>
            <p class="w-full text-xl md:text-lg px-6 py-6">
              {doc.setup}
            </p>
            <p class="w-full text-2xl md:text-lg px-6 py-6">
              {doc.punchline}
            </p>
            <div class="card-actions">
              <a class="btn btn-primary" href="/dad-jokes/{doc.id}" use:link>Watch Video</a>
            </div>
          </div>
          <figure class="m-0">
            <img alt={doc.title} src="/collections/dad-jokes/image-01.webp" />
          </figure>
        </div>
      </div>
    {/each}
  </div>
{:else}
  {#if doc}
    <div class="container mx-auto w-full flex flex-col items-center pt-4 pb-12" in:fade>
      <div class="card text-center shadow-2xl sm:w-2/3 md:w-1/2">
        <figure class="m-0 px-10 pt-10 embed-container">
          <iframe
            src="https://www.youtube.com/embed/{doc.youtube}"
            title="YouTube video player"
            frameborder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen
          />
        </figure>
        <div class="card-body">
          <p class="w-full text-xl md:text-lg px-6 py-6">
            {doc.setup}
          </p>
          <p class="w-full text-2xl md:text-lg px-6 py-6">
            {doc.punchline}
          </p>
        </div>
      </div>
    </div>
  {/if}
{/if}

<style>
  .embed-container {
    position: relative;
    padding-bottom: 56.25%;
    height: 0;
    overflow: hidden;
    max-width: 100%;
  }
  .embed-container iframe {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    padding: 1em;
  }
</style>