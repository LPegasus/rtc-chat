declare interface IRoom {
  id: string;
  offer?: {
    connectionUUID?: string;
    connectionPid?: string;
    dsp?: RTCSessionDescription;
    // candidate?: RTCIceCandidate;
  };
  answer?: {
    connectionUUID?: string;
    connectionPid?: string;
    dsp?: RTCSessionDescription;
    // candidate?: RTCIceCandidate;
  };
}

declare type WSConnectionDSP = {
  id: string;
  wkId: number;
};