<script lang="ts">
	import Navbar from "./components/Navbar.svelte";
	import { Router, Route } from "svelte-routing";
  import Home from "./routes/Home.svelte";
	import Zen from "./routes/Zen.svelte";
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

	<ion-content>

		<Router url="{url}">
			
			<Route path="zen/:id" let:params>
				<Zen id="{params.id}" />
			</Route>

			<Route path="/zen">
				<Zen id="{null}" />
			</Route>

			<Route path="/">
				<Home />
			</Route>

		</Router>

	</ion-content>
</ion-app>