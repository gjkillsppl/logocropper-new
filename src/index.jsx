import React, { useState, useCallback } from 'react'
import ReactDOM from 'react-dom'
import Slider from '@material-ui/core/Slider'
import Cropper from 'react-easy-crop'
import './styles.css'

// Helper function to create an image element from a URL
const createImage = (url) => {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', (error) => reject(error))
    image.src = url
  })
}

// Function to get the cropped image, accounting for zoom and circular cropping with transparency
const getCroppedImg = async (imageSrc, croppedAreaPixels) => {
  const image = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  // Adjust canvas dimensions to cropped area size
  canvas.width = croppedAreaPixels.width
  canvas.height = croppedAreaPixels.height

  // Step 1: Create a circular clipping mask
  ctx.beginPath()
  ctx.arc(
    croppedAreaPixels.width / 2,
    croppedAreaPixels.height / 2,
    croppedAreaPixels.width / 2,
    0,
    2 * Math.PI
  )
  ctx.clip() // Apply the circular clipping

  // Step 2: Fill the inside of the circle with white background
  ctx.fillStyle = 'white'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // Step 3: Draw the cropped image inside the circle
  const scaleX = image.naturalWidth / image.width
  const scaleY = image.naturalHeight / image.height

  ctx.drawImage(
    image,
    croppedAreaPixels.x * scaleX,
    croppedAreaPixels.y * scaleY,
    croppedAreaPixels.width * scaleX,
    croppedAreaPixels.height * scaleY,
    0,
    0,
    croppedAreaPixels.width,
    croppedAreaPixels.height
  )

  // Step 4: Convert the canvas to a PNG Blob and return the URL for download
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        console.error('Canvas is empty')
        return
      }
      const croppedImageUrl = URL.createObjectURL(blob)
      resolve({ blob, croppedImageUrl })
    }, 'image/png') // Save as PNG for transparency support
  })
}

// Imgur Upload Function
const uploadToImgur = async (imageBlob) => {
  const formData = new FormData()
  formData.append('image', imageBlob)

  const response = await fetch('https://api.imgur.com/3/image', {
    method: 'POST',
    headers: {
      Authorization: 'Client-ID 358c43565a19dbf', // Replace with your Imgur Client ID
    },
    body: formData,
  })

  const result = await response.json()
  if (result.success) {
    return result.data.link // This is the URL of the uploaded image
  } else {
    throw new Error('Imgur upload failed')
  }
}

