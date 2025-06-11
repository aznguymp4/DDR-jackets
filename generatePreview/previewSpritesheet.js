const fs = require('fs')
const { createCanvas, Image } = require('canvas')
const webp = require('webp-wasm')

const JACKETS_PATH = "../jacket"
const jackets = fs.readdirSync(JACKETS_PATH).filter(j=>!j.startsWith('c_') && /\.(png|jpg|jpeg|dds)$/.test(j)) // Filter out courses and any non-image files (such as .DS_Store)
const GAP = 0
const JACKET_SIZE = 115
// const WEBP_QUALITY = 100 // quality percentage; int from 0-100
const SIZEwGAP = (JACKET_SIZE+GAP)
const SPRITESHEET_WIDTH = SIZEwGAP*50

const cvs = createCanvas(SPRITESHEET_WIDTH, SPRITESHEET_WIDTH*2)
const ctx = cvs.getContext('2d')
ctx.fillStyle = '#000'
ctx.fillRect(0,0,SPRITESHEET_WIDTH,SPRITESHEET_WIDTH*2)

const coords = {}
let loaded = 0
let SPRITESHEET_HEIGHT = 0
jackets.map((jacketFileName, idx) => {
  const jacketName = jacketFileName.split('_jk')[0]
  const posX = (idx*SIZEwGAP) % SPRITESHEET_WIDTH
  const posY = (~~((idx*SIZEwGAP) / SPRITESHEET_WIDTH)) * SIZEwGAP
  SPRITESHEET_HEIGHT = Math.max(SPRITESHEET_HEIGHT, posY + JACKET_SIZE)

  coords[jacketName] = [posX,posY]
  const img = new Image()
  img.onload = () => {
    ctx.drawImage(img, posX, posY, JACKET_SIZE, JACKET_SIZE)
    loaded ++
    console.log(loaded, 'loaded',jacketFileName)

    if(loaded === jackets.length) {
      const cropped = createCanvas(SPRITESHEET_WIDTH, SPRITESHEET_HEIGHT)
      const ctx2 = cropped.getContext('2d')
      ctx2.drawImage(cvs,0,0)
      const imgData = ctx2.getImageData(0,0,SPRITESHEET_WIDTH,SPRITESHEET_HEIGHT)

      for(let WEBP_QUALITY=0;WEBP_QUALITY<=100;WEBP_QUALITY+=25) {
        console.log(`Saving .webp (at ${WEBP_QUALITY}% image quality...)`)
        fs.writeFileSync('./coordinates.json', JSON.stringify(coords))
  
        webp.encode(imgData, {
          quality: WEBP_QUALITY
        }).then(webpBuffer => {
          fs.writeFileSync(`./previewSprite${WEBP_QUALITY}.webp`, Buffer.from(webpBuffer))
          console.log(`Saved .webp (${WEBP_QUALITY}%) successfully`)
        }).catch(e => {
          console.error(`Error saving .webp (${e})`)
        })
      }
    }
  }
  img.src = `${JACKETS_PATH}/${jacketFileName}`
})