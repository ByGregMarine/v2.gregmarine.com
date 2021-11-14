<script lang="ts">
	import Navbar from "./components/Navbar.svelte";
	import Content from "./components/Content.svelte";
	import { Router, Route } from "svelte-routing";
	import Zen from "./routes/Zen.svelte";
	import DadJokes from "./routes/DadJokes.svelte";
	import Blog from "./routes/Blog.svelte";
	import Recipes from "./routes/Recipes.svelte";
  import Home from "./routes/Home.svelte";
	import NotFound from "./routes/NotFound.svelte";

  export let url = "";
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

	<Content>

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

	</Content>
</ion-app>