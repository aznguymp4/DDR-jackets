// Converted the CsqReader class from this Python script to JS - https://github.com/987123879113/gobbletools/blob/master/other/ddrcharttool.py
// (Entirely converted manually by hand, because f**k using AI to code!!! ✊)
// Also added some extra features such as chart stats and fixed freeze arrow parsing

const chunkTypes = ['','tempo','events','notes','lamps']//,'anim']
const eventLookup = {
	0x0202: 'start', // Displays the "READY?" text at the start of the song
	0x0302: 'end', // End of chart (Chart lane background goes away)
	0x0402: 'clear' // End of song (Shows CLEAR/FAIL)
}
const chartTypeLookup = {
	0x0114: 'BSP',
	0x0214: 'DSP',
	0x0314: 'ESP',
	0x0414: 'bSP',
	0x0614: 'CSP',

	0x0116: 'solo-basic',
	0x0216: 'solo-standard',
	0x0316: 'solo-heavy',
	0x0416: 'solo-beginner',
	0x0616: 'solo-challenge',

	0x0118: 'BDP',
	0x0218: 'DDP',
	0x0318: 'EDP',
	0x0418: 'bDP',
	0x0618: 'CDP',

	0x1024: 'double-battle',

	// 0xF... range is just a hack and not an official chart range
	0xf116: 'solo3-basic',
	0xf216: 'solo3-standard',
	0xf316: 'solo3-heavy',
	0xf416: 'solo3-beginner',
	0xf616: 'solo3-challenge',
}
const noteTypeLookup = {
	SOLO: {
		0x00: 'SOLO L',
		0x01: 'SOLO D',
		0x02: 'SOLO U',
		0x03: 'SOLO R',
		0x04: 'SOLO UL',
		0x06: 'SOLO UR',
	},
	FOURPANEL: {
		0x00: 'P1L',
		0x01: 'P1D',
		0x02: 'P1U',
		0x03: 'P1R',
		0x04: 'P2L',
		0x05: 'P2D',
		0x06: 'P2U',
		0x07: 'P2R',
	}
}

const range = (start, end, step = 1) => {
	const result = []
	for (let i = start; start<end?i<end:i>end; i += step) {
		result.push(i)
	}
	return result
}
const shareAnElement = (arr1, arr2) => {
	return arr1.some(element => arr2.includes(element));
}
const calculateMeasure = tickValue => {
	const measureNum = parseInt(tickValue/4096)
	const subMeasure = (tickValue - (measureNum*4096))/4096
	return [measureNum,subMeasure]
	// Example:
	// [4.0, 0.0]  = Measure 4.00
	// [8.0, 0.25] = Measure 8.25
	// [7.0, 0.50] = Measure 7.50
}
const calculateQuantization = tickValue => {
	switch (tickValue%1024) {
		case 0:
			return 4; // 4th note
		case 512:
			return 8; // 8th note
		case 341:case 682:
			return 12; // 12th note
		case 256:case 768:
			return 16; // 16th note
		case 213:case 405:case 618:case 810:
			return 19.2; // 1/19.2 note (displays as 20th note in ArrowVortex)
		case 170:case 853:
			return 24; // 24th note
		case 128:case 384:case 640:case 896:
			return 32; // 32nd note
		case 85:case 426:case 597:case 938:
			return 48; // 48th note
		case 64: case 192:case 320:case 448:case 576:case 704:case 832:case 960:
			return 64; // 64th note
		case 42: case 298:case 469:case 554:case 725:case 981:
			return 96; // 96th note
		case 21:case 106:case 149:case 234:case 277:case 362:case 405:case 490:
		case 533:case 618:case 661:case 746:case 789:case 874:case 917:case 1002:
			return 192; // 192th note
	}
	return null
}
const getNoteColorValue = quantization => { // Used to calculate CHAOS value on groove radar
	switch (quantization) {
		case 4: return 0;
		case 8: return 0.5;
		case 16: return 1;
		default: return 1.25; // Everything else
	}
}

