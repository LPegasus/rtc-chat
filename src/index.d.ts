declare interface IRoom {
  id: string;
  offer?: {
    connectionUUID: string;
    connectionPid: string;
    sdp?: RTCSessionDescription;
    // candidate?: RTCIceCandidate;
  };
  answer?: {
    connectionUUID: string;
    connectionPid: string;
    sdp?: RTCSessionDescription;
    // candidate?: RTCIceCandidate;
  };
}

declare type WSConnectionDSP = {
  id: string;
  wkId: number;
  candidate?: RTCIceCandidate;
  sdp?: RTCSessionDescription;
};