import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
    const loadComments = async () => {
        return new Promise((resolve)=>{
            setTimeout(()=>{
                resolve(['comment1', 'comment2', 'comment3'])
            },10000)
        }) 
    }
    console.log('page.server.ts')
	return {
		// make sure the `await` happens at the end, otherwise we
		// can't start loading comments until we've loaded the post
		comments: loadComments(),
		post: {
            title: params.slug
        }
	};
};