const measureArrToNumFormat = arr => arr[0]+arr[1] // [80.0, 0.75] => 80.75

class SSQparser {
	constructor(bytes) {
		this.bytes = bytes
		this.bpmList = null
		this.chunks = this.parse()
	}

	sanitizeForExport() {
		const chunks = []

		for(const chunk of this.chunks.slice()) {
			let sanitizedEvents = []

			switch (chunk.type) {
				case chunkTypes[1]: // Tempo
					sanitizedEvents = {
						tickRate: chunk.events.tickRate,
						events: []
					}

					let event;
					for (event of chunk.events.events.sort((a,b)=>a.offsetStart-b.offsetStart)) {
						sanitizedEvents.events.push({
							measure: event.measureStart,
							timestamp: event.timestampStart,
							bpm: event.bpm
						})
					}
					sanitizedEvents.events.push({
						measure: event.measureEnd,
						timestamp: event.timestampEnd,
						bpm: event.bpm
					})
					break;
				case chunkTypes[2]: // Events
				case chunkTypes[4]: // Lamps
					for (const event of chunk.events) {
						sanitizedEvents.push({
							timestamp: event.timestamp,
							measure: event.measure,
							event: event.event
						})
					}
					break;
				case chunkTypes[3]: // Notes
					sanitizedEvents = {
						chartType: chunk.events.chartType,
						stats: chunk.events.stats,
						events: []
					}

					for (const event of chunk.events.events) {
						const sanitized = {
							timestamp: event.timestamp,
							measure: event.measure,
							nthNote: event.quantization,
							notes: event.notes
						}
						if(event.extra) sanitized.extra = event.extra
						sanitizedEvents.events.push(sanitized)
					}
					break;
				default:
					break;
			}

			chunk.events = sanitizedEvents
			chunks.push(chunk)
		}

		return chunks
	}

	calculateTimestamp(value) {
		if(!this.bpmList) return null

		let bpmInfo
		for (bpmInfo of this.bpmList) {
			if(value >= bpmInfo.offsetStart && value < bpmInfo.offsetEnd) break;
		}

		return (bpmInfo.timestampStart + (((value - bpmInfo.offsetStart) / 1024) / bpmInfo.bpm) * 60) * 1000
	}

	getBpm(value) {
		if(!this.bpmList) return null
		
		let bpmInfo;
		for (bpmInfo of this.bpmList) {
			if(value >= bpmInfo.offsetStart && value < bpmInfo.offsetEnd) break;
		}
		return bpmInfo
	}

	parse() {
		let bytes = this.bytes
		const chunks = []

		while (bytes) {
			const chunkLength = bytes.readUInt32LE()
			if(bytes.length-4 <= 0) break;
			
			const chunkType = bytes.readUInt16LE(4)
			const typeStr = chunkTypes[chunkType]
			const chunkRaw = bytes.slice(6, chunkLength)
			bytes = bytes.slice(chunkLength)

			if(!typeStr) continue
			chunks.push({
				type: typeStr,
				_raw: chunkRaw
			})
		}

		let bpmChunk = null
		for (const chunk of chunks) {
			if(chunk.type === chunkTypes[1]) {
				chunk.events = this.parseTempoChunk(chunk._raw)
				bpmChunk = Object.assign(Object.create(Object.getPrototypeOf(chunk)), chunk)
			}
		}

		if(!bpmChunk) throw new Error("BPM chunk was not found.");
		this.bpmList = bpmChunk.events.events

		for (const chunk of chunks) {
			if(chunk.type === chunkTypes[5]) continue;
			switch (chunk.type) {
				case chunkTypes[1]:
					chunk.events = this.parseTempoChunk(chunk._raw)
					break;
				case chunkTypes[2]:
					chunk.events = this.parseEventsChunk(chunk._raw)
					break;
				case chunkTypes[3]:
					chunk.events = this.parseNoteEventsChunk(chunk._raw)
					break;
				case chunkTypes[4]:
					chunk.events = this.parseLampEventsChunk(chunk._raw)
					break;
				default:
					break;
			}

			delete chunk._raw
		}
		return chunks
	}

