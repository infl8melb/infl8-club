import { handle } from '../lib/runtime.mjs';
export default request => handle('save',request);
export const config = {rateLimit: {windowLimit:120,windowSize:60,aggregateBy:['ip','domain']}};
