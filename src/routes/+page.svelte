<script>
	import { m } from "$lib/paraglide/messages";
	import { setLocale } from "$lib/paraglide/runtime";

    let count = 0;
    $: double = count * 2;
</script>

{m.example_message({ username: "John" })}

<p>Count: {double}</p>


<button on:click={() => setLocale("en")}>English</button>
<button on:click={() => setLocale("de")}>French</button>
