import { Vector } from "../../SvgPlus/4.js"
import { HideShow, SvgResize } from "../../Utilities/basic-ui.js"
import { parallel, dotGrid, delay, linspace } from "../../Utilities/usefull-funcs.js"
import * as Algorithm from "../Algorithm/EyeGaze.js"

async function waitForClick() {
	return new Promise((resolve, reject) => {
		let end = () => {
			window.removeEventListener("click", end);
			resolve();
		}
		window.addEventListener("click", end);
	});
}
class CalibrationFrame extends HideShow {
	constructor(el = "calibration-frame") {
		super(el);
		if (typeof el === "string") this.onconnect();
	}

	onconnect() {
		this.styles = {
			position: "absolute",
			top: 0,
			left: 0,
			right: 0,
			bottom: 0,
			background: "white"
		}

		let rel = this.createChild("div", {
			styles: {
				position: "relative",
				width: "100%",
				height: "100%"
			}
		});

		let pointers = rel.createChild(SvgResize);
		this.pointer = pointers.createPointer("calibration", 15);
		pointers.shown = true;
		pointers.start();

		let vregs = new HideShow("g");
		this.vregs = vregs;
		this.vregps = [];
		let s = 5;
		for (let y = 0; y < s; y++) {
			for (let x = 0; x < s; x++) {
				let p = pointers.createPointer("calibration", 20);
				p.position = new Vector((x + 0.5) / s, (y + 0.5) / s);
				p.shown = true;
				this.vregps.push(p);
				vregs.appendChild(p);
			}
		}
		pointers.appendChild(vregs);


		let message = new HideShow("div");
		message.styles = {
			position: "absolute",
			top: "50%",
			left: "50%",
			transform: "translate(-50%, -50%)",
			"text-align": "center",
			"font-size": "1.5em",
		}
		this.appendChild(message);
		this.message = message;

		Algorithm.setCalibrationPositionGetter(() => { return this.position })
	}

	get pad() { return 0.03; }
	get topleft() { return new Vector(this.pad, this.pad); }
	get tl() { return this.topleft; }
	get topright() { return new Vector(1 - this.pad, this.pad); }
	get tr() { return this.topright; }
	get bottomleft() { return new Vector(this.pad, 1 - this.pad); }
	get bl() { return this.bottomleft; }
	get bottomright() { return new Vector(1 - this.pad, 1 - this.pad); }
	get br() { return this.bottomright; }
	set recording(value) {
		this._recording = value;
		if (value) Algorithm.startSampling(this.sample_method, this.bbox)
		else Algorithm.stopSampling()
	}
	get recording() {
		return this._recording;
	}
	get position() {
		return this.pointer.position;
	}

	async calibrate_grid(grid = 3, counts = 4) {
		let { tl, tr, bl, br } = this;
		this.sample_method = "grid" + grid;
		let points = dotGrid(grid, tl, tr, bl, br);
		await this.showMessageCountDown("Focus on the red dot<br/>as it appears on the screen.<br/>$$");
		await this.calibrateAtPoints(points, counts);
	}
	async calibrate_points(points, counts) {
		let { pointer } = this;
		for (let p of points) {
			pointer.position = p;
			await pointer.show(1000);
			this.recording = true;
			for (let s = 0; s < counts; s++) {
				pointer.text = s + 1;
				await pointer.showText(500);
				await pointer.hideText(500)
			}
			this.recording = false;
			await pointer.hide();
		}
	}
	async calibrate_scan(divs = 5, max_time = 3000) {
		let { pointer } = this;
		let bbox = this.getBoundingClientRect();
		let [t1, t2] = [max_time, max_time];
		if (bbox.width > bbox.height) t2 = max_time * bbox.height / bbox.width;
		else if (bbox.height > bbox.width) t1 = max_time * bbox.width / bbox.height;

		let ext = [[this.tl, this.bl, this.tr, this.br, t1], [this.tl, this.tr, this.bl, this.br, t2]];
		for (let [pa1, pa2, pb1, pb2, time] of ext) {
			let pairs = linspace(1, 0, divs).map(t =>
				[pa1.mul(t).add(pa2.mul(1 - t)), pb1.mul(t).add(pb2.mul(1 - t))]
			)
			for (let [left, right] of pairs) {
				pointer.position = left;
				await pointer.show();
				this.recording = true;
				await pointer.moveTo(right, time);
				this.recording = false;
				await pointer.hide();
			}
		}
	}

	async showMessage(text) {
		this.message.innerHTML = text;
		await this.message.show();
	}
	async hideMessage() { await this.message.hide(); }
	async showMessageCountDown(text, count = 3) {
		let textf = (i) => text.replace("$$", i)
		this.message.innerHTML = textf("&nbsp;");
		await this.message.show();
		for (let i = count; i > 0; i--) {
			this.message.innerHTML = textf(i);
			await delay(1000);
		}
		await this.message.hide();
	}

	async calibrate_rradjusted() {
		await this.showMessageCountDown("Keeping your head steady,<br/>focus on the red dot<br/>as it moves along the screen.<br/>$$");
		this.sample_method = "steady";
		await this.calibrate_scan(4, 4000);
		await this.showMessageCountDown("This time move your <br/> head around and <br/>focus on the red dot<br/>as it moves along the screen.<br/>$$");
		this.sample_method = "moving";
		await this.calibrate_scan(4, 4000);
	}
	
	async calibrate_rrcombined() {
		await this.showMessageCountDown("Move your <br/> head around and <br/>focus on the red dot<br/>as it moves along the screen.<br/>$$");
		this.sample_method = "moving";
		await this.calibrate_scan(5, 3000);
	}

	async calibrate() {
		await this.calibrate_rradjusted();
		await this.showMessage("Calibrating eye tracking...");
		let error = Algorithm.trainModel();
		this.std = error[0].validation.std.norm();
		await this.hideMessage();
		
	}

	async show_results(std = this.std){
		await this.showMessage(`Model Accuracy ${Math.round(100 - 2 * std * 100)}%`);
		await delay(3000);
		await this.hideMessage();
	}



	async show(duration, hide) {
		if (!hide) {
			this.styles = {
				"cursor": "none",
				display: null,
			}
		}
		await super.show(duration, hide);
		if (hide) {
			this.styles = {
				"cursor": null,
				display: "none"
			}
		}
	}
}

export { CalibrationFrame }
