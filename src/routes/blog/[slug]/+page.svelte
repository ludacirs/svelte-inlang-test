<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	console.log('data',data)
</script>

<h1>{data.post.title}</h1>
<div>{@html data.post.content}</div>
