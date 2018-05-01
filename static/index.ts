; (async (win) => {
  const local: {
    stream: MediaStream;
    rtc: RTCPeerConnection;
    offer: RTCSessionDescriptionInit;
    answer: RTCSessionDescriptionInit;
    answerCandidate: RTCIceCandidate;
    offerCandidate: RTCIceCandidate;
    rtc2: RTCPeerConnection;
  } = {} as any;
  const video = document.querySelector('#video') as HTMLVideoElement;
  const video2 = document.querySelector('#video2') as HTMLVideoElement;

  const ws = new WebSocket('ws://localhost:8080')

  // local.stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  // video.src = URL.createObjectURL(local.stream);
  // video.onerror = function () {
  //   local.stream.stop();
  // }

  // local.stream.addEventListener('inactive', function () {
  //   console.log('inactive');
  // });

  // local.rtc = new RTCPeerConnection({
  //   bundlePolicy: 'balanced',
  //   peerIdentity: 'LP',
  //   iceTransportPolicy: 'all',
  // });

  // local.rtc.addStream(local.stream);

  // local.rtc.onicecandidate = async e => {
  //   if (e.candidate) {
  //     local.offerCandidate = e.candidate;
  //     await local.rtc2.addIceCandidate(e.candidate);
  //   } else {
  //     console.log(1);
  //   }
  // }

  // local.offer = await local.rtc.createOffer({
  //   iceRestart: true,
  //   voiceActivityDetection: true,
  // });

  // await local.rtc.setLocalDescription(local.offer);

  // local.rtc2 = new RTCPeerConnection({
  //   bundlePolicy: 'balanced',
  //   peerIdentity: 'EVA',
  //   iceTransportPolicy: 'all',
  // });

  // local.rtc2.onicecandidate = async e => {
  //   if (e.candidate) {
  //     local.answerCandidate = e.candidate;
  //     await local.rtc.addIceCandidate(e.candidate);
  //   } else {
  //     console.log('2');
  //   }
  // }

  // const sdp2 = new RTCSessionDescription(local.rtc.localDescription as RTCSessionDescriptionInit);
  // await local.rtc2.setRemoteDescription(sdp2 as RTCSessionDescriptionInit);
  // local.rtc2.onaddstream = e => {
  //   video2.srcObject = e.stream;
  // }
  // local.answer = await local.rtc2.createAnswer({
  //   iceRestart: true,
  //   voiceActivityDetection: true,
  // });

  // await local.rtc2.setLocalDescription(local.answer);
  // local.rtc.setRemoteDescription(local.rtc2.localDescription as RTCSessionDescriptionInit);

  // // local.answer = await local.rtc.createAnswer({
  // //   iceRestart: false,
  // //   offerToReceiveAudio: 1,
  // //   offerToReceiveVideo: 1,
  // //   voiceActivityDetection: true,
  // // });

  // (win as any).local = local;
})(window);
