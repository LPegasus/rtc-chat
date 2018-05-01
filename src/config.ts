import { request as WSRequest } from 'websocket';

export const shouldAcceptWS = (req: WSRequest) => {
  return true;
}

export const maxConnection: number = 2000;

