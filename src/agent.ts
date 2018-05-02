import * as express from 'express';
import * as https from 'https';
import * as os from 'os';
import * as chalk from 'chalk';
import { readFileSync } from 'fs';
import * as path from 'path';
import { server as WebsocketServer, connection as WSConnection, request as WSRequest, IMessage } from 'websocket';
import { shouldAcceptWS, SSL } from './config';
import { asyncTimout, Defer } from './utils';

type WSConnectionEX = WSConnection & { _pid: string; _uuid: string; };

const worker = process;
const connectionMap: { [key: string]: WSConnectionEX } = {};
let connectUUID = 0;

process.on('uncaughtException', (e: Error) => {
  if (process.send) {
    console.log('------------i\'m going to die-------------');
    console.log(e);
    console.log('-----------------  dead  -----------------');
    process.send({ type: 'need-new-one', error: e, index: process.env.index });
  }
  process.exit(os.constants.signals.SIGILL);
});

// process.on('SIGKILL', () => {
//   console.log(chalk.default.cyan(`worker[${process.env.index}] will be killed.`));
//   process.exit(os.constants.signals.SIGKILL);
// });

const app = express();
const server = https.createServer({
  key: readFileSync(path.resolve(SSL.key)),
  cert: readFileSync(path.resolve(SSL.cert)),
}, app);
server.listen(process.env.port);
console.log(`server ${process.env.index} listen on port: ${process.env.port}`);

const wsServer = new WebsocketServer({
  httpServer: server,
});

process.on('message', (msg) => {
  if (msg.type === 'add-connection-success') {
    const uuid = msg.mirror;
    const connection = connectionMap[uuid];
    if (!connection) {
      return;
    }
    connection._pid = msg.id;

    connection.sendUTF(JSON.stringify({
      type: 'connect-success',
      id: connection._pid,
      wid: connection._uuid,
    }));

    wrapConnectionHandle(connection);
  }
});

async function createRoom(connection: WSConnectionEX, sdpFromOffer: RTCSessionDescription) {
  const mirror = connection._uuid + Date.now();
  const offer = {
    connectionPid: connection._pid,
    connectionUUID: connection._uuid,
    sdp: sdpFromOffer,
  };
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      process.removeListener('message', handler);
      connection.sendUTF(JSON.stringify({
        type: 'alert',
        message: 'Timeout when create room.',
      }));
      reject();
    }, 5000);

    if (!process.send) {
      clearTimeout(timer);
      reject(new Error('Process is not a worker process.'));
      return;
    }

    process.send({ type: 'add-room', offer, mirror });
    function handler(msg) {
      if (msg.mirror === mirror) {
        clearTimeout(timer);
        process.removeListener('message', handler);
        if (msg.type === 'add-room-success') {
          connection.sendUTF(JSON.stringify({
            type: 'add-room-success',
            roomId: msg.id,
          }));
        }
      }
    }
    process.on('message', handler);
  });
}

async function joinRoom(connection: WSConnectionEX, sdpFromAnswer: RTCSessionDescription, roomId: string) {
  const mirror = connection._uuid + Date.now();
  const answer = {
    connectionPid: connection._pid,
    connectionUUID: connection._uuid,
    sdp: sdpFromAnswer,
  };

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      process.removeListener('message', handler);
      connection.sendUTF(JSON.stringify({
        type: 'alert',
        message: 'Timeout when join room.',
      }));
      reject();
    }, 5000);
    if (!process.send) {
      clearTimeout(timer);
      reject();
      return;
    }

    // 加入房间。必须传入房间号和 answer 的 sdp 相关信息
    process.send({ type: 'join-room', mirror, answer, roomId });
    function handler(msg) {
      if (msg.mirror === mirror) {
        clearTimeout(timer);
        process.removeListener('message', handler);
        if (msg.action === 'join-room-success') {
          connection.sendUTF(JSON.stringify({
            ok: true,
          }));
        }
      }
    }
    process.on('message', handler);
  });
}

async function leaveRoom(connection: WSConnectionEX) {
  if (!process.send) throw new Error('Process is not a worker process.');

  process.send({
    type: 'leave-room',
    id: connection._pid,
  });

  connection.sendUTF(JSON.stringify({
    ok: true,
  }));

  connection.close();
}

const updateCandidate = asyncTimout(
  async (connection: WSConnectionEX, candidate: RTCIceCandidate) => {
    const defer = new Defer();
    const mirror = connection._uuid + Date.now();
    process.send && process.send({ mirror, type: 'update-candidate', id: connection._pid, candidate })
    function handler(msg) {
      if (msg.type === 'update-candidate-finish') {
        console.log('update-candidate-finish');
      }
      process.removeListener('message', handler);
      connection.sendUTF(JSON.stringify({
        type: 'update-candidate-finish',
      }));
      defer.resolve({});
    }
    process.on('message', handler);
    return defer.promise;
  },
  5000);

const wrapConnectionHandle = (connection: WSConnectionEX) => {
  connection.on('message', async (msg: IMessage) => {
    if (msg.type !== 'utf8' || !msg.utf8Data) {
      return;
    }

    const action: { [key: string]: any } = JSON.parse(msg.utf8Data);

    switch (action.type) {
      // { sdp }
      case 'create-room': { // 创建房间
        await createRoom(connection, action.sdp);
        break;
      }

      // { sdp, roomId }
      case 'join-room': { // 加入房间
        try {
          await joinRoom(connection, action.sdp, action.roomId);
        } catch (e) {
          connection.sendUTF(JSON.stringify({
            type: 'alert',
            errorMsg: e.message,
          }));
        }
        break;
      }

      case 'leave-room': {
        try {
          await leaveRoom(connection);
        } catch (e) {
          connection.sendUTF(JSON.stringify({
            type: 'alert',
            errorMsg: e.message,
          }));
        }
        break;
      }

      case 'update-candidate': {
        const candidate = action.candidate;
        await updateCandidate(connection, candidate);
        break;
      }
    }
  });
}

wsServer.on('request', (req: WSRequest) => {
  if (shouldAcceptWS(req) === true) {
    req.accept();
  } else {
    req.reject(200, 'not accept');
  }
});

wsServer.on('connect', (connection: WSConnection) => {
  const conn = connection as WSConnectionEX;
  if (!process.send) {
    return;
  }
  const uuid = connectUUID++;
  connectionMap[uuid] = conn as WSConnectionEX;
  conn._uuid = uuid.toString();
  process.send({ type: 'add-connection', index: process.env.index, mirror: conn._uuid });
  conn.once('close', (code, desc) => {
    if (!process.send) return;
    process.send({
      type: 'close-connection',
      id: conn._pid,
    });
  });
});

app.use(express.static('./static'));

