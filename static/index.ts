; (async (win) => {
  const local: {
    selfStream: MediaStream;
    selfRTC: RTCPeerConnection;
    selfSDP: RTCSessionDescriptionInit;
    selfCandidate: RTCIceCandidate;
    otherSDP: RTCSessionDescriptionInit;
    otherCandidate: RTCIceCandidate;
    pid: string;
  } = {} as any;
  const selfVideo = document.querySelector('#self-video') as HTMLVideoElement;
  selfVideo.autoplay = true;
  const otherVideo = document.querySelector('#other-video') as HTMLVideoElement;
  const joinRoomInput = document.querySelector('#join-room-input') as HTMLInputElement;
  const addRoom = document.querySelector('#add-room') as HTMLButtonElement;

  // 必须用 TLS/SSL 加密
  const ws = new WebSocket(`wss://${location.host}/ws`);
  ws.onopen = async function () {
    local.selfStream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: 480,
        height: 270,
      },
      audio: true,
    });

    const selfStreamClone = local.selfStream.clone();
    selfStreamClone.removeTrack(selfStreamClone.getAudioTracks()[0]);
    selfVideo.src = URL.createObjectURL(selfStreamClone);

    local.selfRTC = new RTCPeerConnection({
      bundlePolicy: 'balanced',
      iceTransportPolicy: 'all',
    });

    local.selfRTC.onicecandidate = async e => {
      if (e.candidate) {
        local.selfCandidate = e.candidate;
        ws.send(JSON.stringify({
          candidate: local.selfCandidate,
          type: 'update-candidate',
        }));
        console.info('self ice candidate created.');
      } else {
      }
    }

    local.selfRTC.oniceconnectionstatechange = e => {
      console.log('ice connection state change.');
      console.log(e);
    }

    local.selfRTC.onremovestream = e => {
      console.log('stream removed.');
      console.log(e);
    }

    local.selfRTC.addStream(local.selfStream);

    local.selfSDP = await local.selfRTC.createOffer({
      iceRestart: true,   // 当链接质量发生变更时重连 ICE （好像是这么个意思）
      voiceActivityDetection: true,
    });
    console.log('self SDP created.');
  }

  ws.onmessage = async function (evt) {
    const data = JSON.parse(evt.data);
    switch (data.type) {
      case 'connect-success': { // ws 链接成功
        local.pid = data.id;
        break;
      }
      case 'add-room-success': {
        alert('创建房间成功，房间号：' + data.roomId);
        joinRoomInput.value = data.roomId;
        joinRoomInput.disabled = true;
        break;
      }
    }
  }

  async function handleCreateRoom() {
    await local.selfRTC.setLocalDescription(local.selfSDP);
    ws.send(JSON.stringify({
      type: 'create-room',
      role: 'offer',
      sdp: local.selfSDP,
    }));
  }

  function handleJoinRoom() {
    ws.send(JSON.stringify({
      type: 'join-room',
      role: 'answer',
      sdp: local.selfSDP,
    }));
  }

  addRoom.addEventListener('click', handleCreateRoom);

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

  (win as any).local = local;
})(window);
