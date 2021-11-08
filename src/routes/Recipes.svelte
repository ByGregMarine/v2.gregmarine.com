<script lang="ts">
  import { afterUpdate, beforeUpdate } from 'svelte';
  import { fade } from "svelte/transition";
  import { link, navigate } from "svelte-routing";
  import xss from "xss";
  import { Marked } from '@ts-stack/markdown';
  import { recipes } from "../stores/IndexStore";
  import { collection, document } from "../stores/PageStore";

  export let id: string | null | undefined;
  export let tab: string | null | undefined;

  collection.set("Recipes");
  document.set("");
  
  let docMD = "";
  const getDocument = async () => {
    const response = await fetch(`/collections/recipes/${id}/${tab}.md`);
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
    if($recipes.length > 0 && !docLoaded) {
      if (id) {
        $recipes.find(element => {
          if (element.id === id) {
            document.set(element.title);
            doc = element;
            return true;
          }
        });

        if (tab !== "overview") {
          getDocument();
        }
      } else {
        document.set("");
        doc = null;
      }
      docLoaded = true;
    }
	});

  beforeUpdate(() => {
    if(docLoaded) docLoaded = false;
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
      Food I Love to Make
    </h2>

    {#each $recipes as doc}
      <div class="flex md:w-1/2 lg:w-1/3 xl:w-1/4 p-2" in:fade>
        <div class="card bordered shadow-lg">
          <figure class="m-0 px-10 pt-10">
            <img class="object-cover h-96 md:h-48 w-full rounded-lg" alt={doc.title} src="/collections/recipes/{doc.id}/image.webp" />
          </figure>
          <div class="card-body">
            <h2 class="card-title">{doc.title}</h2>
            <p class="sm:text-sm md:text-xs">{doc.text}</p>
            <div class="card-actions">
              <a class="btn btn-primary" href="/recipes/{doc.id}" use:link>Show Recipe</a>
            </div>
          </div>
        </div>
      </div>
    {/each}
  </div>
{:else}
  {#if doc}
    <div class="w-full flex flex-col justify-center items-center pt-24">
      <div class="flex flex-wrap w-full xl:w-1/2 md:w-4/6 sm:w-5/6" in:fade>
        <div class="tabs w-full">
          <a
            href="/recipes/{doc.id}/overview"
            class="tab tab-lifted {tab === 'overview' ? 'tab-active' : ''}"
            use:link>Overview</a
          >
          <a
            href="/recipes/{doc.id}/ingredients"
            class="tab tab-lifted {tab === 'ingredients' ? 'tab-active' : ''}"
            use:link>Ingredients</a
          >
          <a
            href="/recipes/{doc.id}/instructions"
            class="tab tab-lifted {tab === 'instructions'
              ? 'tab-active'
              : ''}"
            use:link>Instructions</a
          >
          <a
            href="/recipes/{doc.id}/notes"
            class="tab tab-lifted {tab === 'notes' ? 'tab-active' : ''}"
            use:link>Notes</a
          >
          <div class="flex-1 cursor-default tab tab-lifted"></div>
        </div>

        {#if tab === "overview"}
          <div class="w-full flex flex-col justify-center items-center">
            <div
              class="flex flex-wrap w-full"
              in:fade
            >
              <div class="w-5/6 sm:w-1/2 p-6">
                <p class="mb-8">
                  {doc.text}
                </p>
              </div>
              <div class="w-full sm:w-1/2 p-6">
                <img
                  alt={doc.title}
                  src="/collections/recipes/{doc.id}/image.webp"
                />
              </div>
            </div>
          </div>
        {:else}
          <div class="w-full p-6 space-y-6">
            {@html docMD}
          </div>
        {/if}
      </div>
    </div>
  {/if}
{/if}