const fs = require('fs')
const { createCanvas, Image } = require('canvas')
const webp = require('webp-wasm')

const JACKETS_PATH = "../jacket"
const jackets = fs.readdirSync(JACKETS_PATH).filter(j=>!j.startsWith('c_') && /\.(png|jpg|jpeg|dds)$/.test(j)) // Filter out courses and any non-image files (such as .DS_Store)
const JACKET_SIZE = 192
const WEBP_QUALITY = 70

const cvs = createCanvas(JACKET_SIZE, JACKET_SIZE)
const ctx = cvs.getContext('2d')

jackets.map((jacketFileName, idx) => {
  const jacketName = jacketFileName.split('_jk')[0]
  const img = new Image()
  img.onload = () => {
    ctx.drawImage(img, 0, 0, JACKET_SIZE, JACKET_SIZE)
    const imgData = ctx.getImageData(0,0,JACKET_SIZE,JACKET_SIZE)

    webp.encode(imgData, {
      quality: WEBP_QUALITY
    }).then(webpBuffer => {
      fs.writeFileSync(`../preview${JACKET_SIZE}px/${jacketName}.webp`, Buffer.from(webpBuffer))
      console.log(`Saved ${jacketName}.webp (${WEBP_QUALITY}% quality) successfully`)
    }).catch(e => {
      console.error(`Error saving .webp (${e})`)
    })
  }
  img.src = `${JACKETS_PATH}/${jacketFileName}`
})