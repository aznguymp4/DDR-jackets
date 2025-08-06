const fs = require('fs')
const { createCanvas, Image, registerFont } = require('canvas')
const wrap = require('./dependencies/wordWrap.js')
const translatedTitles = require('./translated.json') // Extracted from 3icecream
const splitBPMdata = require('./splitBPM.json')

// for (const basename in translatedTitles) {
// 	const d = translatedTitles[basename]
// 	console.log([
// 		basename,
// 		d.song_id,
// 		d.song_name,
// 		d.romanized_name,
// 		d.translated_name,
// 		d.alternate_name,
// 		d.searchable_name
// 	].join('|').replace(/\n/g,''))
// }

registerFont('C:/Windows/Fonts/BIZ-UDGothicB.ttc', {family: 'UDGothic'})

const JACKETS_PATH = "../jacket"
const JACKET_SIZE = 248 // Direct3D requires BC image to be multiple of 4 in width & height
const jackets = fs.readdirSync(JACKETS_PATH).filter(j=>!j.startsWith('c_') && /\.(png|jpg|jpeg|dds)$/.test(j)) // Filter out courses and any non-image files (such as .DS_Store)
const formatMilliseconds = ms =>`${Math.floor(ms / 60000)}:${(Math.floor((ms % 60000) / 1000)).toString().padStart(2, '0')}`
const longSongLabel = '(LONG)'
const diffColors = {
	BEG:'#2edbff',
	BAS:'#ffae00',
	DIF:'#ff384f',
	EXP:'#39ec28',
	CHA:'#e900ff',
	BEGpastel:'#8CD8FF',
	BASpastel:'#FFEB7F',
	DIFpastel:'#FF8C9B',
	EXPpastel:'#9AFF8E',
	CHApastel:'#F38CFF',
}
diffColors.bSP = diffColors.BEG
diffColors.BSP = diffColors.BAS
diffColors.DSP = diffColors.DIF
diffColors.ESP = diffColors.EXP
diffColors.CSP = diffColors.CHA
diffColors.bDP = diffColors.BEG
diffColors.BDP = diffColors.BAS
diffColors.DDP = diffColors.DIF
diffColors.EDP = diffColors.EXP
diffColors.CDP = diffColors.CHA
const diffNames = Object.keys(diffColors)

const keyedRadarVals = {}
const grooveRadarVals = fs.readFileSync('../calcGrooveRadar/values.csv', { encoding: 'utf-8' })
const grooveValArrToObj = arr => {
	const [STREAM,VOLTAGE,AIR,FREEZE,CHAOS,SHOCK] = (arr? arr : '0 0 0 0 0 0').split(' ').map(x=>parseInt(x))
	return { STREAM, VOLTAGE, AIR, FREEZE, CHAOS, SHOCK }
}
grooveRadarVals.split('\n').map((row,idx) => {
	if(idx === 0) return
	let [basename,songLengthMs,bSP,BSP,DSP,ESP,CSP,bDP,BDP,DDP,EDP,CDP] = row.split(',')
	bSP = grooveValArrToObj(bSP)
	BSP = grooveValArrToObj(BSP)
	DSP = grooveValArrToObj(DSP)
	ESP = grooveValArrToObj(ESP)
	CSP = grooveValArrToObj(CSP)
	bDP = grooveValArrToObj(bDP)
	DDP = grooveValArrToObj(DDP)
	BDP = grooveValArrToObj(BDP)
	EDP = grooveValArrToObj(EDP)
	CDP = grooveValArrToObj(CDP)
	const hasShocks = [bSP,BSP,DSP,ESP,CSP,bDP,BDP,DDP,EDP,CDP].some(r=>r.SHOCK)
	keyedRadarVals[basename] = {
		songLengthMs,hasShocks,
		bSP,BSP,DSP,ESP,CSP,bDP,BDP,DDP,EDP,CDP
	}
})
const drawMultiColorTextCentered = (ctx, textSegments, x, y, maxWidth) => {
	ctx.save()
	let currentX = x+0;
	ctx.textAlign = 'left'

	const totalWidth = ctx.measureText(textSegments.map(s=>s.text).join('')).width
	currentX -= maxWidth? Math.min(maxWidth,totalWidth)/2 : totalWidth/2
	textSegments.map(segment => {
		const segmentWidth = ctx.measureText(segment.text).width
		const actualSegmentWidth = Math.min(segmentWidth,segmentWidth*(maxWidth/totalWidth))
		ctx.fillStyle = segment.fillStyle
		ctx.fillText(segment.text, currentX, y, actualSegmentWidth)
		currentX += actualSegmentWidth;
	});

	ctx.restore()
}

