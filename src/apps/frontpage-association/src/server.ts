import { AngularAppEngine, createRequestHandler } from '@angular/ssr';
const app = new AngularAppEngine();
export const reqHandler = createRequestHandler(async (request: Request) => await app.handle(request) ?? new Response('Not found', {status:404}));
export default {fetch: reqHandler};
