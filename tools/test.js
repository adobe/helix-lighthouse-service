import { handler } from './index.js';

await handler({
  queryStringParameters: {
    url: 'https://project.hlx.page/'
  },
  "headers": {
    "x-set-cookie": "hlx-auth-token=token"
  }
});

