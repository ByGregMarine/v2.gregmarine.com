<script lang="ts">
  import { navigate } from "svelte-routing";

  import { pageTitle, collectionName, documentName } from "../stores/stores.js";

  const close = () => {
    if($collectionName !== "") {
      navigate($collectionName);
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
      href: "dadjokes"
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
    {#if $documentName !== ""}
      <ion-title>{$documentName}</ion-title>

      <ion-buttons slot="end">
        <ion-button on:click={close}>
          <ion-icon name="close"></ion-icon>
        </ion-button>
      </ion-buttons>
    {:else}
      <ion-title>
        {$pageTitle}
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