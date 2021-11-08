<script lang="ts">
  import { afterUpdate } from 'svelte';
  import { fade } from "svelte/transition";
  import { link, navigate } from "svelte-routing";
  import xss from "xss";
  import { Marked } from '@ts-stack/markdown';
  import {
    blog,
  } from "../stores/stores.js";

  import { collection, document } from "../stores/PageStore";

  export let id: string | null | undefined;

  collection.set("Blog");
  document.set("");
  
  let docMD = "";
  const getDocument = async () => {
    const response = await fetch(`/collections/blog/${id}/document.md`);
    if (response.status === 404) {
      navigate("404");
    } else {
      const data = await response.text();
      docMD = Marked.parse(xss(data));
    }
  };

  type Doc = {
    id: string;
    title: string;
    text: string;
  };
  let doc: Doc;

  let docLoaded = false;

  afterUpdate(() => {
    if($blog.length > 0 && !docLoaded) {
      if (id) {
        $blog.find(element => {
          if (element.id === id) {
            document.set(element.title);
            doc = element;
            return true;
          }
        });

        getDocument();
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
      A Collection of My Musings
    </h2>

    {#each $blog as doc}
      <div class="flex md:w-1/2 lg:w-1/3 xl:w-1/4 p-2" in:fade>
        <div class="card bordered shadow-lg">
          <figure class="m-0 px-10 pt-10">
            <img class="object-cover h-96 md:h-48 w-full rounded-lg" alt={doc.title} src="/collections/blog/{doc.id}/image.webp" />
          </figure>
          <div class="card-body">
            <h2 class="card-title">{doc.title}</h2>
            <p class="sm:text-sm md:text-xs">{doc.text}</p>
            <div class="card-actions">
              <a class="btn btn-primary" href="/blog/{doc.id}" use:link>Read More</a>
            </div>
          </div>
        </div>
      </div>
    {/each}
  </div>
{:else}
  {#if doc}
    <div class="w-full flex flex-col justify-center items-center pt-4">
      <div class="flex flex-wrap w-full xl:w-1/2 md:w-4/6 sm:w-5/6" in:fade>
        <p class="w-full p-6 space-y-6">
          {doc.text}
        </p>
        <div class="w-full p-6 space-y-6">
          {@html docMD}
        </div>
      </div>
    </div>
  {/if}
{/if}