const toGenerateTotal = Object.keys(keyedRadarVals).length
const shockIcon = new Image()
shockIcon.onload = () => {
	let generated = 0
	jackets
	.filter(j=>j.startsWith('zatt'))
	// .filter(j=>splitBPMdata[j.split('_jk')[0]])
	// .filter(j=>translatedTitles[j.split('_jk')[0]])
	// .filter(j=>translatedTitles[j.split('_jk')[0]]?.caption)
	// .filter(j=>translatedTitles[j.split('_jk')[0]]?.romanized_name?.length > 28)
	.map(jacketFileName => {
		const basename = jacketFileName.split('_jk')[0]
		const grooveData = keyedRadarVals[basename]
		if(!grooveData) return;
		const romanized = translatedTitles[basename]
		const splitBPM = splitBPMdata[basename]
		const lenStr = formatMilliseconds(grooveData.songLengthMs)
		const isLongSong = grooveData.songLengthMs > 150_000
		const shrinkJacket = Boolean(splitBPM && romanized)

		const cvs = createCanvas(JACKET_SIZE, JACKET_SIZE)
		const ctx = cvs.getContext('2d')

		const jacket = new Image()
		jacket.onload = () => {
			
			if(romanized || splitBPM) { // Subtitle under jacket thumbnail
				ctx.fillStyle = '#000'
				ctx.fillRect(0, 164, 192, 62)
			}
			if(romanized) { // Translated title (if available)
				const title = romanized.translated_name || romanized.romanized_name || ''
				const caption = romanized.caption
				ctx.textAlign = 'center'
				ctx.fillStyle = romanized.caption? '#ff0':'#0ff'
				const fontSize =
					(title+caption).length>40 ? 12 :
					(title+caption).length>30 ? 14 :
					(title+caption).length>25 ? 15 :
					(title+caption).length>20 ? 16 :
														18
				ctx.font = `bold ${fontSize}px FullerSansDT, Segoe UI`
				const titleLines = wrap(ctx, title, ctx.font, 192, {lineClamp: 2})
				const wrappedLines = caption
				? titleLines.concat(caption)
				: titleLines
				
				if(wrappedLines.length===1) {
					ctx.textBaseline = 'middle'
					ctx.fillText(
						wrappedLines.join(''),
						96,
						207 - (splitBPM?28:0),
						192
					)
				} else {
					ctx.textBaseline = 'alphabetic'
					ctx.fillStyle = romanized.caption && !title? '#ff0':'#0ff'
					ctx.fillText(wrappedLines[0], 96, 203 - (splitBPM?25:0), 192)
					ctx.fillStyle = romanized.caption? '#ff0':'#0ff'
					ctx.textBaseline = 'top'
					ctx.fillText(wrappedLines[1], 96, 202.5 - (splitBPM?25:0), 192)
				}
			}

			ctx.textBaseline = 'alphabetic'

			if(splitBPM) {
				ctx.textAlign = 'center'
				ctx.fillStyle = '#fff'
				ctx.font = 'bold 10.5px Sans'
				ctx.fillText('Split', 16, 202)
				ctx.font = 'bold 14px Sans'
				ctx.fillText('BPM', 16, 215)

				const uniqueTruthyDisplayBPMs = new Set(splitBPM.filter(Boolean).map(b=>Array.isArray(b)?b.join(','):b)).size

				const uniqueDisplayBPMs = {}
				splitBPM.map((b,idx) => {
					if(b===null) return;
					const key = Array.isArray(b)?b.join('-'):b.toString()
					const diff = diffNames[idx]
					if(uniqueDisplayBPMs[key]) uniqueDisplayBPMs[key].push(diff)
					else uniqueDisplayBPMs[key] = [diff]
				})

				Object.keys(uniqueDisplayBPMs).map((dispBPM,idx) => {
					const diffs = uniqueDisplayBPMs[dispBPM]
					ctx.font = 'bold 9.5px Sans'
					const columnWidth = 195/(uniqueTruthyDisplayBPMs+1)
					const xPos = 14+(columnWidth*(idx+1))
					// ctx.fillText(diffs.join(','), xPos, 205, columnWidth-1)
					// fillMixedText(ctx, diffs.map(diff => ({
					// 	text: diff,
					// 	fillStyle: diffColors[diff]
					// })), xPos, 205)
					drawMultiColorTextCentered(ctx, diffs.map(diff => ({text:diff,fillStyle:diffColors[diff]})), xPos, 200, columnWidth-4)

					ctx.font = 'bold 16px Sans'
					if(diffs.length === 1) {
						ctx.fillStyle = diffColors[`${diffs[0]}pastel`]
					} else {
						// const gradient = ctx.createLinearGradient(xPos-(columnWidth/2),206,xPos+(columnWidth/2),214)
						const gradient = ctx.createLinearGradient(xPos-(columnWidth/2),203,xPos-(columnWidth/2),213)
						diffs.map((diff,idx) => {
							gradient.addColorStop(idx/(diffs.length-1), diffColors[`${diff}pastel`])
						})
						ctx.fillStyle = gradient
					}

					if(Array.isArray(dispBPM)) {
						ctx.fillText(dispBPM.join('-'), xPos, 214, columnWidth-1)
					} else {
						ctx.fillText(dispBPM, xPos, 214, columnWidth-1)
					}
				})
			}

			// Song length
			ctx.fillStyle = isLongSong? '#ed4245' : '#fff'
			ctx.strokeStyle = isLongSong? '#fff' : '#000'
			ctx.textAlign = 'center'
			ctx.lineJoin = 'round'
			ctx.lineWidth = 4
			{
				const xPos = shrinkJacket? 207 : 215
				if(isLongSong) {
					ctx.font = 'bold 14px Sans'
					ctx.strokeText(longSongLabel, xPos, 142)
					ctx.fillText(longSongLabel, xPos, 142)
				}
				ctx.font = 'semibold 18px Sans'
				ctx.strokeText(lenStr, xPos, 130)
				ctx.fillText(lenStr, xPos, 130)
			}
	
			// Jacket
			if(shrinkJacket) {
				ctx.drawImage(jacket, 14, 0, 164, 164)
			} else {
				ctx.drawImage(jacket, 0, 0, 192, 192)
			}
			
			// Shock Arrow indicator
			if(grooveData.hasShocks) {
				Object.keys(diffColors).map((diff,idx) => { // Show which difficulties have shock arrows (applies to both SP and DP)
					if(!grooveData[diff] || !grooveData[diff].SHOCK) return;
					ctx.fillStyle = diffColors[diff]
					ctx.beginPath()
					ctx.arc(197, 65+((idx%5)*9), 4, 0, 2*Math.PI)
					ctx.fill()
				})
				ctx.drawImage(shockIcon, 195, 50) // Shock arrow icon
			}

			console.log(`Generated thumbnail ${basename.padEnd(5,' ')}!  -  (${((++generated/toGenerateTotal)*100).toFixed(2)}% | ${generated}/${toGenerateTotal})`)
			fs.writeFile(`../previewIngame/png/${basename}_tn.png`, cvs.toBuffer(), (err)=>{
				if(!err) return
				console.error('🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴---ERROR---'+err)
			})
		}
		jacket.src = `${JACKETS_PATH}/${jacketFileName}`
	})
}
shockIcon.src = './newShockIcon.png'