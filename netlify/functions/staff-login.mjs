import { handle } from '../lib/runtime.mjs';
export default request => handle('login',request);
export const config = {rateLimit: {windowLimit:5,windowSize:60,aggregateBy:['ip','domain']}};
