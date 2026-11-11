// Workers provide fetch; XMLHttpRequest is not available in this runtime.
export default class XMLHttpRequest { constructor() { throw new Error('Use fetch for server HTTP requests.'); } }
