<script lang="ts">
  import { afterUpdate } from 'svelte';
  import { fade } from "svelte/transition";
  import { link, navigate } from "svelte-routing";
	import Content from "../components/Content.svelte";
  import xss from "xss";
  import { Marked } from '@ts-stack/markdown';
  import { zen } from "../stores/IndexStore";
  import { collection, document } from "../stores/PageStore";

  export let id: string | null | undefined;

  collection.set("Zen");
  document.set("");

  let content;

  let docMD = "";
  const getDocMD = async () => {
    const response = await fetch(`/collections/zen/${id}/document.md`);
    if (response.status === 404) {
      navigate("404");
    } else {
      const data = await response.text();
      docMD = Marked.parse(xss(data));

      content.gotoStartScrollTop();
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
    if($zen.length > 0 && !docLoaded) {
      if (id) {
        $zen.find(element => {
          if (element.id === id) {
            document.set(element.title);
            doc = element;
            return true;
          }
        });

        getDocMD();
      } else {
        document.set("");
        doc = null;
      }
      docLoaded = true;
    }
	});
</script>

<Content bind:this={content}>

{#if !id}
  <div class="container mx-auto flex flex-wrap pt-4 pb-12" in:fade>
    <div class="w-full mb-4">
      <div class="h-1 mx-auto gradient w-64 opacity-25 my-0 py-0 rounded-t" />
    </div>
    <h2
      class="w-full my-2 text-xl lg:text-2xl font-bold leading-tight text-center"
      in:fade
    >
      Postive Motivation for a Troubled World
    </h2>

    {#each $zen as doc}
      <div class="flex md:w-1/2 lg:w-1/3 xl:w-1/4 p-2" in:fade>
        <div class="card bordered shadow-lg image-full">
          <div class="card-body">
            <h2 class="card-title">{doc.title}</h2>
            <p>{doc.text}</p>
            <div class="card-actions">
              <a class="btn btn-primary" href="/zen/{doc.id}" use:link>Read More</a>
            </div>
          </div>
          <figure class="m-0">
            <img alt={doc.title} src="/collections/zen/{doc.id}/image.webp" />
          </figure>
        </div>
      </div>
    {/each}
  </div>
{:else}
  {#if doc}
    <div class="container mx-auto w-full flex flex-col items-center pt-4 pb-12" in:fade>
      <div class="flex-1 card lg:card-side lg:h-64 md:w-2/3 xl:w-3/4">
        <figure>
          <img class="h-full" alt={doc.title} src="/collections/zen/{doc.id}/image.webp" />
        </figure> 
        <div class="card-body">
          <p class="italic">{doc.text}</p>
        </div>
      </div> 

      <div class="flex-1 lg:h-64 md:w-2/3 xl:w-3/4 p-6 space-y-6">
        {@html docMD}
      </div>
    </div>
  {/if}
{/if}

</Content>