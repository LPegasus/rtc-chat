import * as cluster from 'cluster';
import * as path from 'path';
import * as os from 'os';
import { ChildProcess } from 'child_process';
import * as chalk from 'chalk';
import { omit } from 'lodash';
import { createHash } from 'crypto';
import { maxConnection } from './config';

function nextHash(seed) {
  const hash = createHash('sha256');
  return hash.update(`LPegasus${Date.now()}${seed}`).digest('base64').substr(0, 6);
}

const log = console.log;
const numCPUs = os.cpus().length;
const port = process.env.port || 8080;
const wkList: cluster.Worker[] = [];

const createAgent = (index: number) => {
  cluster.setupMaster({
    exec: path.resolve(__dirname, 'agent'),
  });

  const wk = cluster.fork({
    port,
    index,
  });

  const wkLocalVars: {
    rooms: IRoom[];
    connectionList: WSConnectionDSP[];
  } = {
    rooms: [],
    connectionList: [],
  }

  const leaveRoom = id => {
    for (let i = 0; i <= wkLocalVars.rooms.length - 1; i++) {
      const room = wkLocalVars.rooms[i];
      if (room.answer && room.answer.connectionPid === id) {
        delete room.answer;
        break;
      }
      if (room.offer && room.offer.connectionPid === id) {
        delete room.offer;
        break;
      }
      if (!room.offer && !room.answer) {
        wkLocalVars.rooms.splice(i--, 1);
      }
    }
  }

  const updateCandidate = (id: string, candidate: RTCIceCandidate, mirror: string) => {
    const conn = wkLocalVars.connectionList.find(d => d.id === id);
    if (!conn) {
      log(chalk.default.bgRed('No connection was found when update candidate.'));
    } else {
      conn.candidate = candidate;
      let notifyId: string | undefined;
      for (let i = 0; i < wkLocalVars.rooms.length; i++) {
        const d = wkLocalVars.rooms[i];
        if (!!d.answer && d.answer.connectionPid === conn.id) {
          if (d.offer) {
            notifyId = d.offer.connectionPid;
          }
          break;
        }
        if (!!d.offer && d.offer.connectionPid === conn.id) {
          if (d.answer) {
            notifyId = d.answer.connectionPid;
          }
          break;
        }
      }

      wk.send({
        type: 'update-candidate-finish',
        mirror,
      });

      if (notifyId) {
        const target = wkLocalVars.connectionList.filter(d => d.id === notifyId)[0];
        if (target) {
          const wkT = wkList.find(d => d.id === target.wkId);
          if (wkT) {
            wkT.send({ type: 'notify-candidate-change', mirror, candidate });
          }
        }
      }
    }
  }

  wk.on('message', (msg: { type: string } & { [key: string]: any }) => {
    const registerConnection = (wkId: number) => {
      if (!wk || !wk.isConnected() || wk.isDead()) {
        log(chalk.default.red(`Worker[id: ${wkId}] is dead or not exist. So register ws connection failed.`));
        return null;
      }
      let id: string;
      do {
        id = nextHash(wk.id);
      } while (
        wkLocalVars.connectionList.some(d => d.id === id)
      );

      wkLocalVars.connectionList.push({
        id,
        wkId,
      });

      return {
        id, wkId,
      };
    }
    switch (msg.type) {
      case 'need-new-one': {
        wk.disconnect();
        wk.removeAllListeners();
        log(msg);
        wkList[+msg.index] = createAgent(+msg.index);
        log(chalk.default.redBright(`worker[${msg.index}] will restart.`));
        break;
      }
      case 'log': {
        log(omit(msg, 'type'));
        break;
      }
      case 'add-connection': {
        const rtn = registerConnection(wk.id);
        if (rtn) {
          wk.send({ type: 'add-connection-success', id: rtn.id, mirror: msg.mirror });
        } else {
          wk.send({ type: 'add-connection-fail', mirror: msg.mirror });
        }
        break;
      }
      case 'add-room': {
        const connection = wkLocalVars.rooms.filter(d => !!(d.offer && d.offer.connectionPid === msg.offer.connectionPid))[0];
        if (connection) {
          wk.send({
            type: 'add-room-fail',
            mirror: msg.mirror,
          });
          break;
        }
        const room: IRoom = {
          offer: msg.offer,
          id: nextHash(`room${wkLocalVars.rooms.length}`),
        };

        const conn = wkLocalVars.connectionList.filter(d => d.id === msg.offer.id)[0];
        conn.sdp = msg.offer;

        wkLocalVars.rooms.push(room);
        log(chalk.default.whiteBright(`room created [${room.id}]`));
        wk.send({
          type: 'add-room-success',
          mirror: msg.mirror,
          id: room.id,
        });
        break;
      }
      case 'join-room': {
        const room = wkLocalVars.rooms.find(d => d.id === msg.roomId);
        if (!room) {
          wk.send({
            type: 'error',
            errorMsg: `Room[${msg.roomId}] is not found.`,
          });
          log(chalk.default.yellowBright(`Room[${msg.roomId}] is not found.`));
        } else {
          room.answer = msg.answer;
          wk.send({
            type: 'join-room-success',
            mirror: msg.mirror,
          });
        }
        break;
      }
      case 'close-connection': {
        const i = wkLocalVars.connectionList.findIndex(d => d.id === msg.id);
        leaveRoom(msg.id);
        wkLocalVars.connectionList.splice(i, 1);
        break;
      }
      case 'leave-room': {
        leaveRoom(msg.id);
        break;
      }
      case 'update-candidate': {
        updateCandidate(msg.id, msg.candidate, msg.mirror);
        break;
      }
    }
  });

  wk.once('online', () => {
    log(chalk.default.greenBright(`worker[${index}] is online.`));
  });

  wk.once('disconnect', () => {
    log(chalk.default.red(`worker[${index}] disconnected.`));
  });
  return wk;
}

for (let i = 0; i < numCPUs - 1;) {
  wkList[i++] = createAgent(i);
}

process.on('beforeExit', () => {
  while (wkList.length) {
    const wk = wkList.shift();
    if (wk && !wk.isDead) {
      wk.kill('SIGTERM');
    }
  }
});
