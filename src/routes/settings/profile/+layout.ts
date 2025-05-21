import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({params}) => {

	console.log('params',params)
	return {
		sections: [
			{test: 'asdf'} 
		]
	};
};

 