	parseTempoChunk(bytes) {
		const tickRate = bytes.readUInt16LE()
		const count = bytes.readUInt16LE(2)
		if(bytes.readUInt16LE(4) !== 0) throw new Error("Cannot parse tempo chunk");
		
		const timeOffsets = range(0,count).map(x => bytes.readInt32LE(6+x*4, 6+(x+1)*4))
		const timeData = range(count,count*2).map(x => bytes.readInt32LE(6+x*4, 6+(x+1)*4))
		const sampleRate = 294*tickRate

		const bpmChanges = []
		for (let i=1;i<count;i++) {
			const timestampStart = timeData[i-1] / tickRate
			const timestampEnd = timeData[i] / tickRate
			const timeDelta = (timestampEnd - timestampStart) * 1000
			const offsetDelta = timeOffsets[i] - timeOffsets[i-1]
			const bpm = offsetDelta===0
			? 0
			: 60000 / (timeDelta/(offsetDelta/1024))
			bpmChanges.push({
				offsetStart: timeOffsets[i-1],
				offsetEnd: timeOffsets[i],
				measureStart: calculateMeasure(timeOffsets[i-1]),
				measureEnd: calculateMeasure(timeOffsets[i]),
				dataStart: timeData[i-1],
				dataEnd: timeData[i],
				timestampStart, timestampEnd, bpm
			})
		}
		return {
			tickRate, events: bpmChanges
		}
	}

	parseEventsChunk(bytes) {
		if(
			(bytes.readUInt16LE() !== 1)
		|| (bytes.readUInt16LE(4) !== 0)
		) throw new Error("Cannot parse events chunk")

		const count = bytes.readInt16LE(2)
		const eventOffsets = range(0,count).map(x => bytes.readInt32LE(6+x*4, 6+(x+1)*4))
		const eventData = range(0,count).map(x => bytes.readUInt16LE(6+(count*4)+x*2, 6+(count*4)+(x+1)*2))

		const events = []
		for (let i=1;i<count;i++) {
			events.push({
				offset: eventOffsets[i],
				measure: calculateMeasure(eventOffsets[i]),
				timestamp: this.calculateTimestamp(eventOffsets[i]),
				bpm: this.getBpm(eventOffsets[i]),
				event: eventLookup[eventData[i]] || eventData[i]
			})
		}
		return events
	}

