import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, parent }) => {
	parent().then(r=>{
		console.log('parent',r)
	});
	
	return {
		post: {
			title: `Title for ${params.slug} goes here`,
			content: `Content for ${params.slug} goes here`
		}
	};
};