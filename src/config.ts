import { request as WSRequest } from 'websocket';

export const shouldAcceptWS = (req: WSRequest) => {
  return req.resourceURL.pathname === '/ws';
}

export const SSL = {
  key: '../tls-ssl/privkey.pem',
  cert: '../tls-ssl/fullchain.pem',
}

export const maxConnection: number = 2000;