	parseNoteEventsChunk(bytes) {
		const clamp = (val, bound) => {
			if ((val % bound) === 0) return val
			return val + (bound - (val % bound))
		}

		const chartDiffCode = bytes.readUInt16LE()
		const count = bytes.readUInt16LE(2)
		if(bytes.readUInt16LE(4) !== 0) throw new Error("Cannot parse note events chunk");
		
		const chartType = chartTypeLookup[chartDiffCode] || chartDiffCode
		const stats = {
			notes: 0,     // Note count (jumps count as 2 notes)
			steps: 0,     // Step count (jumps count as 1 step)
			shocks: 0,    // Shock arrows
			jumps: 0,     // Simultaneous arrows
			freeze: 0,    // amount of "freezeStart"s
			freezeLen: 0, // total length (in beats) of all freeze arrows
		}

		const eventOffsets = range(0,count).map(x => bytes.readInt32LE(6+x*4, 6+(x+1)*4))
		let eventData = bytes.slice(6+(count*4), clamp(6+(count*4)+count, 2))
		let eventExtraData = bytes.slice(clamp(6+(count*4)+count, 2))
		
		let events = []
		for (const offset of eventOffsets) {
			const event = {
				offset,
				measure: calculateMeasure(offset),
				quantization: calculateQuantization(offset),
				timestamp: this.calculateTimestamp(offset),
				bpm: this.getBpm(offset)
			}
			
			let noteRaw = eventData[0]
			eventData = eventData.slice(1)

			if(noteRaw === 0) {
				noteRaw = eventExtraData[0]
				const extraType = eventExtraData[1]
				eventExtraData = eventExtraData.slice(2)

				if((extraType & 1) !== 0) { event.extra = ['freezeEnd']; stats.steps-- }
				if((extraType &~1) !== 0) throw new Error(`Unknown extra event: ${extraType}`);
			}

			const notes = []
			switch (noteRaw) {
				case 0b11111111: stats.shocks++; notes.push('FULL SHOCK'); break;
				case 0b00001111: stats.shocks++; notes.push('P1 SHOCK'); break;
				case 0b11110000: stats.shocks++; notes.push('P2 SHOCK'); break;
				default:
					for (let i=0;i<8;i++) {
						if((noteRaw & (1<<i)) !== 0) {
							notes.push(noteTypeLookup[chartType.includes('solo')?'SOLO':'FOURPANEL'][i])
							stats.notes++
							if(notes.length>=2) stats.jumps++
						}
					}
					break;
			}
			stats.steps++
			event.notes = notes
			events.push(event)
		}

		events = events.sort((a,b) => a.offset - b.offset)
		iterateEvents: for (let i=0;i<events.length;i++) {
			const event = events[i]
			if(Array.isArray(event.extra) && event.extra.includes('freezeEnd')) {
				findFreezeStart: for (const x of range(i-1,-1,-1)) {
					if(shareAnElement(event.notes, events[x].notes)) {
						const freezeStartStr = `freezeStart-${event.notes.filter(n=>event.notes.includes(n) && events[x].notes.includes(n)).join(',')}`
						if(Array.isArray(events[x].extra)) {events[x].extra = events[x].extra.concat([freezeStartStr])}
						else {events[x].extra = [freezeStartStr]}

						stats.freeze++
						break findFreezeStart;
					}
				}
			}
		}
		const idxPaired = events.sort((a,b)=>{a.timestamp-b.timestamp}).map((event,idx) => ({idx,event}))
		iterateFreezeStarts: for (const pairedFreezeStartEvent of idxPaired.filter(e=>e.event.extra?.some(f=>f.startsWith('freezeStart')))) {
			const {idx} = pairedFreezeStartEvent
			const freezeStartEvent = pairedFreezeStartEvent.event
			const notesUnderThisFreeze = new Set(freezeStartEvent.extra.map(e=>e.split('-')[1]))

			let len = 0;
			findEndOfThisFreeze: for(let i=+idx;i<idxPaired.length;i++) {
				const freezeEndEvent = idxPaired[i].event
				if (freezeEndEvent.extra?.includes('freezeEnd') && freezeEndEvent.notes.some(n=>notesUnderThisFreeze.has(n))) {
					freezeEndEvent.notes.map(n=>notesUnderThisFreeze.delete(n))
					if(!notesUnderThisFreeze.size) { // All notes under this freeze section has completed, so NOW we can tally its length.
						len = Math.abs(measureArrToNumFormat(freezeEndEvent.measure) - measureArrToNumFormat(freezeStartEvent.measure))
						break findEndOfThisFreeze;
					}
				}
			}
			stats.freezeLen += len*4
		}

		return { chartType, stats, events }
	}

	parseLampEventsChunk(bytes) {
		if(
			(bytes.readUInt16LE() !== 1)
		|| (bytes.readUInt16LE(4) !== 0)
		) throw new Error("Cannot parse lamp events chunk")
		
		const count = bytes.readInt16LE(2)
		const eventOffsets = range(0,count).map(x => bytes.readInt32LE(6+x*4, 6+(x+1)*4))
		const eventData = range(0,count).map(x => bytes[6+(count*4)+x])

		const events = []
		for (let i=1;i<count;i++) {
			events.push({
				offset: eventOffsets[i],
				measure: calculateMeasure(eventOffsets[i]),
				timestamp: this.calculateTimestamp(eventOffsets[i]),
				bpm: this.getBpm(eventOffsets[i]),
				event: eventData[i]
			})
		}
		return events
	}
}

module.exports = { SSQparser, getNoteColorValue, measureArrToNumFormat }