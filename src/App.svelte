<script lang="ts">
	export let name: string;

	import { Router, Route, Link } from "svelte-routing";
  import Home from "./routes/Home.svelte";
	import About from "./routes/About.svelte";
  export let url = "";
</script>

<style global lang="postcss">
  @tailwind base;
  @tailwind components;
  @tailwind utilities;
</style>

<ion-app>
	<ion-toolbar>
		<ion-title>
			<ion-text>
				<h1>Hello {name}</h1>
			</ion-text>
		</ion-title>
	</ion-toolbar>

	<ion-content>

		<Router url="{url}">
			<nav>
				 <Link to="/">Home</Link>
				 <Link to="about">About</Link>
			 </nav>
			 <div>
				 <Route path="about" component="{About}" />
				 <Route path="/"><Home /></Route>
			 </div>
		</Router>

	</ion-content>
</ion-app>