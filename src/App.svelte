<script>
	import { onMount } from "svelte";
	import Navbar from "./components/Navbar.svelte";
	import { Router, Route } from "svelte-routing";
	import Zen from "./routes/Zen.svelte";
	import DadJokes from "./routes/DadJokes.svelte";
	import Blog from "./routes/Blog.svelte";
	import Recipes from "./routes/Recipes.svelte";
  import Home from "./routes/Home.svelte";
	import NotFound from "./routes/NotFound.svelte";

	import { scroll } from "./stores/stores.js";

  export let url = "";

	const saveScrollPosition = (ev) => {
		$scroll.currentTop = ev.detail.scrollTop;
	};

	onMount(() => {
		const content = document.querySelector('ion-content');
		content.scrollEvents = true;

		content.addEventListener('ionScroll', saveScrollPosition);
	});	
</script>

<style global lang="postcss">
  @tailwind base;
  @tailwind components;
  @tailwind utilities;

	.gradient {
		background: linear-gradient(90deg, rgb(6, 95, 36) 0%, rgb(81, 218, 88) 100%);
	}
</style>

<ion-app>
	<Navbar />

	<ion-content>

		<Router url="{url}">
			
			<Route path="zen/:id" let:params>
				<Zen id="{params.id}" />
			</Route>
			<Route path="zen">
				<Zen id="{null}" />
			</Route>

			<Route path="dad-jokes/:id" let:params>
				<DadJokes id="{params.id}" />
			</Route>
			<Route path="dad-jokes">
				<DadJokes id="{null}" />
			</Route>

			<Route path="blog/:id" let:params>
				<Blog id="{params.id}" />
			</Route>
			<Route path="blog">
				<Blog id="{null}" />
			</Route>
			<Route path="posts/:id" let:params>
				<Blog id="{params.id}" />
			</Route>
			<Route path="posts">
				<Blog id="{null}" />
			</Route>

			<Route path="recipes/:id" let:params>
				<Recipes id="{params.id}" tab="overview" />
			</Route>
			<Route path="recipes/:id/:tab" let:params>
				<Recipes id="{params.id}" tab="{params.tab}" />
			</Route>
			<Route path="recipes">
				<Recipes id="{null}" tab="{null}" />
			</Route>

			<Route path="/">
				<Home />
			</Route>

			<Route>
				<NotFound />
			</Route>

		</Router>

	</ion-content>
</ion-app>