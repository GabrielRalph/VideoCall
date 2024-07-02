export class WebRTCSS {
    constructor(config, stream) {
        let pc = new RTCPeerConnection(config);
        this.config = config;
        this.pc = pc;
        this.makingOffer = false;
        this.stream = stream;
        this.remoteStream = null;
        pc.ontrack = (e) => this.ontrackadded(e)
        pc.onnegotiationneeded = (e) => this.onnegotiationneeded(e);
        pc.oniceconnectionstatechange = (e) => this.oniceconnectionstatechange(e);
        pc.onicecandidate = (e) => this.onicecandidate(e);

        if (stream !== null) {
            for (const track of stream.getTracks()) {
                pc.addTrack(track, stream);
            }
        }
    }

    send(object) {

    }

    onStream(stream) {
    }

    async onSignal({ description, candidate }) {
        let {stream, pc, makingOffer} = this;
        try {
            if (description) {
                console.log("description " + description.type);
                // console.log(pc.signalingState, makingOffer);
                const offerCollision =
                    description.type === "offer" &&
                    (makingOffer || pc.signalingState !== "stable");

                let ignoreOffer = (stream !== null) && offerCollision;
                // console.log("ignore", ignoreOffer);
                if (!ignoreOffer) {
                    try {
                        console.log("setting remote description");
                        await pc.setRemoteDescription(description);
                        if (description.type === "offer") {
                            console.log("here");
                            await pc.setLocalDescription();
                            console.log("sending description");
                            this.send({ description: pc.localDescription.toJSON() });
                        }
                    } catch (e) {
                        throw `description failure`
                    }
                }
            } else if (candidate) {
                console.log("candidate in", candidate);

                try {
                    await pc.addIceCandidate(candidate);
                } catch (e) {
                    if (!ignoreOffer) {
                        console.log(e);
                        throw 'candidate failure';
                    }
                }
            }
        } catch (e) {
        }
    }
      
    onicecandidate(data) {
        console.log("candidate out", data);
        if (data.candidate) {
            this.send({candidate: data.candidate.toJSON()});
        }
    }
      
    oniceconnectionstatechange(){
        let {pc} = this;
        console.log("ice: ", pc.iceConnectionState);
        if (pc.iceConnectionState === "failed") {
          pc.restartIce();
        } if (pc.iceConnectionState == "disconnected") {
            this.onStream(null)
        }
    }
      
    async onnegotiationneeded(){
        let {pc} = this;
        try {
            this.makingOffer = true;
            await pc.setLocalDescription();
            this.send({ description: pc.localDescription.toJSON() });
        } catch (err) {
            console.error(err);
        } finally {
            this.makingOffer = false;
        }
    }
      
    ontrackadded({ track, streams }){
        this.remoteStream = streams[0];
        console.log(streams);
        track.onunmute = () => {
            let {pc} = this;
            console.log(pc.signalingState, pc.iceConnectionState);
         this.onStream(streams[0]);
        };
        track.onmute = () => {
   
        }
    }
      
    static async shareScreen(config, displayMediaOptions = {
        video: {
        displaySurface: "window",
        },
        audio: false,
        surfaceSwitching: "include",
        selfBrowserSurface: "exclude",
    }){
        let stream = null;
        try {
            stream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
            return new WebRTCSS(config, stream)
        } catch (err) {
            console.error(`Error: ${err}`);
            return null
        }
    }

    static watchScreen(config, info) {
        let ss = new WebRTCSS(config, null);
        ss.onSignal(info);
        return ss;
    }

    close(){

        if (this.stream != null) {
            // this.stream.oninactive = null;
            for (let track of this.stream.getTracks()) {
                track.stop();
            }
        }
    //     this.onStream = () => {};
    //     this.pc.close();
    }

    get connected(){
        return this.pc.iceConnectionState == "connected";
    }

    async replaceStream(displayMediaOptions = {
        video: {
        displaySurface: "window",
        },
        audio: false,
        surfaceSwitching: "include",
        selfBrowserSurface: "exclude",
    }){
        let stream = null;
        try {
            let oldStream = this.stream;
            oldStream.oninactive = null;
            
            stream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
            this.stream = stream;
            const [videoTrack] = stream.getVideoTracks();
            
            const sender = this.pc
            .getSenders()
            .find((s) => s.track.kind === videoTrack.kind);
            console.log("Found sender:", sender);
            sender.replaceTrack(videoTrack);
            for (let track of oldStream.getTracks()) {
                track.stop();
            }
        } catch (err) {
            console.error(`Error: ${err}`);
            return null
        }
    }
}
