<script>
  import { onMount } from "svelte";
  import { get } from 'svelte/store';
  import { currentScrollTop, previousScrollTop, currentPath, previousPath } from "../stores/ContentStore";

  let startScrollTop = 0;
  let content;

  export const gotoStartScrollTop = () => {
    if (content) {
      content.scrollToPoint(0, startScrollTop, 0);
    }
  };

  const saveScrollTop = (ev) => {
    currentScrollTop.set(ev.detail.scrollTop);
  };

  onMount(() => {
    content = document.querySelector('ion-content');
    content.scrollEvents = true;
    content.addEventListener('ionScroll', saveScrollTop);

    if(window.location.pathname === get(previousPath)) {
      startScrollTop = get(previousScrollTop);
      gotoStartScrollTop();
    }

    previousScrollTop.set(get(currentScrollTop));

    previousPath.set(get(currentPath));
    currentPath.set(window.location.pathname);
  });
</script>

<ion-content>
  <slot></slot>
</ion-content>