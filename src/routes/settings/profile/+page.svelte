<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	console.log(data.sections); // [{ slug: 'profile', title: 'Profile' }, ...]
</script>