<script lang="ts">
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
</script>


<div class="submenu"> 
	{#each data.sections as section}
		<br/>
		<a href="/settings/{section.slug}">{section.title}</a>
	{/each}
</div>

{@render children()}