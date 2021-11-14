<script>
  import { afterUpdate, onMount } from "svelte";
  import { currentScrollTop } from "../stores/ContentStore";

  const saveScrollTop = (ev) => {
    currentScrollTop.set(ev.detail.scrollTop);
  };

  onMount(() => {
    console.log('onMount');
    const content = document.querySelector('ion-content');
    content.scrollEvents = true;
    content.addEventListener('ionScroll', saveScrollTop);
  });

  afterUpdate(() => {
    console.log('afterUpdate');
  });
</script>

<ion-content>
  <slot></slot>
</ion-content>