function App() {
  const [imageSrc, setImageSrc] = useState(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [minZoom, setMinZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)
  const [downloadStarted, setDownloadStarted] = useState(false)
  const [croppingInProgress, setCroppingInProgress] = useState(false)
  const [imgurUrl, setImgurUrl] = useState(null) // To store Imgur URL
  const [croppedImageUrl, setCroppedImageUrl] = useState(null) // To store cropped image URL
  const [loading, setLoading] = useState(false) // To track if the upload is in progress

  const onCropChange = (crop) => {
    setCrop(crop)
  }

  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }, [])

  const onZoomChange = (zoom) => {
    setZoom(zoom)
  }

  // Properly set initial zoom to allow breathing space and repositioning
  const onImageLoad = (image) => {
    const aspectRatio = image.naturalWidth / image.naturalHeight
    const containerAspect = 1

    let fittingZoom
    if (aspectRatio > containerAspect) {
      fittingZoom = containerAspect / aspectRatio // Fit horizontally
    } else {
      fittingZoom = 1 // Fit vertically
    }

    const initialZoom = fittingZoom * 0.8 // Allow breathing room
    setZoom(initialZoom)
    setMinZoom(initialZoom) // Set the minimum zoom
    setCrop({ x: 0, y: 0 }) // Center the crop
  }

  const onFileChange = async (e) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onloadend = () => {
        setImageSrc(reader.result)
        setDownloadStarted(false)
        setCroppingInProgress(true)
      }
    }
  }

  const handleCropImage = async () => {
    if (imageSrc && croppedAreaPixels) {
      setLoading(true) // Disable UI during cropping

      const { blob, croppedImageUrl } = await getCroppedImg(
        imageSrc,
        croppedAreaPixels
      )
      setCroppedImageUrl(croppedImageUrl) // Store cropped image URL for download

      try {
        const imgurUrl = await uploadToImgur(blob)
        setImgurUrl(imgurUrl) // Store Imgur URL
        setDownloadStarted(true)
        setCroppingInProgress(false) // Hide the cropper

        // Trigger confetti when the crop is complete
        window.confetti({
          particleCount: 500,
          spread: 180,
          startVelocity: 60,
          origin: { x: Math.random(), y: -0.2 },
          decay: 0.85,
          gravity: 1.2,
          ticks: 1000,
        })
      } catch (error) {
        alert('Failed to upload image to Imgur')
      } finally {
        setLoading(false) // Enable UI again
      }
    }
  }

  const handleCancel = () => {
    setImageSrc(null)
    setCroppingInProgress(false)
    setDownloadStarted(false)
  }

  const handleUploadAnother = () => {
    setImageSrc(null)
    setDownloadStarted(false)
    setCroppingInProgress(false)
    setImgurUrl(null)
    setCroppedImageUrl(null)
  }

  // Copy the Imgur URL to clipboard
  const handleCopyUrl = () => {
    navigator.clipboard.writeText(imgurUrl)
    alert('Logo URL copied to clipboard!')
  }

  return (
    <div className="App">
      <div className="page-container">
        {!croppingInProgress && !downloadStarted && (
          <>
            <h1 className="title">Amin's Logo Cropper</h1>
            <label htmlFor="file-upload" className="custom-file-upload">
              Upload your logo
              <img
                width="16"
                height="16"
                src="https://img.icons8.com/material-two-tone/24/upload--v1.png"
                alt="upload--v1"
              />
            </label>
            <input
              id="file-upload"
              className="fileInput"
              type="file"
              accept="image/*"
              onChange={onFileChange}
              style={{
                marginBottom: '20px',
                cursor: 'pointer',
              }}
            />
          </>
        )}

        {croppingInProgress && imageSrc && (
          <>
            <div className="crop-container">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={onCropChange}
                onCropComplete={onCropComplete}
                onZoomChange={onZoomChange}
                minZoom={minZoom}
                restrictPosition={false} // Allow free repositioning
                onMediaLoaded={onImageLoad}
                disabled={loading} // Disable cropper during loading
              />
            </div>

            <div
              className="controls"
              style={{
                display: 'flex',
                alignItems: 'center',
                marginTop: '20px',
              }}
            >
              <div className="controls-container">
                <Slider
                  value={zoom}
                  min={minZoom}
                  max={3}
                  step={0.1}
                  aria-labelledby="Zoom"
                  onChange={(e, zoom) => onZoomChange(zoom)}
                  classes={{ container: 'slider' }}
                  style={{ marginRight: '20px', width: '500px' }}
                  disabled={loading} // Disable the slider during loading
                />
                <div className="buttongroup">
                  <button onClick={handleCropImage} disabled={loading}>
                    {loading ? 'Cropping...' : 'Crop Image'}
                  </button>
                  <button
                    className="cancel"
                    onClick={handleCancel}
                    style={{ marginLeft: '10px' }}
                    disabled={loading}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {downloadStarted && (
          <>
            <p
              className="success"
              style={{ color: 'green', marginTop: '10px' }}
            >
              Image has been cropped successfully!
            </p>

            {imgurUrl && (
              <div
                style={{
                  backgroundColor: 'black',
                  color: 'white',
                  padding: '10px',
                  margin: '10px 0',
                  borderRadius: '5px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <p style={{ marginRight: '10px' }}>Cropped Logo URL:</p>
                <a href={imgurUrl} target="_blank" style={{ color: 'white' }}>
                  {imgurUrl}
                </a>
                <button
                  onClick={handleCopyUrl}
                  style={{
                    marginLeft: '10px',
                    backgroundColor: 'white',
                    color: 'black',
                    border: '1px solid black',
                    cursor: 'pointer',
                  }}
                >
                  Copy URL
                </button>
              </div>
            )}

            {croppedImageUrl && (
              <button
                onClick={() => {
                  const link = document.createElement('a')
                  link.href = croppedImageUrl
                  link.download = 'cropped-logo.png'
                  link.click()
                }}
                style={{
                  padding: '10px',
                  marginTop: '10px',
                  backgroundColor: 'white',
                  color: 'black',
                  border: '1px solid black',
                  cursor: 'pointer',
                }}
              >
                Download Cropped Logo
              </button>
            )}

            <img
              className="banner"
              src="/assets/ThumbsUp.gif"
              alt="success"
              style={{ marginTop: '10px' }}
            />

            <button
              onClick={handleUploadAnother}
              style={{ padding: '10px', marginTop: '20px' }}
            >
              Upload Another Logo
            </button>
          </>
        )}
      </div>
    </div>
  )
}

const rootElement = document.getElementById('root')
ReactDOM.render(<App />, rootElement)
