<script lang="ts">
  import { fade } from "svelte/transition";
  import { link } from "svelte-routing";
  import {
    pageTitle,
    collectionName,
    documentName,
    zen,
    dadjokes,
    blog,
    recipes,
  } from "../stores/stores.js";

  pageTitle.set("");
  collectionName.set("");
  documentName.set("");

  const scrollTo = (id: string) => {
    const element = document.getElementById(id);
    element.scrollIntoView({ behavior: "smooth" });
  };
</script>

<!--Hero-->
<div id="home" class="hero min-h-screen" in:fade>
  <div class="flex-col hero-content lg:flex-row-reverse">
    <img
      alt="Greg Marine headshot"
      class="max-w-sm mask mask-squircle"
      src="/profile.webp"
    />
    <div>
      <h1 class="mb-5 text-5xl font-bold">Hello there! I'm Greg!</h1>
      <p class="mb-5">
        Zen Technologist 🧘‍♂️ Teller of Dad Jokes 🤣 Motivating a Mentally
        Healthier World 🙌
      </p>
      <button class="btn btn-primary" on:click={() => {scrollTo("zen")}}>
        Get to know me
      </button>
    </div>
  </div>
</div>

<div class="divider">Ooohuuummm...</div>

<!--Zen-->
<section id="zen" class="py-8">
  <div class="container max-w-5xl mx-auto m-8">
    <a href="zen" class="w-full no-underline hover:no-underline" use:link>
      <h1 class="w-full my-2 text-5xl font-bold leading-tight text-center">
        Zen
      </h1>
    </a>

    <div class="w-full mb-4">
      <div class="h-1 mx-auto gradient w-64 opacity-25 my-0 py-0 rounded-t" />
    </div>

    <h2 class="w-full my-2 text-2xl font-bold leading-tight text-center">
      Postive Motivation for a Troubled World
    </h2>

    <div class="hero">
      <div class="flex-col hero-content lg:flex-row-reverse">
        <img
          alt="Desktop Zen Garden with mini Torii Gate"
          class="max-w-sm mask mask-hexagon-2"
          src="/collections/zen/image-01.webp"
        />
        <div>
          <h3 class="mb-5 text-3xl font-bold">The Path to Balance</h3>
          <p class="mb-5">
            Most days I begin my day by building a fresh and unique Zen garden
            design. I conclude my day by resetting the Zen garden to clear my
            mind. Weekdays, I feature my Zen garden on social media along with
            an inspirational quote or motivational statement.
          </p>
        </div>
      </div>
    </div>

    <div class="hero">
      <div class="flex-col hero-content lg:flex-row">
        <img
          alt="Desktop Zen Garden with mini tree"
          class="max-w-sm mask mask-circle"
          src="/collections/zen/image-02.webp"
        />
        <div>
          <h3 class="mb-5 text-3xl font-bold">Connect with the Moment</h3>
          <p class="mb-5">
            My desktop Zen garden often features items I have collected on my
            life's journey. For example, this dish with a tree is a reminder
            of a wonderful trip I took to the Walt Disney World Resort in
            Central Florida.
          </p>
        </div>
      </div>
    </div>

    <div class="w-full mb-4">
      <div class="h-1 mx-auto gradient w-64 opacity-25 my-0 py-0 rounded-t" />
    </div>

    <h2 class="w-full my-2 text-2xl font-bold leading-tight text-center">
      My Latest Zen Writings
    </h2>

    <div class="container mx-auto flex flex-wrap pt-4 pb-12">
      {#each $zen.slice(0, 3) as doc}
        <div class="flex md:w-1/2 lg:w-1/3 p-2" in:fade|local>
          <div class="card bordered shadow-lg image-full">
            <div class="card-body">
              <h2 class="card-title">{doc.title}</h2>
              <p>{doc.text}</p>
              <div class="card-actions">
                <a class="btn btn-primary" href="zen/{doc.id}" use:link>
                  Read More
                </a>
              </div>
            </div>
            <figure class="m-0">
              <img
                alt={doc.title}
                src="/collections/zen/{doc.id}/image.webp"
              />
            </figure>
          </div>
        </div>
      {/each}

      <div class="flex md:w-1/2 lg:w-1/3 p-2" in:fade|local>
        <a class="btn btn-primary" href="zen" use:link>
          More Zen
        </a>
      </div>
    </div>
  </div>
</section>

<div class="divider">...but wait! There's more!</div> 
