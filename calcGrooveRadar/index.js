// Scan all .ssq files in a directory,
// calculate the groove radar values for each difficulty (both SP and DP),
// and then export it to values.csv
//
// NOTE: This is primarily for .ssq files made for DDR A and later. The .ssq file type is very old and has been used since DDR 4thMIX, and older .ssq files are untested so they may not work with this script.

const { SSQparser, getNoteColorValue, measureArrToNumFormat } = require('./class/SSQparser')
const { readdirSync, readFile, writeFileSync } = require('fs')
const { join } = require('path')
const arrFindObj = (arr,key,val) => arr.find(x=>x[key]===val)
const getBasenameFromFilename = fileName => fileName.match(/[a-z0-9]{4,5}/)[0]

const difficulties = {
	bSP: 0x0414, // Single - Beginner
	BSP: 0x0114, // Single - Basic (aka Light)
	DSP: 0x0214, // Single - Difficult (aka Standard)
	ESP: 0x0314, // Single - Expert (aka Heavy)
	CSP: 0x0614, // Single - Challenge
	bDP: 0x0418, // Double - Beginner
	BDP: 0x0118, // Double - Basic (aka Light)
	DDP: 0x0218, // Double - Difficult (aka Standard)
	EDP: 0x0318, // Double - Expert (aka Heavy)
	CDP: 0x0618  // Double - Challenge
}
class RadarData {
	constructor() {
		this._STREAM = 0
		this._VOLTAGE = 0
		this._AIR = 0
		this._FREEZE = 0
		this._CHAOS = 0
		this._customStatSHOCK = 0
	}
	toStr() {
		const str = [ this._STREAM,this._VOLTAGE,this._AIR,this._FREEZE,this._CHAOS,this._customStatSHOCK ].join(' ')
		return str==='0 0 0 0 0 0'?'':str
	}
	/** @param {int} val */ set STREAM(val)  {this._STREAM = val}          get STREAM()  {return this._STREAM}
	/** @param {int} val */ set VOLTAGE(val) {this._VOLTAGE = val}         get VOLTAGE() {return this._VOLTAGE}
	/** @param {int} val */ set AIR(val)     {this._AIR = val}             get AIR()     {return this._AIR}
	/** @param {int} val */ set FREEZE(val)  {this._FREEZE = val}          get FREEZE()  {return this._FREEZE}
	/** @param {int} val */ set CHAOS(val)   {this._CHAOS = val}           get CHAOS()   {return this._CHAOS}
	/** @param {int} val */ set SHOCK(val)   {this._customStatSHOCK = val} get SHOCK()   {return this._customStatSHOCK}
}

class SongRadars {
	constructor(basename, songLengthMs=0) {
		this._basename = basename
		this._songLengthMs = songLengthMs
		this._bSP = new RadarData(); this._bDP = new RadarData();
		this._BSP = new RadarData(); this._BDP = new RadarData();
		this._DSP = new RadarData(); this._DDP = new RadarData();
		this._ESP = new RadarData(); this._EDP = new RadarData();
		this._CSP = new RadarData(); this._CDP = new RadarData();
	}
	toStr() {
		return [
			this._basename,
			Math.round(this._songLengthMs),
			this._bSP.toStr(),this._BSP.toStr(),this._DSP.toStr(),this._ESP.toStr(),this._CSP.toStr(),
			this._bDP.toStr(),this._BDP.toStr(),this._DDP.toStr(),this._EDP.toStr(),this._CDP.toStr()
		].join(',').replace(/(Infinity|NaN)/g,'0')
	}

	/** @param {int} ms */ set songLengthMs(ms) {this._songLengthMs = ms}
	/** @param {string} bn */ set basename(bn) {this._basename = bn}
	get songLengthMs() {return this._songLengthMs}
	get basename() {return this._basename}

	get bSP() {return this._bSP} get bDP() {return this._bDP}
	get BSP() {return this._BSP} get BDP() {return this._BDP}
	get DSP() {return this._DSP} get DDP() {return this._DDP}
	get ESP() {return this._ESP} get EDP() {return this._EDP}
	get CSP() {return this._CSP} get CDP() {return this._CDP}

	/** @param {RadarData} bn */ set bSP(rd) {this._bSP = rd} /** @param {RadarData} bn */ set bDP(rd) {this._bDP = rd}
	/** @param {RadarData} bn */ set BSP(rd) {this._BSP = rd} /** @param {RadarData} bn */ set BDP(rd) {this._BDP = rd}
	/** @param {RadarData} bn */ set DSP(rd) {this._DSP = rd} /** @param {RadarData} bn */ set DDP(rd) {this._DDP = rd}
	/** @param {RadarData} bn */ set ESP(rd) {this._ESP = rd} /** @param {RadarData} bn */ set EDP(rd) {this._EDP = rd}
	/** @param {RadarData} bn */ set CSP(rd) {this._CSP = rd} /** @param {RadarData} bn */ set CDP(rd) {this._CDP = rd}
}

