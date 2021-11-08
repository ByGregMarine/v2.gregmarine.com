<script lang="ts">
  import { navigate } from "svelte-routing";
  import { title, collection, document } from "../stores/PageStore";

  const close = () => {
    if($collection !== "") {
      navigate($collection.toLowerCase().replaceAll(" ", "-"));
    } else {
      navigate("/");
    }
  };

  type MenuItem = {
    title: string;
    href: string;
  };

  const menuItems: MenuItem[] = [
    {
      title: "Home",
      href: "/"
    },
    {
      title: "Zen",
      href: "zen"
    },
    {
      title: "Dad Jokes",
      href: "dad-jokes"
    },
    {
      title: "Blog",
      href: "blog"
    },
    {
      title: "Recipes",
      href: "recipes"
    }
  ];
</script>

<ion-header>
  <ion-toolbar>
    {#if $document !== ""}
      <ion-title>
        {$title}
      </ion-title>

      <ion-buttons slot="end">
        <ion-button on:click={close}>
          <ion-icon name="close"></ion-icon>
        </ion-button>
      </ion-buttons>
    {:else}
      <ion-title>
        {$title}
      </ion-title>

      <ion-buttons slot="end">
        {#each menuItems as item}
          <ion-button on:click={() => navigate(item.href)}>
            <ion-text>{item.title}</ion-text>
          </ion-button>
        {/each}
      </ion-buttons>
    {/if}
  </ion-toolbar>
</ion-header>