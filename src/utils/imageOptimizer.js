/**
 * Client-side image resizing and optimization utility.
 * Resizes and center-crops an image file to exactly targetWidth x targetHeight
 * and converts it to a JPEG Blob/File to save database storage and network bandwidth.
 * 
 * @param {File} file - The original image File object.
 * @param {number} targetWidth - The desired width in pixels.
 * @param {number} targetHeight - The desired height in pixels.
 * @param {number} quality - JPEG compression quality (0.0 to 1.0).
 * @returns {Promise<File>} - A Promise that resolves to the optimized File object (JPEG format).
 */
export const resizeImage = (file, targetWidth = 500, targetHeight = 600, quality = 0.85) => {
  return new Promise((resolve, reject) => {
    // Verify file is indeed an image
    if (!file.type.startsWith("image/")) {
      reject(new Error("File is not an image"));
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          const ctx = canvas.getContext("2d");

          if (!ctx) {
            reject(new Error("Could not get 2D context from canvas"));
            return;
          }

          // Center crop calculations (Aspect Fill)
          const sourceWidth = img.width;
          const sourceHeight = img.height;
          const targetAspect = targetWidth / targetHeight;
          const sourceAspect = sourceWidth / sourceHeight;

          let sX = 0;
          let sY = 0;
          let sWidth = sourceWidth;
          let sHeight = sourceHeight;

          if (sourceAspect > targetAspect) {
            // Image is wider than target aspect ratio -> Crop left and right sides
            sWidth = sourceHeight * targetAspect;
            sX = (sourceWidth - sWidth) / 2;
          } else {
            // Image is taller than target aspect ratio -> Crop top and bottom sides
            sHeight = sourceWidth / targetAspect;
            sY = (sourceHeight - sHeight) / 2;
          }

          // Draw the cropped portion to the canvas
          ctx.drawImage(img, sX, sY, sWidth, sHeight, 0, 0, targetWidth, targetHeight);

          // Convert canvas back to jpeg blob
          canvas.toBlob((blob) => {
            if (blob) {
              // Create a new File from the blob, maintaining the original name
              const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf("."));
              const optimizedFileName = (nameWithoutExt || "image") + ".jpg";
              const optimizedFile = new File([blob], optimizedFileName, {
                type: "image/jpeg",
                lastModified: Date.now(),
              });
              resolve(optimizedFile);
            } else {
              reject(new Error("Failed to convert canvas to image blob"));
            }
          }, "image/jpeg", quality);
        } catch (err) {
          reject(err);
        }
      };

      img.onerror = (err) => reject(new Error("Failed to load image: " + (err.message || "Unknown error")));
      img.src = event.target.result;
    };

    reader.onerror = (err) => reject(new Error("Failed to read file: " + (err.message || "Unknown error")));
    reader.readAsDataURL(file);
  });
};