const ssqDir = 'D:/Games/BEMANI/DDR/GitDDR/game_files/contents/data/mdb_apx/ssq'
const SONGS = {}
// SONGS = { <string>"basename" : <SongRadars> ,... }

const csvExportStr = ['basename,songLengthMs,'+Object.keys(difficulties).join(',')]
const files = readdirSync(ssqDir).filter(f=>f.endsWith('.ssq')).sort((a,b) => a.localeCompare(b))

let ssqParseCt = 0
files.map(fileName => {
	const basename = getBasenameFromFilename(fileName)
	SONGS[basename] = new SongRadars(basename)
})
files.map(fileName => {
	const basename = getBasenameFromFilename(fileName)
	const songRadars = SONGS[basename]

	// Start reading SSQ data
	readFile(join(ssqDir,fileName), (err, bytes) => {
		if (err) return console.error("An error occurred:", err)

		const parsed = new SSQparser(bytes)
		const SSQjson = parsed.sanitizeForExport()
		const tempoData = arrFindObj(SSQjson,'type','tempo').events
		const eventData = arrFindObj(SSQjson,'type','events').events

		songRadars.songLengthMs = Math.max(
			songRadars.songLengthMs,
			arrFindObj(eventData,'event','end').timestamp - arrFindObj(eventData,'event','start').timestamp
		)

		const songLengthSec = songRadars.songLengthMs/1000
		const songLengthMeasures = (
			measureArrToNumFormat(arrFindObj(eventData,'event','end').measure)
			- measureArrToNumFormat(arrFindObj(eventData,'event','start').measure)
		)
		const songLengthBeats = songLengthMeasures*4
		
		SSQjson.filter(c=>c.type==='notes').map(noteChunk => {
			const noteEvents = noteChunk.events
			const difficulty = noteEvents.chartType
			if(!difficulties[difficulty]) return
			const stats = noteEvents.stats
			const noteArr = noteEvents.events.sort((a,b)=>a.timestamp-b.timestamp)
			const radarData = songRadars[difficulty]

			/********** STREAM **********/ // Accuracy: 99% ... Peak Step Density calculation isn't always right, but reported value is usually off by ±3 which is good enough.
			const avgStepDensity = Math.floor((60 * (stats.steps + stats.shocks)) / songLengthSec)
			radarData.STREAM = Math.floor(
				avgStepDensity <= 300
				? avgStepDensity / 3
				: difficulty.endsWith('SP')
					? (avgStepDensity - 139) * 100 / 161
					: (avgStepDensity - 183) * 100 / 117
			)
			
			/********** VOLTAGE **********/ // Accuracy: 95% ... Peak Density calculation isn't always right
			const avgBPM = 60 * songLengthBeats / songLengthSec
			let peakDensity = 0; // Most notes in 4 consecutive beats (including shocks)

			const uniqueTimestamps = Array.from(new Set(noteArr.map(e=>e.timestamp))).sort((a,b)=>a-b)
			timestampIterate: for (let idx = 0; idx < uniqueTimestamps.length; idx++) {
				const timestamp = uniqueTimestamps[idx]
				// Sometimes two noteEvents have the same timestamp
				// (when two freeze arrows end at the same time,
				// or when one side has Shock Arrows and the other side has regular notes on Doubles)
				const noteEvent = noteArr.find(n=>n.timestamp === timestamp && !n.extra?.includes('freezeEnd'))
				if(!noteEvent) continue timestampIterate;
				const fromMeasure = measureArrToNumFormat(noteEvent.measure)
				const toMeasure = fromMeasure+1
				
				peakDensity = Math.max(peakDensity,
					noteArr.filter(ne => {
						const measure = measureArrToNumFormat(ne.measure)
						return fromMeasure <= measure && measure < toMeasure
					})
					.map(ne => {
						return ne.extra?.includes('freezeEnd')? 0 : ne.notes.length
					})
					.reduce((a,b)=>a+b,0)
				)
			}
			
			const avgPeakDensity = Math.round((avgBPM * peakDensity) / 4)
			radarData.VOLTAGE = Math.floor(
				avgPeakDensity <= 600
				? avgPeakDensity / 6
				: ((avgPeakDensity+594)*100) / 1194
			)

			/********** AIR **********/ // Accuracy: 99%
			const avgAirDensity = Math.floor(60 * (stats.jumps + stats.shocks) / songLengthSec)
			radarData.SHOCK = stats.shocks+0
			radarData.AIR = Math.floor(
				avgAirDensity <= 55
				? avgAirDensity * 20 / 11
				: difficulty.endsWith('SP')
					? (avgAirDensity + 36) * 100 / 91
					: (avgAirDensity + 35) * 10 / 9
			)

			/********** FREEZE **********/ // Accuracy: 100% !
			const avgFreezeRate = 10000 * stats.freezeLen / songLengthBeats
			radarData.FREEZE = Math.floor(
				avgFreezeRate <= 3500
				? avgFreezeRate / 35
				: difficulty.endsWith('SP')
					? ((avgFreezeRate + 2484) * 100) / 5984
					: ((avgFreezeRate + 2246) * 100) / 5746
			)

			/********** CHAOS **********/ // Accuracy: 90% ... calculation is sometimes perfect, and sometimes not
			const chaosBases = []
			for (let idx = 0; idx < uniqueTimestamps.length; idx++) {
				if(!idx) continue // The first note's Chaos Base Value is always 0 regardless of its color.
				const timestamp = uniqueTimestamps[idx]
				// Sometimes two noteEvents have the same timestamp
				// (when two freeze arrows end at the same time,
				// or when one side has Shock Arrows and the other side has regular notes on Doubles)
				const noteEvents = noteArr.filter(n=>n.timestamp === timestamp && !n.extra?.includes('freezeEnd'))
				if(!noteEvents[0]) continue
				const quantization = noteEvents[0].nthNote
				if(quantization === 4) continue;
				const noteColorValue = getNoteColorValue(quantization)
				const prevTimestamp = uniqueTimestamps[idx-1]
				const prevNoteEvents = noteArr.filter(n=>n.timestamp === prevTimestamp)
				const intervalFromLastNote = (measureArrToNumFormat(noteEvents[0].measure) - measureArrToNumFormat(prevNoteEvents[0].measure)) * quantization
				const arrowCount = (noteEvents.map(noteEvent => noteEvent.notes.map(n=>n==='FULL SHOCK'?8:n.includes('SHOCK')?4:1))).flat().reduce((a,b)=>a+b,0)

				chaosBases.push((quantization / intervalFromLastNote) * noteColorValue * arrowCount)
			}
			const totalChaosBaseValue = chaosBases.reduce((a,b)=>a+b,0)

			let totalBpmDelta = 0;
			let lastBpm

			tempoIterate: for (const tempoEvent of tempoData.events) {
				if(isNaN(tempoEvent.bpm) || !isFinite(tempoEvent.bpm) || tempoEvent.bpm===null) continue tempoIterate
				if(lastBpm === undefined) {
					lastBpm = tempoEvent.bpm
					totalBpmDelta += lastBpm
					continue tempoIterate
				}
				const [lowerBpm,higherBpm] = [Math.min(lastBpm,tempoEvent.bpm),Math.max(lastBpm,tempoEvent.bpm)]
				const changeFactor = higherBpm/lowerBpm
				// e.g.
				// 180/90  = 2.0   (the drasticness of the bpm change was ±100%; very noticable)
				// 180/120 = 1.50  (the drasticness of the bpm change was ±50%; somewhat noticable)
				// 180/170 ≈ 1.059 (the drasticness of the bpm change was ±5.9%; not easily noticable)

				if(changeFactor > 1.5) {
					totalBpmDelta += lastBpm
				}
				lastBpm = tempoEvent.bpm
			}
			totalBpmDelta += (tempoData.events.slice(-1)[0].bpm/2)

			const avgBPMdelta = (60 * totalBpmDelta) / songLengthSec
			const chaosDegree = totalChaosBaseValue * (1 + (avgBPMdelta / 1500))
			const unitChaosDegree = chaosDegree * 100 / songLengthSec
			radarData.CHAOS = Math.floor(
				unitChaosDegree <= 2000
				? unitChaosDegree / 20
				: difficulty.endsWith('SP')
					? (unitChaosDegree + 21605) * 100 / 23605
					: (unitChaosDegree + 16628) * 100 / 18628
			)
			
			songRadars[difficulty] = radarData
			SONGS[basename] = songRadars
			// console.log(songRadars, fileName)
		})

		// writeFileSync(`./${basename}.json`, JSON.stringify(SSQjson,null,4))

		ssqParseCt++
		console.log(`(${ssqParseCt}/${files.length}) Parsed ${basename.padEnd(5,' ')} !`)
		SONGS[basename] = songRadars
		if(ssqParseCt === files.length) { // Reached end of array (doing this in case of async reading issues)
			for (const basename in SONGS) {
				csvExportStr.push(SONGS[basename].toStr())
			}

			writeFileSync('./values.csv', csvExportStr.join('\n'))
		}
	})
})